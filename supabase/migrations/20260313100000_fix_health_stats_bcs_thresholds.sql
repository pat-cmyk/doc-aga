-- ============================================================================
-- Fix BCS thresholds in get_government_health_stats
-- ============================================================================
-- The BCS thresholds in the 20260305100000 migration used <3 / 3-4 / >4
-- but the component (BCSDistributionChart.tsx) displays <2.5 / 2.5-4.0 / >4.0
-- which matches industry standard for 1-5 BCS scale.
--
-- This migration re-declares the RPC with corrected thresholds.
-- It also ensures the deployed RPC matches the 21-column RETURNS TABLE
-- that the hook (useGovernmentHealthStats.ts) expects.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_government_health_stats(date, date, text, text, text, text);

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
  deaths_in_period bigint;
BEGIN
  -- Get total active animals for mortality calculation
  SELECT COUNT(DISTINCT a.id) INTO total_active_animals
  FROM farms f
  INNER JOIN animals a ON a.farm_id = f.id AND a.is_deleted = false AND a.exit_date IS NULL
  WHERE f.is_deleted = false
    AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
    AND (region_filter IS NULL OR f.region = region_filter)
    AND (province_filter IS NULL OR f.province = province_filter)
    AND (municipality_filter IS NULL OR f.municipality = municipality_filter);

  -- Get deaths in period for corrected mortality denominator
  SELECT COUNT(DISTINCT a.id) INTO deaths_in_period
  FROM farms f
  INNER JOIN animals a ON a.farm_id = f.id AND a.is_deleted = false
  WHERE f.is_deleted = false
    AND a.exit_date BETWEEN start_date AND end_date
    AND a.exit_reason IN ('died', 'slaughtered_emergency')
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
      -- FIX: Use industry-standard thresholds matching BCSDistributionChart.tsx
      COUNT(*) FILTER (WHERE bcs.score < 2.5) AS underweight,
      COUNT(*) FILTER (WHERE bcs.score >= 2.5 AND bcs.score <= 4.0) AS optimal,
      COUNT(*) FILTER (WHERE bcs.score > 4.0) AS overweight,
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
    CASE WHEN (total_active_animals + deaths_in_period) > 0
      THEN ROUND((es.died::numeric / (total_active_animals + deaths_in_period)::numeric) * 100, 2)
      ELSE 0
    END,
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
