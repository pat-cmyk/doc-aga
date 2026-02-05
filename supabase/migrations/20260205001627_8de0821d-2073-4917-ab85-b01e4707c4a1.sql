
-- Add unique_semen_count to get_government_breeding_stats RPC
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
  expected_deliveries_by_month JSONB,
  unique_semen_count BIGINT
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
      COUNT(*) FILTER (WHERE ai.expected_delivery_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days') as due_quarter,
      COUNT(DISTINCT ai.semen_code) FILTER (WHERE ai.semen_code IS NOT NULL) as semen_count
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
    COALESCE(dj.result, '{}'::jsonb),
    COALESCE(ai_stats.semen_count, 0)
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
    expected_deliveries_by_month,
    unique_semen_count
  FROM ai_stats, deliveries_json dj;

  RETURN NEXT;
END;
$$;
