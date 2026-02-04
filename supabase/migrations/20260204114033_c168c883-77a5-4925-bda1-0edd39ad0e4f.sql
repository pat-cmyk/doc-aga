-- Fix: Correct column name errors in government RPC functions
-- Must drop get_government_health_stats first due to return type change

-- Drop existing function with old signature
DROP FUNCTION IF EXISTS public.get_government_health_stats(date, date, text, text, text, text);

-- 1. Fix get_government_stats (already created, just ensuring it's correct)
CREATE OR REPLACE FUNCTION public.get_government_stats(
  start_date date,
  end_date date,
  region_filter text DEFAULT NULL,
  province_filter text DEFAULT NULL,
  municipality_filter text DEFAULT NULL,
  data_category_filter text DEFAULT NULL
)
RETURNS TABLE (
  farm_count bigint,
  active_animal_count bigint,
  daily_log_count bigint,
  health_event_count bigint,
  avg_milk_liters numeric,
  doc_aga_query_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_farms AS (
    SELECT f.id
    FROM farms f
    WHERE f.is_deleted = false
      AND (region_filter IS NULL OR f.region = region_filter)
      AND (province_filter IS NULL OR f.province = province_filter)
      AND (municipality_filter IS NULL OR f.municipality = municipality_filter)
      AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
  ),
  farm_stats AS (
    SELECT COUNT(*) AS farm_count
    FROM filtered_farms
  ),
  animal_stats AS (
    SELECT COUNT(*) AS active_animal_count
    FROM animals a
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    WHERE a.is_deleted = false
      AND a.exit_date IS NULL
  ),
  milk_stats AS (
    SELECT 
      COUNT(*) AS daily_log_count,
      COALESCE(AVG(mr.liters), 0) AS avg_milk_liters
    FROM milking_records mr
    INNER JOIN animals a ON mr.animal_id = a.id
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    WHERE mr.record_date BETWEEN start_date AND end_date
  ),
  health_stats AS (
    SELECT COUNT(*) AS health_event_count
    FROM health_records hr
    INNER JOIN animals a ON hr.animal_id = a.id
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    WHERE hr.visit_date BETWEEN start_date AND end_date
  ),
  query_stats AS (
    SELECT COUNT(*) AS doc_aga_query_count
    FROM doc_aga_queries dq
    INNER JOIN filtered_farms ff ON dq.farm_id = ff.id
    WHERE dq.created_at::date BETWEEN start_date AND end_date
  )
  SELECT
    fs.farm_count,
    ans.active_animal_count,
    ms.daily_log_count,
    hs.health_event_count,
    ms.avg_milk_liters,
    qs.doc_aga_query_count
  FROM farm_stats fs
  CROSS JOIN animal_stats ans
  CROSS JOIN milk_stats ms
  CROSS JOIN health_stats hs
  CROSS JOIN query_stats qs;
END;
$$;

-- 2. Fix get_government_stats_timeseries
CREATE OR REPLACE FUNCTION public.get_government_stats_timeseries(
  start_date date,
  end_date date,
  filter_region text DEFAULT NULL,
  filter_province text DEFAULT NULL,
  filter_municipality text DEFAULT NULL,
  data_category_filter text DEFAULT NULL
)
RETURNS TABLE (
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
    SELECT generate_series(start_date, end_date, '1 day'::interval)::date AS date
  ),
  filtered_farms AS (
    SELECT f.id, f.created_at::date AS farm_created_date
    FROM farms f
    WHERE f.is_deleted = false
      AND (filter_region IS NULL OR f.region = filter_region)
      AND (filter_province IS NULL OR f.province = filter_province)
      AND (filter_municipality IS NULL OR f.municipality = filter_municipality)
      AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
  ),
  daily_farms AS (
    SELECT ds.date, COUNT(ff.id) AS total_farms
    FROM date_series ds
    LEFT JOIN filtered_farms ff ON ff.farm_created_date <= ds.date
    GROUP BY ds.date
  ),
  daily_animals AS (
    SELECT 
      ds.date,
      COUNT(*) FILTER (WHERE a.livestock_type = 'cattle') AS cattle_count,
      COUNT(*) FILTER (WHERE a.livestock_type = 'goat') AS goat_count,
      COUNT(*) FILTER (WHERE a.livestock_type = 'carabao') AS carabao_count,
      COUNT(*) FILTER (WHERE a.livestock_type = 'sheep') AS sheep_count
    FROM date_series ds
    LEFT JOIN filtered_farms ff ON true
    LEFT JOIN animals a ON a.farm_id = ff.id 
      AND a.is_deleted = false 
      AND a.exit_date IS NULL
      AND a.created_at::date <= ds.date
    GROUP BY ds.date
  ),
  daily_health AS (
    SELECT ds.date, COUNT(hr.id) AS health_events
    FROM date_series ds
    LEFT JOIN filtered_farms ff ON true
    LEFT JOIN animals a ON a.farm_id = ff.id
    LEFT JOIN health_records hr ON hr.animal_id = a.id AND hr.visit_date = ds.date
    GROUP BY ds.date
  ),
  daily_queries AS (
    SELECT ds.date, COUNT(dq.id) AS doc_aga_queries
    FROM date_series ds
    LEFT JOIN filtered_farms ff ON true
    LEFT JOIN doc_aga_queries dq ON dq.farm_id = ff.id AND dq.created_at::date = ds.date
    GROUP BY ds.date
  ),
  daily_milk AS (
    SELECT ds.date, COALESCE(SUM(mr.liters), 0) AS total_milk_liters
    FROM date_series ds
    LEFT JOIN filtered_farms ff ON true
    LEFT JOIN animals a ON a.farm_id = ff.id
    LEFT JOIN milking_records mr ON mr.animal_id = a.id AND mr.record_date = ds.date
    GROUP BY ds.date
  )
  SELECT 
    df.date,
    df.total_farms,
    da.cattle_count,
    da.goat_count,
    da.carabao_count,
    da.sheep_count,
    dh.health_events,
    dq.doc_aga_queries,
    dm.total_milk_liters
  FROM daily_farms df
  JOIN daily_animals da ON df.date = da.date
  JOIN daily_health dh ON df.date = dh.date
  JOIN daily_queries dq ON df.date = dq.date
  JOIN daily_milk dm ON df.date = dm.date
  ORDER BY df.date;
END;
$$;

-- 3. Fix get_health_heatmap_data
CREATE OR REPLACE FUNCTION public.get_health_heatmap_data(
  days_back integer DEFAULT 7,
  region_filter text DEFAULT NULL,
  province_filter text DEFAULT NULL,
  municipality_filter text DEFAULT NULL,
  data_category_filter text DEFAULT NULL
)
RETURNS TABLE (
  municipality text,
  region text,
  health_event_count bigint,
  total_animals bigint,
  prevalence_rate numeric,
  symptom_types text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_farms AS (
    SELECT f.id, f.municipality, f.region
    FROM farms f
    WHERE f.is_deleted = false
      AND f.municipality IS NOT NULL
      AND (region_filter IS NULL OR f.region = region_filter)
      AND (province_filter IS NULL OR f.province = province_filter)
      AND (municipality_filter IS NULL OR f.municipality = municipality_filter)
      AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
  ),
  health_events AS (
    SELECT 
      ff.municipality,
      ff.region,
      hr.id,
      hr.diagnosis
    FROM health_records hr
    INNER JOIN animals a ON hr.animal_id = a.id
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    WHERE hr.visit_date >= CURRENT_DATE - days_back
  ),
  animal_counts AS (
    SELECT 
      ff.municipality,
      COUNT(DISTINCT a.id) AS total_animals
    FROM animals a
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    WHERE a.is_deleted = false AND a.exit_date IS NULL
    GROUP BY ff.municipality
  )
  SELECT 
    he.municipality,
    he.region,
    COUNT(DISTINCT he.id) AS health_event_count,
    COALESCE(ac.total_animals, 0) AS total_animals,
    CASE 
      WHEN COALESCE(ac.total_animals, 0) > 0 
      THEN ROUND((COUNT(DISTINCT he.id)::numeric / ac.total_animals) * 100, 2)
      ELSE 0
    END AS prevalence_rate,
    ARRAY_AGG(DISTINCT he.diagnosis) FILTER (WHERE he.diagnosis IS NOT NULL) AS symptom_types
  FROM health_events he
  LEFT JOIN animal_counts ac ON he.municipality = ac.municipality
  GROUP BY he.municipality, he.region, ac.total_animals
  ORDER BY COUNT(DISTINCT he.id) DESC;
END;
$$;

-- 4. Recreate get_government_health_stats with correct return type
CREATE OR REPLACE FUNCTION public.get_government_health_stats(
  start_date date,
  end_date date,
  region_filter text DEFAULT NULL,
  province_filter text DEFAULT NULL,
  municipality_filter text DEFAULT NULL,
  data_category_filter text DEFAULT NULL
)
RETURNS TABLE (
  vaccination_count bigint,
  vaccination_rate numeric,
  avg_bcs numeric,
  mortality_count bigint,
  mortality_rate numeric,
  heat_detection_count bigint,
  avg_cycle_length numeric,
  optimal_breeding_window_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_farms AS (
    SELECT f.id
    FROM farms f
    WHERE f.is_deleted = false
      AND (region_filter IS NULL OR f.region = region_filter)
      AND (province_filter IS NULL OR f.province = province_filter)
      AND (municipality_filter IS NULL OR f.municipality = municipality_filter)
      AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
  ),
  total_animals AS (
    SELECT COUNT(*) AS cnt
    FROM animals a
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    WHERE a.is_deleted = false AND a.exit_date IS NULL
  ),
  vaccination_stats AS (
    SELECT COUNT(*) AS vaccination_count
    FROM vaccination_records vr
    INNER JOIN animals a ON vr.animal_id = a.id
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    WHERE vr.administered_date BETWEEN start_date AND end_date
  ),
  bcs_stats AS (
    SELECT AVG(bcs.score) AS avg_bcs
    FROM body_condition_scores bcs
    INNER JOIN animals a ON bcs.animal_id = a.id
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    WHERE bcs.assessment_date BETWEEN start_date AND end_date
  ),
  mortality_stats AS (
    SELECT COUNT(*) AS mortality_count
    FROM animals a
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    WHERE a.exit_date BETWEEN start_date AND end_date
      AND a.exit_reason = 'death'
  ),
  heat_stats AS (
    SELECT
      COUNT(*) AS heat_count,
      AVG(
        CASE 
          WHEN prev_heat.detected_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (hr.detected_at - prev_heat.detected_at)) / 86400
          ELSE NULL
        END
      ) AS avg_cycle
    FROM heat_records hr
    INNER JOIN animals a ON hr.animal_id = a.id
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    LEFT JOIN LATERAL (
      SELECT hr2.detected_at
      FROM heat_records hr2
      WHERE hr2.animal_id = hr.animal_id
        AND hr2.detected_at < hr.detected_at
      ORDER BY hr2.detected_at DESC
      LIMIT 1
    ) prev_heat ON true
    WHERE hr.detected_at::date BETWEEN start_date AND end_date
  ),
  optimal_window AS (
    SELECT COUNT(DISTINCT a.id) AS optimal_count
    FROM animals a
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    INNER JOIN heat_records hr ON hr.animal_id = a.id
    WHERE a.is_deleted = false
      AND a.exit_date IS NULL
      AND a.gender = 'female'
      AND hr.detected_at >= CURRENT_TIMESTAMP - INTERVAL '21 days'
      AND hr.detected_at <= CURRENT_TIMESTAMP - INTERVAL '18 days'
  )
  SELECT
    vs.vaccination_count,
    CASE WHEN ta.cnt > 0 THEN ROUND((vs.vaccination_count::numeric / ta.cnt) * 100, 2) ELSE 0 END AS vaccination_rate,
    COALESCE(bs.avg_bcs, 0) AS avg_bcs,
    ms.mortality_count,
    CASE WHEN ta.cnt > 0 THEN ROUND((ms.mortality_count::numeric / ta.cnt) * 100, 2) ELSE 0 END AS mortality_rate,
    hs.heat_count AS heat_detection_count,
    COALESCE(hs.avg_cycle, 0) AS avg_cycle_length,
    ow.optimal_count AS optimal_breeding_window_count
  FROM vaccination_stats vs
  CROSS JOIN bcs_stats bs
  CROSS JOIN mortality_stats ms
  CROSS JOIN heat_stats hs
  CROSS JOIN optimal_window ow
  CROSS JOIN total_animals ta;
END;
$$;