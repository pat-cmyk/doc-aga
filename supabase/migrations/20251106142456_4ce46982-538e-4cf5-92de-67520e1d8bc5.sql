-- Update get_government_stats function to include province and municipality filters
DROP FUNCTION IF EXISTS public.get_government_stats(date, date, text);

CREATE OR REPLACE FUNCTION public.get_government_stats(
  start_date date,
  end_date date,
  region_filter text DEFAULT NULL,
  province_filter text DEFAULT NULL,
  municipality_filter text DEFAULT NULL
)
RETURNS TABLE(
  farm_count bigint,
  active_animal_count bigint,
  daily_log_count bigint,
  health_event_count bigint,
  avg_milk_liters numeric,
  doc_aga_query_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'government'::user_role)) THEN
    RAISE EXCEPTION 'Access denied: Admin or Government role required';
  END IF;

  RETURN QUERY
  SELECT 
    COUNT(DISTINCT f.id) as farm_count,
    COUNT(DISTINCT a.id) FILTER (WHERE a.is_deleted = false) as active_animal_count,
    COUNT(DISTINCT CONCAT(DATE(mr.created_at), mr.animal_id, mr.created_by)) as daily_log_count,
    COUNT(DISTINCT h.id) as health_event_count,
    COALESCE(AVG(mr.liters), 0) as avg_milk_liters,
    COUNT(DISTINCT dq.id) as doc_aga_query_count
  FROM farms f
  LEFT JOIN animals a ON a.farm_id = f.id
  LEFT JOIN milking_records mr ON mr.animal_id = a.id 
    AND mr.record_date BETWEEN start_date AND end_date
  LEFT JOIN health_records h ON h.animal_id = a.id
    AND h.visit_date BETWEEN start_date AND end_date
  LEFT JOIN doc_aga_queries dq ON dq.farm_id = f.id
    AND dq.created_at::date BETWEEN start_date AND end_date
  WHERE f.is_deleted = false
    AND (region_filter IS NULL OR f.region = region_filter)
    AND (province_filter IS NULL OR f.province = province_filter)
    AND (municipality_filter IS NULL OR f.municipality = municipality_filter);
END;
$function$;

-- Update get_government_stats_timeseries function to include province and municipality filters
DROP FUNCTION IF EXISTS public.get_government_stats_timeseries(date, date, text);

CREATE OR REPLACE FUNCTION public.get_government_stats_timeseries(
  start_date date, 
  end_date date, 
  region_filter text DEFAULT NULL,
  province_filter text DEFAULT NULL,
  municipality_filter text DEFAULT NULL
)
RETURNS TABLE(
  date date,
  farm_count bigint,
  active_animal_count bigint,
  health_event_count bigint,
  doc_aga_query_count bigint,
  avg_milk_liters numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'government'::user_role)) THEN
    RAISE EXCEPTION 'Access denied: Admin or Government role required';
  END IF;

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(start_date, end_date, '1 day'::interval)::date as date
  )
  SELECT 
    ds.date,
    COUNT(DISTINCT dfs.farm_id) as farm_count,
    COALESCE(SUM((dfs.stage_counts->>'total')::int), 0) as active_animal_count,
    COUNT(DISTINCT h.id) as health_event_count,
    COUNT(DISTINCT dq.id) as doc_aga_query_count,
    COALESCE(AVG(dfs.total_milk_liters), 0) as avg_milk_liters
  FROM date_series ds
  LEFT JOIN daily_farm_stats dfs ON dfs.stat_date = ds.date
  LEFT JOIN farms f ON f.id = dfs.farm_id 
    AND f.is_deleted = false
    AND (region_filter IS NULL OR f.region = region_filter)
    AND (province_filter IS NULL OR f.province = province_filter)
    AND (municipality_filter IS NULL OR f.municipality = municipality_filter)
  LEFT JOIN animals a ON a.farm_id = f.id AND a.is_deleted = false
  LEFT JOIN health_records h ON h.animal_id = a.id AND h.visit_date = ds.date
  LEFT JOIN doc_aga_queries dq ON dq.farm_id = f.id AND dq.created_at::date = ds.date
  WHERE dfs.farm_id IS NOT NULL OR f.id IS NOT NULL
  GROUP BY ds.date
  ORDER BY ds.date;
END;
$function$;

-- Update get_health_heatmap_data function to include province and municipality filters
DROP FUNCTION IF EXISTS public.get_health_heatmap_data(integer, text);

CREATE OR REPLACE FUNCTION public.get_health_heatmap_data(
  days_back integer DEFAULT 7,
  region_filter text DEFAULT NULL,
  province_filter text DEFAULT NULL,
  municipality_filter text DEFAULT NULL
)
RETURNS TABLE(
  municipality text,
  region text,
  health_event_count bigint,
  total_animals bigint,
  prevalence_rate numeric,
  symptom_types text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'government'::user_role)) THEN
    RAISE EXCEPTION 'Access denied: Admin or Government role required';
  END IF;

  RETURN QUERY
  SELECT 
    f.municipality,
    f.region,
    COUNT(DISTINCT hr.id) as health_event_count,
    COUNT(DISTINCT a.id) as total_animals,
    CASE 
      WHEN COUNT(DISTINCT a.id) > 0 THEN 
        ROUND((COUNT(DISTINCT CASE WHEN hr.id IS NOT NULL THEN a.id END)::numeric / COUNT(DISTINCT a.id)::numeric) * 100, 2)
      ELSE 0
    END as prevalence_rate,
    ARRAY_AGG(DISTINCT hsc.symptom_type) FILTER (WHERE hsc.symptom_type IS NOT NULL) as symptom_types
  FROM farms f
  LEFT JOIN animals a ON a.farm_id = f.id AND a.is_deleted = false
  LEFT JOIN health_records hr ON hr.animal_id = a.id 
    AND hr.visit_date >= CURRENT_DATE - days_back
  LEFT JOIN health_symptom_categories hsc ON hsc.health_record_id = hr.id
  WHERE f.is_deleted = false
    AND f.municipality IS NOT NULL
    AND (region_filter IS NULL OR f.region = region_filter)
    AND (province_filter IS NULL OR f.province = province_filter)
    AND (municipality_filter IS NULL OR f.municipality = municipality_filter)
  GROUP BY f.municipality, f.region
  HAVING COUNT(DISTINCT hr.id) > 0
  ORDER BY health_event_count DESC;
END;
$function$;