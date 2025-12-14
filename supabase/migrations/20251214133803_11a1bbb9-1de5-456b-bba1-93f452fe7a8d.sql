-- Drop and recreate get_government_stats_timeseries with proper cumulative counts
DROP FUNCTION IF EXISTS public.get_government_stats_timeseries(date, date, text, text, text);

CREATE OR REPLACE FUNCTION public.get_government_stats_timeseries(
  start_date date,
  end_date date,
  filter_region text DEFAULT NULL,
  filter_province text DEFAULT NULL,
  filter_municipality text DEFAULT NULL
)
RETURNS TABLE(
  date date,
  total_farms bigint,
  cattle_count bigint,
  goat_count bigint,
  carabao_count bigint,
  sheep_count bigint,
  health_events bigint,
  doc_aga_queries bigint,
  total_milk_liters numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(start_date, end_date, '1 day'::interval)::date AS ds_date
  ),
  filtered_farms AS (
    SELECT f.id, f.created_at::date as farm_created_date
    FROM farms f
    WHERE f.is_deleted = false
      AND (filter_region IS NULL OR f.region = filter_region)
      AND (filter_province IS NULL OR f.province = filter_province)
      AND (filter_municipality IS NULL OR f.municipality = filter_municipality)
  ),
  filtered_animals AS (
    SELECT 
      a.id,
      a.farm_id,
      a.livestock_type,
      a.created_at::date as animal_created_date,
      a.exit_date
    FROM animals a
    JOIN filtered_farms ff ON a.farm_id = ff.id
    WHERE a.is_deleted = false
  )
  SELECT
    ds.ds_date AS date,
    -- Cumulative farm count: count farms created on or before this date
    (SELECT COUNT(DISTINCT ff.id) 
     FROM filtered_farms ff 
     WHERE ff.farm_created_date <= ds.ds_date)::bigint AS total_farms,
    -- Cumulative animal counts by type: animals created on or before this date AND not exited yet
    (SELECT COUNT(*) 
     FROM filtered_animals fa 
     WHERE fa.livestock_type = 'cattle' 
       AND fa.animal_created_date <= ds.ds_date
       AND (fa.exit_date IS NULL OR fa.exit_date > ds.ds_date))::bigint AS cattle_count,
    (SELECT COUNT(*) 
     FROM filtered_animals fa 
     WHERE fa.livestock_type = 'goat' 
       AND fa.animal_created_date <= ds.ds_date
       AND (fa.exit_date IS NULL OR fa.exit_date > ds.ds_date))::bigint AS goat_count,
    (SELECT COUNT(*) 
     FROM filtered_animals fa 
     WHERE fa.livestock_type = 'carabao' 
       AND fa.animal_created_date <= ds.ds_date
       AND (fa.exit_date IS NULL OR fa.exit_date > ds.ds_date))::bigint AS carabao_count,
    (SELECT COUNT(*) 
     FROM filtered_animals fa 
     WHERE fa.livestock_type = 'sheep' 
       AND fa.animal_created_date <= ds.ds_date
       AND (fa.exit_date IS NULL OR fa.exit_date > ds.ds_date))::bigint AS sheep_count,
    -- Health events on this specific date
    (SELECT COUNT(*)
     FROM health_records hr
     JOIN filtered_animals fa ON hr.animal_id = fa.id
     WHERE hr.visit_date = ds.ds_date)::bigint AS health_events,
    -- Doc Aga queries on this specific date
    (SELECT COUNT(*)
     FROM doc_aga_queries daq
     LEFT JOIN filtered_farms ff ON daq.farm_id = ff.id
     WHERE daq.created_at::date = ds.ds_date
       AND (daq.farm_id IS NULL OR ff.id IS NOT NULL))::bigint AS doc_aga_queries,
    -- Milk production on this specific date
    (SELECT COALESCE(SUM(mr.liters), 0)
     FROM milking_records mr
     JOIN filtered_animals fa ON mr.animal_id = fa.id
     WHERE mr.record_date = ds.ds_date)::numeric AS total_milk_liters
  FROM date_series ds
  ORDER BY ds.ds_date;
END;
$$;