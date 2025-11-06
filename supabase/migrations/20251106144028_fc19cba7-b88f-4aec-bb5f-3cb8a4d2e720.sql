-- Drop and recreate get_government_stats_timeseries with livestock_type grouping
DROP FUNCTION IF EXISTS public.get_government_stats_timeseries(date, date, text, text, text);

CREATE OR REPLACE FUNCTION public.get_government_stats_timeseries(
  start_date date, 
  end_date date, 
  region_filter text DEFAULT NULL, 
  province_filter text DEFAULT NULL, 
  municipality_filter text DEFAULT NULL
)
RETURNS TABLE(
  date date,
  livestock_type text,
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
  ),
  livestock_types AS (
    SELECT DISTINCT livestock_type 
    FROM animals 
    WHERE is_deleted = false 
      AND livestock_type IS NOT NULL
      AND livestock_type IN ('cattle', 'goat', 'carabao', 'sheep')
  )
  SELECT 
    ds.date,
    lt.livestock_type,
    COUNT(DISTINCT f.id) as farm_count,
    COUNT(DISTINCT a.id) as active_animal_count,
    COUNT(DISTINCT h.id) as health_event_count,
    COUNT(DISTINCT dq.id) as doc_aga_query_count,
    COALESCE(AVG(mr.liters), 0) as avg_milk_liters
  FROM date_series ds
  CROSS JOIN livestock_types lt
  LEFT JOIN animals a ON a.livestock_type = lt.livestock_type 
    AND a.is_deleted = false
  LEFT JOIN farms f ON f.id = a.farm_id
    AND f.is_deleted = false
    AND (region_filter IS NULL OR f.region = region_filter)
    AND (province_filter IS NULL OR f.province = province_filter)
    AND (municipality_filter IS NULL OR f.municipality = municipality_filter)
  LEFT JOIN milking_records mr ON mr.animal_id = a.id 
    AND mr.record_date = ds.date
  LEFT JOIN health_records h ON h.animal_id = a.id 
    AND h.visit_date = ds.date
  LEFT JOIN doc_aga_queries dq ON dq.farm_id = f.id 
    AND dq.created_at::date = ds.date
  GROUP BY ds.date, lt.livestock_type
  ORDER BY ds.date, lt.livestock_type;
END;
$function$;