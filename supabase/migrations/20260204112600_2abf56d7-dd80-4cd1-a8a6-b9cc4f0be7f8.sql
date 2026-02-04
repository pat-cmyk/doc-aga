-- Add data_category column to farms table
ALTER TABLE public.farms 
ADD COLUMN data_category TEXT NOT NULL DEFAULT 'live'
CONSTRAINT chk_data_category CHECK (data_category IN ('live', 'demo'));

-- Create index for efficient filtering
CREATE INDEX idx_farms_data_category ON farms(data_category);

-- Update existing [TEST] farms to 'demo' category
UPDATE farms 
SET data_category = 'demo' 
WHERE name ILIKE '%[TEST]%' OR name ILIKE '%test farm%';

-- ============================================
-- Update get_government_stats RPC
-- ============================================
CREATE OR REPLACE FUNCTION public.get_government_stats(
  start_date date,
  end_date date,
  region_filter text DEFAULT NULL,
  province_filter text DEFAULT NULL,
  municipality_filter text DEFAULT NULL,
  data_category_filter text DEFAULT 'live'
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
  SELECT
    COUNT(DISTINCT f.id)::bigint AS farm_count,
    COALESCE(COUNT(DISTINCT a.id) FILTER (WHERE a.is_deleted = false AND a.exit_date IS NULL), 0)::bigint AS active_animal_count,
    COALESCE(COUNT(DISTINCT mr.id), 0)::bigint AS daily_log_count,
    COALESCE(COUNT(DISTINCT hr.id), 0)::bigint AS health_event_count,
    COALESCE(ROUND(AVG(mr.liters)::numeric, 2), 0) AS avg_milk_liters,
    COALESCE(COUNT(DISTINCT dq.id), 0)::bigint AS doc_aga_query_count
  FROM farms f
  LEFT JOIN animals a ON a.farm_id = f.id
  LEFT JOIN milking_records mr ON mr.animal_id = a.id 
    AND mr.record_datetime::date BETWEEN start_date AND end_date
  LEFT JOIN health_records hr ON hr.animal_id = a.id 
    AND hr.record_date BETWEEN start_date AND end_date
  LEFT JOIN doc_aga_queries dq ON dq.farm_id = f.id 
    AND dq.created_at::date BETWEEN start_date AND end_date
  WHERE f.is_deleted = false
    AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
    AND (region_filter IS NULL OR f.region = region_filter)
    AND (province_filter IS NULL OR f.province = province_filter)
    AND (municipality_filter IS NULL OR f.municipality = municipality_filter);
END;
$$;

-- ============================================
-- Update get_government_stats_timeseries RPC
-- ============================================
CREATE OR REPLACE FUNCTION public.get_government_stats_timeseries(
  start_date date,
  end_date date,
  filter_region text DEFAULT NULL,
  filter_province text DEFAULT NULL,
  filter_municipality text DEFAULT NULL,
  data_category_filter text DEFAULT 'live'
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
    SELECT generate_series(start_date, end_date, '1 day'::interval)::date AS series_date
  ),
  filtered_farms AS (
    SELECT id FROM farms f
    WHERE f.is_deleted = false
      AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
      AND (filter_region IS NULL OR f.region = filter_region)
      AND (filter_province IS NULL OR f.province = filter_province)
      AND (filter_municipality IS NULL OR f.municipality = filter_municipality)
  ),
  daily_stats AS (
    SELECT
      ds.series_date,
      COUNT(DISTINCT f.id) AS farms_active,
      COUNT(DISTINCT a.id) FILTER (WHERE a.livestock_type = 'cattle') AS cattle,
      COUNT(DISTINCT a.id) FILTER (WHERE a.livestock_type = 'goat') AS goats,
      COUNT(DISTINCT a.id) FILTER (WHERE a.livestock_type = 'carabao') AS carabaos,
      COUNT(DISTINCT a.id) FILTER (WHERE a.livestock_type = 'sheep') AS sheep,
      COUNT(DISTINCT hr.id) AS health_evts,
      COUNT(DISTINCT dq.id) AS aga_queries,
      COALESCE(SUM(mr.liters), 0) AS milk
    FROM date_series ds
    LEFT JOIN filtered_farms ff ON true
    LEFT JOIN farms f ON f.id = ff.id AND f.created_at::date <= ds.series_date
    LEFT JOIN animals a ON a.farm_id = f.id 
      AND a.is_deleted = false 
      AND a.exit_date IS NULL
      AND a.created_at::date <= ds.series_date
    LEFT JOIN health_records hr ON hr.animal_id = a.id 
      AND hr.record_date = ds.series_date
    LEFT JOIN doc_aga_queries dq ON dq.farm_id = f.id 
      AND dq.created_at::date = ds.series_date
    LEFT JOIN milking_records mr ON mr.animal_id = a.id 
      AND mr.record_datetime::date = ds.series_date
    GROUP BY ds.series_date
  )
  SELECT
    daily_stats.series_date AS date,
    COALESCE(daily_stats.farms_active, 0)::bigint AS total_farms,
    COALESCE(daily_stats.cattle, 0)::bigint AS cattle_count,
    COALESCE(daily_stats.goats, 0)::bigint AS goat_count,
    COALESCE(daily_stats.carabaos, 0)::bigint AS carabao_count,
    COALESCE(daily_stats.sheep, 0)::bigint AS sheep_count,
    COALESCE(daily_stats.health_evts, 0)::bigint AS health_events,
    COALESCE(daily_stats.aga_queries, 0)::bigint AS doc_aga_queries,
    ROUND(COALESCE(daily_stats.milk, 0)::numeric, 2) AS total_milk_liters
  FROM daily_stats
  ORDER BY daily_stats.series_date;
END;
$$;

-- ============================================
-- Update get_health_heatmap_data RPC
-- ============================================
CREATE OR REPLACE FUNCTION public.get_health_heatmap_data(
  days_back integer DEFAULT 7,
  region_filter text DEFAULT NULL,
  province_filter text DEFAULT NULL,
  municipality_filter text DEFAULT NULL,
  data_category_filter text DEFAULT 'live'
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
  SELECT
    COALESCE(f.municipality, 'Unknown') AS municipality,
    COALESCE(f.region, 'Unknown') AS region,
    COUNT(DISTINCT hr.id)::bigint AS health_event_count,
    COUNT(DISTINCT a.id)::bigint AS total_animals,
    CASE 
      WHEN COUNT(DISTINCT a.id) > 0 
      THEN ROUND((COUNT(DISTINCT hr.id)::numeric / COUNT(DISTINCT a.id)::numeric) * 100, 2)
      ELSE 0
    END AS prevalence_rate,
    ARRAY_AGG(DISTINCT hr.symptoms) FILTER (WHERE hr.symptoms IS NOT NULL) AS symptom_types
  FROM farms f
  INNER JOIN animals a ON a.farm_id = f.id AND a.is_deleted = false AND a.exit_date IS NULL
  LEFT JOIN health_records hr ON hr.animal_id = a.id 
    AND hr.record_date >= CURRENT_DATE - days_back
  WHERE f.is_deleted = false
    AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
    AND (region_filter IS NULL OR f.region = region_filter)
    AND (province_filter IS NULL OR f.province = province_filter)
    AND (municipality_filter IS NULL OR f.municipality = municipality_filter)
  GROUP BY f.municipality, f.region
  HAVING COUNT(DISTINCT hr.id) > 0
  ORDER BY health_event_count DESC;
END;
$$;

-- ============================================
-- Update get_government_health_stats RPC
-- ============================================
CREATE OR REPLACE FUNCTION public.get_government_health_stats(
  start_date date,
  end_date date,
  region_filter text DEFAULT NULL,
  province_filter text DEFAULT NULL,
  municipality_filter text DEFAULT NULL,
  data_category_filter text DEFAULT 'live'
)
RETURNS TABLE (
  scheduled_vaccinations bigint,
  completed_vaccinations bigint,
  overdue_vaccinations bigint,
  scheduled_deworming bigint,
  completed_deworming bigint,
  vaccination_compliance_rate numeric,
  heat_events_count bigint,
  avg_cycle_length_days numeric,
  animals_in_optimal_window bigint,
  total_exits bigint,
  exits_sold bigint,
  exits_died bigint,
  exits_culled bigint,
  exits_transferred bigint,
  exits_slaughtered bigint,
  mortality_rate numeric,
  total_sales_revenue numeric,
  avg_bcs_score numeric,
  animals_underweight bigint,
  animals_optimal bigint,
  animals_overweight bigint,
  bcs_assessments_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_active_animals bigint;
BEGIN
  -- Get total active animals first for mortality calculation
  SELECT COUNT(DISTINCT a.id) INTO total_active_animals
  FROM farms f
  INNER JOIN animals a ON a.farm_id = f.id AND a.is_deleted = false
  WHERE f.is_deleted = false
    AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
    AND (region_filter IS NULL OR f.region = region_filter)
    AND (province_filter IS NULL OR f.province = province_filter)
    AND (municipality_filter IS NULL OR f.municipality = municipality_filter);

  RETURN QUERY
  WITH filtered_farms AS (
    SELECT f.id FROM farms f
    WHERE f.is_deleted = false
      AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
      AND (region_filter IS NULL OR f.region = region_filter)
      AND (province_filter IS NULL OR f.province = province_filter)
      AND (municipality_filter IS NULL OR f.municipality = municipality_filter)
  ),
  preventive_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE phs.schedule_type = 'vaccination') AS sched_vacc,
      COUNT(*) FILTER (WHERE phs.schedule_type = 'vaccination' AND phs.completed_date IS NOT NULL) AS comp_vacc,
      COUNT(*) FILTER (WHERE phs.schedule_type = 'vaccination' AND phs.completed_date IS NULL AND phs.scheduled_date < CURRENT_DATE) AS overdue_vacc,
      COUNT(*) FILTER (WHERE phs.schedule_type = 'deworming') AS sched_deworm,
      COUNT(*) FILTER (WHERE phs.schedule_type = 'deworming' AND phs.completed_date IS NOT NULL) AS comp_deworm
    FROM preventive_health_schedules phs
    INNER JOIN animals a ON phs.animal_id = a.id
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    WHERE phs.scheduled_date BETWEEN start_date AND end_date
  ),
  heat_stats AS (
    SELECT
      COUNT(*) AS heat_count,
      AVG(hr.cycle_length_days) AS avg_cycle
    FROM heat_records hr
    INNER JOIN animals a ON hr.animal_id = a.id
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    WHERE hr.observed_date BETWEEN start_date AND end_date
  ),
  optimal_window AS (
    SELECT COUNT(DISTINCT a.id) AS optimal_count
    FROM animals a
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    INNER JOIN heat_records hr ON hr.animal_id = a.id
    WHERE a.is_deleted = false
      AND a.exit_date IS NULL
      AND a.gender = 'female'
      AND hr.observed_date >= CURRENT_DATE - 21
      AND hr.observed_date <= CURRENT_DATE - 18
  ),
  exit_stats AS (
    SELECT
      COUNT(*) AS total_exits,
      COUNT(*) FILTER (WHERE a.exit_reason = 'sold') AS sold,
      COUNT(*) FILTER (WHERE a.exit_reason = 'died') AS died,
      COUNT(*) FILTER (WHERE a.exit_reason = 'culled') AS culled,
      COUNT(*) FILTER (WHERE a.exit_reason = 'transferred') AS transferred,
      COUNT(*) FILTER (WHERE a.exit_reason = 'slaughtered') AS slaughtered,
      COALESCE(SUM(a.sale_price) FILTER (WHERE a.exit_reason = 'sold'), 0) AS sales_revenue
    FROM animals a
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    WHERE a.exit_date BETWEEN start_date AND end_date
  ),
  bcs_stats AS (
    SELECT
      AVG(bcs.score) AS avg_score,
      COUNT(*) FILTER (WHERE bcs.score < 3) AS underweight,
      COUNT(*) FILTER (WHERE bcs.score >= 3 AND bcs.score <= 4) AS optimal,
      COUNT(*) FILTER (WHERE bcs.score > 4) AS overweight,
      COUNT(*) AS total_assessments
    FROM body_condition_scores bcs
    INNER JOIN filtered_farms ff ON bcs.farm_id = ff.id
    WHERE bcs.assessment_date BETWEEN start_date AND end_date
  )
  SELECT
    COALESCE(ps.sched_vacc, 0)::bigint,
    COALESCE(ps.comp_vacc, 0)::bigint,
    COALESCE(ps.overdue_vacc, 0)::bigint,
    COALESCE(ps.sched_deworm, 0)::bigint,
    COALESCE(ps.comp_deworm, 0)::bigint,
    CASE WHEN ps.sched_vacc > 0 THEN ROUND((ps.comp_vacc::numeric / ps.sched_vacc::numeric) * 100, 2) ELSE 0 END,
    COALESCE(hs.heat_count, 0)::bigint,
    COALESCE(ROUND(hs.avg_cycle::numeric, 1), 0),
    COALESCE(ow.optimal_count, 0)::bigint,
    COALESCE(es.total_exits, 0)::bigint,
    COALESCE(es.sold, 0)::bigint,
    COALESCE(es.died, 0)::bigint,
    COALESCE(es.culled, 0)::bigint,
    COALESCE(es.transferred, 0)::bigint,
    COALESCE(es.slaughtered, 0)::bigint,
    CASE WHEN total_active_animals > 0 THEN ROUND((es.died::numeric / total_active_animals::numeric) * 100, 2) ELSE 0 END,
    COALESCE(es.sales_revenue, 0)::numeric,
    COALESCE(ROUND(bs.avg_score::numeric, 2), 0),
    COALESCE(bs.underweight, 0)::bigint,
    COALESCE(bs.optimal, 0)::bigint,
    COALESCE(bs.overweight, 0)::bigint,
    COALESCE(bs.total_assessments, 0)::bigint
  FROM preventive_stats ps
  CROSS JOIN heat_stats hs
  CROSS JOIN optimal_window ow
  CROSS JOIN exit_stats es
  CROSS JOIN bcs_stats bs;
END;
$$;

-- ============================================
-- Update get_government_breeding_stats RPC
-- ============================================
CREATE OR REPLACE FUNCTION public.get_government_breeding_stats(
  start_date date,
  end_date date,
  region_filter text DEFAULT NULL,
  province_filter text DEFAULT NULL,
  municipality_filter text DEFAULT NULL,
  data_category_filter text DEFAULT 'live'
)
RETURNS TABLE (
  total_ai_scheduled bigint,
  total_ai_performed bigint,
  total_pregnancies_confirmed bigint,
  currently_pregnant bigint,
  ai_success_rate numeric,
  due_this_quarter bigint,
  cattle_success_rate numeric,
  goat_success_rate numeric,
  carabao_success_rate numeric,
  sheep_success_rate numeric,
  expected_deliveries_by_month jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_farms AS (
    SELECT f.id FROM farms f
    WHERE f.is_deleted = false
      AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
      AND (region_filter IS NULL OR f.region = region_filter)
      AND (province_filter IS NULL OR f.province = province_filter)
      AND (municipality_filter IS NULL OR f.municipality = municipality_filter)
  ),
  ai_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE air.scheduled_date IS NOT NULL) AS scheduled,
      COUNT(*) FILTER (WHERE air.performed_date IS NOT NULL) AS performed,
      COUNT(*) FILTER (WHERE air.pregnancy_confirmed = true) AS confirmed,
      COUNT(*) FILTER (WHERE air.pregnancy_confirmed = true AND air.performed_date IS NOT NULL) AS success_count,
      COUNT(*) FILTER (WHERE air.performed_date IS NOT NULL) AS total_performed
    FROM ai_records air
    INNER JOIN animals a ON air.animal_id = a.id
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    WHERE (air.scheduled_date BETWEEN start_date AND end_date)
       OR (air.performed_date BETWEEN start_date AND end_date)
  ),
  currently_pregnant_count AS (
    SELECT COUNT(DISTINCT a.id) AS pregnant_count
    FROM animals a
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    INNER JOIN ai_records air ON air.animal_id = a.id
    WHERE a.is_deleted = false
      AND a.exit_date IS NULL
      AND air.pregnancy_confirmed = true
      AND air.expected_delivery_date >= CURRENT_DATE
  ),
  due_quarter AS (
    SELECT COUNT(*) AS due_count
    FROM ai_records air
    INNER JOIN animals a ON air.animal_id = a.id
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    WHERE air.pregnancy_confirmed = true
      AND air.expected_delivery_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
  ),
  species_stats AS (
    SELECT
      a.livestock_type,
      COUNT(*) FILTER (WHERE air.pregnancy_confirmed = true) AS confirmed,
      COUNT(*) FILTER (WHERE air.performed_date IS NOT NULL) AS performed
    FROM ai_records air
    INNER JOIN animals a ON air.animal_id = a.id
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    WHERE air.performed_date BETWEEN start_date AND end_date
    GROUP BY a.livestock_type
  ),
  monthly_deliveries AS (
    SELECT
      TO_CHAR(air.expected_delivery_date, 'YYYY-MM') AS month,
      a.livestock_type,
      COUNT(*) AS delivery_count
    FROM ai_records air
    INNER JOIN animals a ON air.animal_id = a.id
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    WHERE air.pregnancy_confirmed = true
      AND air.expected_delivery_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '6 months'
    GROUP BY TO_CHAR(air.expected_delivery_date, 'YYYY-MM'), a.livestock_type
  ),
  deliveries_json AS (
    SELECT jsonb_object_agg(
      month,
      jsonb_build_object(
        'total', SUM(delivery_count),
        'by_type', jsonb_object_agg(livestock_type, delivery_count)
      )
    ) AS deliveries
    FROM monthly_deliveries
    GROUP BY month
  )
  SELECT
    COALESCE(ais.scheduled, 0)::bigint,
    COALESCE(ais.performed, 0)::bigint,
    COALESCE(ais.confirmed, 0)::bigint,
    COALESCE(cp.pregnant_count, 0)::bigint,
    CASE WHEN ais.total_performed > 0 THEN ROUND((ais.success_count::numeric / ais.total_performed::numeric) * 100, 2) ELSE 0 END,
    COALESCE(dq.due_count, 0)::bigint,
    COALESCE((SELECT CASE WHEN performed > 0 THEN ROUND((confirmed::numeric / performed::numeric) * 100, 2) ELSE 0 END FROM species_stats WHERE livestock_type = 'cattle'), 0),
    COALESCE((SELECT CASE WHEN performed > 0 THEN ROUND((confirmed::numeric / performed::numeric) * 100, 2) ELSE 0 END FROM species_stats WHERE livestock_type = 'goat'), 0),
    COALESCE((SELECT CASE WHEN performed > 0 THEN ROUND((confirmed::numeric / performed::numeric) * 100, 2) ELSE 0 END FROM species_stats WHERE livestock_type = 'carabao'), 0),
    COALESCE((SELECT CASE WHEN performed > 0 THEN ROUND((confirmed::numeric / performed::numeric) * 100, 2) ELSE 0 END FROM species_stats WHERE livestock_type = 'sheep'), 0),
    COALESCE((SELECT deliveries FROM deliveries_json LIMIT 1), '{}'::jsonb)
  FROM ai_stats ais
  CROSS JOIN currently_pregnant_count cp
  CROSS JOIN due_quarter dq;
