-- Create helper function for government access
CREATE OR REPLACE FUNCTION public.has_government_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(_user_id, 'admin'::user_role) 
      OR has_role(_user_id, 'government'::user_role)
$$;

-- Update get_government_stats to allow both admin and government roles
CREATE OR REPLACE FUNCTION public.get_government_stats(start_date date, end_date date, region_filter text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Allow both admin and government roles
  IF NOT (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'government'::user_role)) THEN
    RAISE EXCEPTION 'Access denied: Admin or Government role required';
  END IF;

  SELECT jsonb_build_object(
    'farm_count', COUNT(DISTINCT f.id),
    'active_animal_count', COUNT(DISTINCT CASE WHEN a.is_deleted = false THEN a.id END),
    'daily_log_count', COUNT(DISTINCT dq.id) + COUNT(DISTINCT h.id),
    'health_event_count', COUNT(DISTINCT h.id),
    'avg_milk_liters', COALESCE(AVG(mr.liters), 0),
    'doc_aga_query_count', COUNT(DISTINCT dq.id)
  ) INTO result
  FROM farms f
  LEFT JOIN animals a ON a.farm_id = f.id
  LEFT JOIN health_records h ON h.animal_id = a.id 
    AND h.visit_date BETWEEN start_date AND end_date
  LEFT JOIN doc_aga_queries dq ON dq.farm_id = f.id 
    AND dq.created_at::date BETWEEN start_date AND end_date
  LEFT JOIN milking_records mr ON mr.animal_id = a.id 
    AND mr.record_date BETWEEN start_date AND end_date
  WHERE f.is_deleted = false
    AND (region_filter IS NULL OR f.region = region_filter);

  RETURN result;
END;
$$;

-- Update get_health_heatmap_data to allow both admin and government roles
CREATE OR REPLACE FUNCTION public.get_health_heatmap_data(days_back integer DEFAULT 7, region_filter text DEFAULT NULL)
RETURNS TABLE(municipality text, region text, health_event_count bigint, total_animals bigint, prevalence_rate numeric, symptom_types text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow both admin and government roles
  IF NOT (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'government'::user_role)) THEN
    RAISE EXCEPTION 'Access denied: Admin or Government role required';
  END IF;

  RETURN QUERY
  SELECT 
    f.municipality,
    f.region,
    COUNT(DISTINCT h.id) as health_event_count,
    COUNT(DISTINCT a.id) as total_animals,
    ROUND((COUNT(DISTINCT h.id)::numeric / NULLIF(COUNT(DISTINCT a.id), 0) * 100), 2) as prevalence_rate,
    array_agg(DISTINCT hsc.symptom_type) FILTER (WHERE hsc.symptom_type IS NOT NULL) as symptom_types
  FROM farms f
  JOIN animals a ON a.farm_id = f.id
  LEFT JOIN health_records h ON h.animal_id = a.id 
    AND h.visit_date >= CURRENT_DATE - days_back
  LEFT JOIN health_symptom_categories hsc ON hsc.health_record_id = h.id
  WHERE f.is_deleted = false 
    AND f.municipality IS NOT NULL
    AND (region_filter IS NULL OR f.region = region_filter)
  GROUP BY f.municipality, f.region
  HAVING COUNT(DISTINCT a.id) > 0
  ORDER BY prevalence_rate DESC;
END;
$$;