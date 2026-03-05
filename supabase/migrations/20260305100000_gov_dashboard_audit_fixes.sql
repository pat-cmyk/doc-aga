-- ============================================================================
-- Government Dashboard Audit Fixes
-- ============================================================================
-- Fixes identified during comprehensive government dashboard audit:
--
-- 1. Restore comprehensive get_government_health_stats with proper RETURNS TABLE
--    (the 20260204114033 migration overwrote the comprehensive version from
--     20260204112600 with a simplified one, losing exit breakdown, vaccination
--     breakdown, deworming stats, and BCS detail columns)
--
-- 2. Fix mortality rate denominator: use (active + deaths_in_period) instead
--    of active-only, which artificially inflates the rate
--
-- 3. Fix get_government_stats: add a.is_deleted = false to health_stats CTE
--    (currently counts health events for soft-deleted animals)
--
-- 4. Fix get_government_milk_analytics: use mr.record_date instead of
--    mr.milking_date (column doesn't exist — record_date is the actual column)
--
-- 5. Fix get_farm_compliance_metrics: same milking_date → record_date fix
-- ============================================================================

-- ============================================================================
-- FIX 1+2: Restore comprehensive get_government_health_stats
-- ============================================================================
-- Drop the simplified version (from 20260204114033) so we can recreate with
-- the comprehensive RETURNS TABLE from 20260204112600, plus mortality fix.

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
  -- Mortality rate = deaths / (active_now + deaths_in_period)
  -- This avoids inflating the rate by excluding dead animals from denominator
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
    -- FIX: mortality denominator = active + deaths_in_period (not active-only)
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


-- ============================================================================
-- FIX 3: get_government_stats — add is_deleted filter to health_stats CTE
-- ============================================================================

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
      AND a.is_deleted = false  -- FIX: exclude deleted animals from health event count
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


-- ============================================================================
-- FIX 4: get_government_milk_analytics — milking_date → record_date
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_government_milk_analytics(
  start_date DATE,
  end_date DATE,
  region_filter TEXT DEFAULT NULL,
  province_filter TEXT DEFAULT NULL,
  municipality_filter TEXT DEFAULT NULL,
  data_category_filter TEXT DEFAULT 'live'
)
RETURNS TABLE (
  report_date DATE,
  cattle_milk_liters NUMERIC,
  goat_milk_liters NUMERIC,
  carabao_milk_liters NUMERIC,
  total_milk_liters NUMERIC,
  cattle_farms_milking BIGINT,
  goat_farms_milking BIGINT,
  carabao_farms_milking BIGINT,
  avg_cattle_price NUMERIC,
  avg_goat_price NUMERIC,
  avg_carabao_price NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has government role
  IF NOT has_role(auth.uid(), 'government'::user_role) THEN
    RAISE EXCEPTION 'Access denied: government role required';
  END IF;

  RETURN QUERY
  WITH daily_milk AS (
    SELECT
      mr.record_date AS report_date,  -- FIX: was mr.milking_date (column doesn't exist)
      a.livestock_type,
      SUM(mr.liters) AS total_liters,
      COUNT(DISTINCT f.id) AS farms_milking,
      AVG(mr.price_per_liter) FILTER (WHERE mr.price_per_liter > 0) AS avg_price
    FROM milking_records mr
    JOIN animals a ON mr.animal_id = a.id
    JOIN farms f ON a.farm_id = f.id
    WHERE mr.record_date >= start_date  -- FIX: was mr.milking_date
      AND mr.record_date <= end_date    -- FIX: was mr.milking_date
      AND a.is_deleted = false
      AND f.is_deleted = false
      AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
      AND (region_filter IS NULL OR f.region = region_filter)
      AND (province_filter IS NULL OR f.province = province_filter)
      AND (municipality_filter IS NULL OR f.municipality = municipality_filter)
    GROUP BY mr.record_date, a.livestock_type  -- FIX: was mr.milking_date
  )
  SELECT
    dm.report_date,
    COALESCE(SUM(dm.total_liters) FILTER (WHERE dm.livestock_type = 'cattle'), 0) AS cattle_milk_liters,
    COALESCE(SUM(dm.total_liters) FILTER (WHERE dm.livestock_type = 'goat'), 0) AS goat_milk_liters,
    COALESCE(SUM(dm.total_liters) FILTER (WHERE dm.livestock_type = 'carabao'), 0) AS carabao_milk_liters,
    COALESCE(SUM(dm.total_liters), 0) AS total_milk_liters,
    COALESCE(SUM(dm.farms_milking) FILTER (WHERE dm.livestock_type = 'cattle'), 0) AS cattle_farms_milking,
    COALESCE(SUM(dm.farms_milking) FILTER (WHERE dm.livestock_type = 'goat'), 0) AS goat_farms_milking,
    COALESCE(SUM(dm.farms_milking) FILTER (WHERE dm.livestock_type = 'carabao'), 0) AS carabao_farms_milking,
    AVG(dm.avg_price) FILTER (WHERE dm.livestock_type = 'cattle') AS avg_cattle_price,
    AVG(dm.avg_price) FILTER (WHERE dm.livestock_type = 'goat') AS avg_goat_price,
    AVG(dm.avg_price) FILTER (WHERE dm.livestock_type = 'carabao') AS avg_carabao_price
  FROM daily_milk dm
  GROUP BY dm.report_date
  ORDER BY dm.report_date;
END;
$$;


-- ============================================================================
-- FIX 5: get_farm_compliance_metrics — milking_date → record_date
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_farm_compliance_metrics(
  start_date DATE,
  end_date DATE,
  region_filter TEXT DEFAULT NULL,
  province_filter TEXT DEFAULT NULL,
  data_category_filter TEXT DEFAULT 'live'
)
RETURNS TABLE (
  region TEXT,
  province TEXT,
  total_farms BIGINT,
  farms_with_milking_logs BIGINT,
  farms_with_feeding_logs BIGINT,
  farms_with_health_logs BIGINT,
  avg_milking_completion NUMERIC,
  avg_feeding_completion NUMERIC,
  high_compliance_farms BIGINT,
  low_compliance_farms BIGINT,
  compliance_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has government role
  IF NOT has_role(auth.uid(), 'government'::user_role) THEN
    RAISE EXCEPTION 'Access denied: government role required';
  END IF;

  RETURN QUERY
  WITH farm_activity AS (
    SELECT
      f.id AS farm_id,
      f.region,
      f.province,
      -- Count distinct dates with milking logs
      (SELECT COUNT(DISTINCT mr.record_date)  -- FIX: was mr.milking_date
       FROM milking_records mr
       JOIN animals a ON mr.animal_id = a.id
       WHERE a.farm_id = f.id
         AND mr.record_date >= start_date     -- FIX: was mr.milking_date
         AND mr.record_date <= end_date) AS milking_days,  -- FIX: was mr.milking_date
      -- Count distinct dates with feeding logs
      (SELECT COUNT(DISTINCT DATE(fr.record_datetime))
       FROM feeding_records fr
       JOIN animals a ON fr.animal_id = a.id
       WHERE a.farm_id = f.id
         AND fr.record_datetime >= start_date
         AND fr.record_datetime <= end_date) AS feeding_days,
      -- Count health logs
      (SELECT COUNT(*)
       FROM health_records hr
       JOIN animals a ON hr.animal_id = a.id
       WHERE a.farm_id = f.id
         AND hr.check_date >= start_date
         AND hr.check_date <= end_date) AS health_logs,
      -- Total days in range
      (end_date - start_date + 1) AS total_days
    FROM farms f
    WHERE f.is_deleted = false
      AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
      AND (region_filter IS NULL OR f.region = region_filter)
      AND (province_filter IS NULL OR f.province = province_filter)
  )
  SELECT
    fa.region,
    fa.province,
    COUNT(DISTINCT fa.farm_id) AS total_farms,
    COUNT(DISTINCT fa.farm_id) FILTER (WHERE fa.milking_days > 0) AS farms_with_milking_logs,
    COUNT(DISTINCT fa.farm_id) FILTER (WHERE fa.feeding_days > 0) AS farms_with_feeding_logs,
    COUNT(DISTINCT fa.farm_id) FILTER (WHERE fa.health_logs > 0) AS farms_with_health_logs,
    AVG(CASE WHEN fa.total_days > 0 THEN (fa.milking_days::NUMERIC / fa.total_days) * 100 ELSE 0 END) AS avg_milking_completion,
    AVG(CASE WHEN fa.total_days > 0 THEN (fa.feeding_days::NUMERIC / fa.total_days) * 100 ELSE 0 END) AS avg_feeding_completion,
    COUNT(DISTINCT fa.farm_id) FILTER (
      WHERE fa.total_days > 0 AND ((fa.milking_days + fa.feeding_days)::NUMERIC / (fa.total_days * 2)) >= 0.7
    ) AS high_compliance_farms,
    COUNT(DISTINCT fa.farm_id) FILTER (
      WHERE fa.total_days > 0 AND ((fa.milking_days + fa.feeding_days)::NUMERIC / (fa.total_days * 2)) < 0.3
    ) AS low_compliance_farms,
    CASE WHEN COUNT(DISTINCT fa.farm_id) > 0
      THEN (COUNT(DISTINCT fa.farm_id) FILTER (
        WHERE fa.total_days > 0 AND ((fa.milking_days + fa.feeding_days)::NUMERIC / (fa.total_days * 2)) >= 0.5
      )::NUMERIC / COUNT(DISTINCT fa.farm_id)) * 100
      ELSE 0 END AS compliance_rate
  FROM farm_activity fa
  GROUP BY fa.region, fa.province
  ORDER BY fa.region, fa.province;
END;
$$;