END;
$$;

-- ============================================
-- Update gov_farm_analytics view to include data_category
-- ============================================
DROP VIEW IF EXISTS public.gov_farm_analytics;
CREATE VIEW public.gov_farm_analytics WITH (security_invoker = true) AS
SELECT 
  f.id,
  f.name,
  f.region,
  f.province,
  f.municipality,
  f.gps_lat,
  f.gps_lng,
  f.livestock_type,
  f.created_at,
  f.is_deleted,
  f.is_program_participant,
  f.program_group,
  f.data_category,
  COUNT(DISTINCT a.id) FILTER (WHERE a.is_deleted = false AND a.exit_date IS NULL) AS active_animal_count,
  COUNT(DISTINCT a.id) FILTER (WHERE a.livestock_type = 'cattle' AND a.is_deleted = false AND a.exit_date IS NULL) AS cattle_count,
  COUNT(DISTINCT a.id) FILTER (WHERE a.livestock_type = 'goat' AND a.is_deleted = false AND a.exit_date IS NULL) AS goat_count,
  COUNT(DISTINCT a.id) FILTER (WHERE a.livestock_type = 'carabao' AND a.is_deleted = false AND a.exit_date IS NULL) AS carabao_count,
  COUNT(DISTINCT a.id) FILTER (WHERE a.livestock_type = 'sheep' AND a.is_deleted = false AND a.exit_date IS NULL) AS sheep_count
FROM farms f
LEFT JOIN animals a ON a.farm_id = f.id
WHERE f.is_deleted = false
GROUP BY f.id, f.name, f.region, f.province, f.municipality, f.gps_lat, f.gps_lng, 
         f.livestock_type, f.created_at, f.is_deleted, f.is_program_participant, f.program_group, f.data_category;