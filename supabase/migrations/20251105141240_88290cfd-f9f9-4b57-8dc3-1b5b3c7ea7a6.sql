-- Create function to get government statistics over time (daily aggregates)
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
AS $$
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
    COUNT(DISTINCT f.id) as farm_count,
    COUNT(DISTINCT CASE WHEN a.is_deleted = false THEN a.id END) as active_animal_count,
    COUNT(DISTINCT h.id) as health_event_count,
    COUNT(DISTINCT dq.id) as doc_aga_query_count,
    COALESCE(AVG(mr.liters), 0) as avg_milk_liters
  FROM date_series ds
  CROSS JOIN farms f
  LEFT JOIN animals a ON a.farm_id = f.id AND a.created_at::date <= ds.date
  LEFT JOIN health_records h ON h.animal_id = a.id AND h.visit_date = ds.date
  LEFT JOIN doc_aga_queries dq ON dq.farm_id = f.id AND dq.created_at::date = ds.date
  LEFT JOIN milking_records mr ON mr.animal_id = a.id AND mr.record_date = ds.date
  WHERE f.is_deleted = false
    AND f.created_at::date <= ds.date
    AND (region_filter IS NULL OR f.region = region_filter)
  GROUP BY ds.date
  ORDER BY ds.date;
END;
$$;