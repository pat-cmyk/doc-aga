-- Drop and recreate get_government_breeding_stats with fixed nested aggregate issue
DROP FUNCTION IF EXISTS public.get_government_breeding_stats(DATE, DATE, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_government_breeding_stats(
  start_date DATE,
  end_date DATE,
  region_filter TEXT DEFAULT NULL,
  province_filter TEXT DEFAULT NULL,
  municipality_filter TEXT DEFAULT NULL,
  data_category_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_ai_scheduled BIGINT,
  total_ai_performed BIGINT,
  total_pregnancies_confirmed BIGINT,
  currently_pregnant BIGINT,
  ai_success_rate NUMERIC,
  due_this_quarter BIGINT,
  cattle_success_rate NUMERIC,
  goat_success_rate NUMERIC,
  carabao_success_rate NUMERIC,
  sheep_success_rate NUMERIC,
  expected_deliveries_by_month JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_row RECORD;
BEGIN
  -- Build the main stats
  WITH filtered_farms AS (
    SELECT f.id, f.livestock_type
    FROM farms f
    WHERE f.is_deleted = false
      AND (region_filter IS NULL OR f.region = region_filter)
      AND (province_filter IS NULL OR f.province = province_filter)
      AND (municipality_filter IS NULL OR f.municipality = municipality_filter)
      AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
  ),
  filtered_animals AS (
    SELECT a.id, a.livestock_type, a.farm_id
    FROM animals a
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    WHERE a.is_deleted = false
  ),
  ai_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE ai.scheduled_date IS NOT NULL) as scheduled_count,
      COUNT(*) FILTER (WHERE ai.performed_date IS NOT NULL) as performed_count,
      COUNT(*) FILTER (WHERE ai.pregnancy_confirmed = true) as confirmed_count,
      COUNT(*) FILTER (WHERE ai.pregnancy_confirmed = true AND ai.expected_delivery_date > CURRENT_DATE) as currently_pregnant_count,
      COUNT(*) FILTER (WHERE ai.expected_delivery_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days') as due_quarter
    FROM ai_records ai
    INNER JOIN filtered_animals fa ON ai.animal_id = fa.id
    WHERE (ai.scheduled_date BETWEEN start_date AND end_date)
       OR (ai.performed_date BETWEEN start_date AND end_date)
  ),
  species_success AS (
    SELECT
      fa.livestock_type,
      COUNT(*) FILTER (WHERE ai.performed_date IS NOT NULL) as performed,
      COUNT(*) FILTER (WHERE ai.pregnancy_confirmed = true) as confirmed
    FROM ai_records ai
    INNER JOIN filtered_animals fa ON ai.animal_id = fa.id
    WHERE ai.performed_date BETWEEN start_date AND end_date
    GROUP BY fa.livestock_type
  ),
  -- Step 1: Aggregate by month and livestock type
  delivery_by_month_type AS (
    SELECT
      TO_CHAR(ai.expected_delivery_date, 'YYYY-MM') as month,
      fa.livestock_type,
      COUNT(*) as delivery_count
    FROM ai_records ai
    INNER JOIN filtered_animals fa ON ai.animal_id = fa.id
    WHERE ai.pregnancy_confirmed = true
      AND ai.expected_delivery_date BETWEEN start_date AND end_date + INTERVAL '9 months'
    GROUP BY TO_CHAR(ai.expected_delivery_date, 'YYYY-MM'), fa.livestock_type
  ),
  -- Step 2: Calculate monthly totals separately
  monthly_totals AS (
    SELECT month, SUM(delivery_count) as total
    FROM delivery_by_month_type
    GROUP BY month
  ),
  -- Step 3: Build by_type JSON per month
  monthly_by_type AS (
    SELECT month, jsonb_object_agg(livestock_type, delivery_count) as by_type
    FROM delivery_by_month_type
    GROUP BY month
  ),
  -- Step 4: Combine totals and by_type without nesting aggregates
  monthly_combined AS (
    SELECT 
      mt.month,
      jsonb_build_object('total', mt.total, 'by_type', COALESCE(mbt.by_type, '{}'::jsonb)) as month_data
    FROM monthly_totals mt
    LEFT JOIN monthly_by_type mbt ON mt.month = mbt.month
  ),
  -- Step 5: Final aggregation
  deliveries_json AS (
    SELECT COALESCE(jsonb_object_agg(month, month_data), '{}'::jsonb) as result
    FROM monthly_combined
  )
  SELECT
    COALESCE(ai_stats.scheduled_count, 0),
    COALESCE(ai_stats.performed_count, 0),
    COALESCE(ai_stats.confirmed_count, 0),
    COALESCE(ai_stats.currently_pregnant_count, 0),
    CASE 
      WHEN COALESCE(ai_stats.performed_count, 0) > 0 
      THEN ROUND((COALESCE(ai_stats.confirmed_count, 0)::NUMERIC / ai_stats.performed_count) * 100, 1)
      ELSE 0 
    END,
    COALESCE(ai_stats.due_quarter, 0),
    COALESCE((SELECT CASE WHEN performed > 0 THEN ROUND((confirmed::NUMERIC / performed) * 100, 1) ELSE 0 END FROM species_success WHERE livestock_type = 'cattle'), 0),
    COALESCE((SELECT CASE WHEN performed > 0 THEN ROUND((confirmed::NUMERIC / performed) * 100, 1) ELSE 0 END FROM species_success WHERE livestock_type = 'goat'), 0),
    COALESCE((SELECT CASE WHEN performed > 0 THEN ROUND((confirmed::NUMERIC / performed) * 100, 1) ELSE 0 END FROM species_success WHERE livestock_type = 'carabao'), 0),
    COALESCE((SELECT CASE WHEN performed > 0 THEN ROUND((confirmed::NUMERIC / performed) * 100, 1) ELSE 0 END FROM species_success WHERE livestock_type = 'sheep'), 0),
    COALESCE(dj.result, '{}'::jsonb)
  INTO 
    total_ai_scheduled,
    total_ai_performed,
    total_pregnancies_confirmed,
    currently_pregnant,
    ai_success_rate,
    due_this_quarter,
    cattle_success_rate,
    goat_success_rate,
    carabao_success_rate,
    sheep_success_rate,
    expected_deliveries_by_month
  FROM ai_stats, deliveries_json dj;

  RETURN NEXT;
END;
$$;

-- Drop and recreate get_government_health_stats with fixed column references
DROP FUNCTION IF EXISTS public.get_government_health_stats(DATE, DATE, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_government_health_stats(
  start_date DATE,
  end_date DATE,
  region_filter TEXT DEFAULT NULL,
  province_filter TEXT DEFAULT NULL,
  municipality_filter TEXT DEFAULT NULL,
  data_category_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  vaccination_count BIGINT,
  vaccination_rate NUMERIC,
  deworming_count BIGINT,
  deworming_rate NUMERIC,
  heat_detection_count BIGINT,
  avg_cycle_length NUMERIC,
  optimal_breeding_window_count BIGINT,
  mortality_count BIGINT,
  mortality_rate NUMERIC,
  avg_bcs NUMERIC,
  animals_underweight BIGINT,
  animals_optimal BIGINT,
  animals_overweight BIGINT,
  bcs_assessments_count BIGINT
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
  filtered_animals AS (
    SELECT a.id, a.farm_id
    FROM animals a
    INNER JOIN filtered_farms ff ON a.farm_id = ff.id
    WHERE a.is_deleted = false
  ),
  total_animal_count AS (
    SELECT COUNT(*) as cnt FROM filtered_animals
  ),
  -- Vaccination stats from preventive_health_schedules
  vaccination_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE phs.status = 'completed') as completed,
      COUNT(*) as total
    FROM preventive_health_schedules phs
    INNER JOIN filtered_animals fa ON phs.animal_id = fa.id
    WHERE phs.schedule_type = 'vaccination'
      AND phs.scheduled_date BETWEEN start_date AND end_date
  ),
  -- Deworming stats from preventive_health_schedules
  deworming_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE phs.status = 'completed') as completed,
      COUNT(*) as total
    FROM preventive_health_schedules phs
    INNER JOIN filtered_animals fa ON phs.animal_id = fa.id
    WHERE phs.schedule_type = 'deworming'
      AND phs.scheduled_date BETWEEN start_date AND end_date
  ),
  -- Heat detection stats with dynamic cycle length calculation
  heat_stats AS (
    SELECT COUNT(*) as heat_count
    FROM heat_records hr
    INNER JOIN filtered_farms ff ON hr.farm_id = ff.id
    WHERE hr.detected_at::DATE BETWEEN start_date AND end_date
  ),
  -- Calculate cycle length from consecutive heat events using LAG
  heat_intervals AS (
    SELECT 
      hr.animal_id,
      hr.detected_at,
      LAG(hr.detected_at) OVER (PARTITION BY hr.animal_id ORDER BY hr.detected_at) as prev_heat
    FROM heat_records hr
    INNER JOIN filtered_farms ff ON hr.farm_id = ff.id
    WHERE hr.detected_at::DATE BETWEEN start_date - INTERVAL '60 days' AND end_date
  ),
  avg_cycle AS (
    SELECT AVG(EXTRACT(EPOCH FROM (detected_at - prev_heat)) / 86400) as avg_days
    FROM heat_intervals
    WHERE prev_heat IS NOT NULL
      AND EXTRACT(EPOCH FROM (detected_at - prev_heat)) / 86400 BETWEEN 15 AND 30
  ),
  -- Optimal breeding window count
  optimal_breeding AS (
    SELECT COUNT(*) as cnt
    FROM heat_records hr
    INNER JOIN filtered_farms ff ON hr.farm_id = ff.id
    WHERE hr.optimal_breeding_start IS NOT NULL
      AND hr.optimal_breeding_start::DATE BETWEEN start_date AND end_date
  ),
  -- Mortality stats from animal exits
  mortality_stats AS (
    SELECT COUNT(*) as death_count
    FROM filtered_animals fa
    INNER JOIN animals a ON fa.id = a.id
    WHERE a.exit_reason = 'died'
      AND a.exit_date BETWEEN start_date AND end_date
  ),
  -- BCS stats
  bcs_stats AS (
    SELECT
      AVG(bcs.score) as avg_score,
      COUNT(*) FILTER (WHERE bcs.score < 2.5) as underweight,
      COUNT(*) FILTER (WHERE bcs.score >= 2.5 AND bcs.score <= 3.5) as optimal,
      COUNT(*) FILTER (WHERE bcs.score > 3.5) as overweight,
      COUNT(*) as total_assessments
    FROM body_condition_scores bcs
    INNER JOIN filtered_animals fa ON bcs.animal_id = fa.id
    WHERE bcs.assessment_date BETWEEN start_date AND end_date
  )
  SELECT
    COALESCE(vs.completed, 0)::BIGINT,
    CASE WHEN COALESCE(vs.total, 0) > 0 
      THEN ROUND((vs.completed::NUMERIC / vs.total) * 100, 1) 
      ELSE 0 
    END,
    COALESCE(ds.completed, 0)::BIGINT,
    CASE WHEN COALESCE(ds.total, 0) > 0 
      THEN ROUND((ds.completed::NUMERIC / ds.total) * 100, 1) 
      ELSE 0 
    END,
    COALESCE(hs.heat_count, 0)::BIGINT,
    COALESCE(ROUND(ac.avg_days, 1), 0),
    COALESCE(ob.cnt, 0)::BIGINT,
    COALESCE(ms.death_count, 0)::BIGINT,
    CASE WHEN COALESCE(tac.cnt, 0) > 0 
      THEN ROUND((ms.death_count::NUMERIC / tac.cnt) * 100, 2) 
      ELSE 0 
    END,
    COALESCE(ROUND(bcs.avg_score, 2), 0),
    COALESCE(bcs.underweight, 0)::BIGINT,
    COALESCE(bcs.optimal, 0)::BIGINT,
    COALESCE(bcs.overweight, 0)::BIGINT,
    COALESCE(bcs.total_assessments, 0)::BIGINT
  FROM vaccination_stats vs
  CROSS JOIN deworming_stats ds
  CROSS JOIN heat_stats hs
  CROSS JOIN avg_cycle ac
  CROSS JOIN optimal_breeding ob
  CROSS JOIN mortality_stats ms
  CROSS JOIN total_animal_count tac
  CROSS JOIN bcs_stats bcs;
END;
$$;