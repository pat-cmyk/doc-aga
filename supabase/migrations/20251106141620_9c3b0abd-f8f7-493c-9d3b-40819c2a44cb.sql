-- Drop and recreate the get_government_stats_timeseries function to use daily_farm_stats
DROP FUNCTION IF EXISTS public.get_government_stats_timeseries(date, date, text);

CREATE OR REPLACE FUNCTION public.get_government_stats_timeseries(
  start_date date, 
  end_date date, 
  region_filter text DEFAULT NULL
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
  -- Allow both admin and government roles
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
  LEFT JOIN animals a ON a.farm_id = f.id AND a.is_deleted = false
  LEFT JOIN health_records h ON h.animal_id = a.id AND h.visit_date = ds.date
  LEFT JOIN doc_aga_queries dq ON dq.farm_id = f.id AND dq.created_at::date = ds.date
  WHERE dfs.farm_id IS NOT NULL OR f.id IS NOT NULL
  GROUP BY ds.date
  ORDER BY ds.date;
END;
$function$;