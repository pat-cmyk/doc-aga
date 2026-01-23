-- Fix get_combined_dashboard_data: use correct column name milking_records.record_date (not record_datetime)
-- Also preserves the approved SSOT feed-stock logic (category matching, weight fallback, roughage-only headline)

DROP FUNCTION IF EXISTS public.get_combined_dashboard_data(uuid, date, date, date, date);

CREATE OR REPLACE FUNCTION public.get_combined_dashboard_data(
  p_farm_id uuid,
  p_start_date date,
  p_end_date date,
  p_monthly_start_date date,
  p_monthly_end_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_stats jsonb;
  v_daily_data jsonb;
  v_monthly_data jsonb;
  v_stage_keys jsonb;
  v_total_animals int;
  v_avg_daily_milk numeric;
  v_pregnant_count int;
  v_pending_confirmation int;
  v_recent_health_events int;
  v_roughage_kg numeric := 0;
  v_concentrate_kg numeric := 0;
  v_daily_fresh_forage_kg numeric := 0;
  v_daily_roughage_need_kg numeric := 0;
  v_daily_concentrate_need_kg numeric := 0;
  v_roughage_days int;
  v_concentrate_days int;
  v_feed_stock_days int;
  v_animal_count int := 0;
BEGIN
  -- Count active animals
  SELECT COUNT(*) INTO v_total_animals
  FROM animals
  WHERE farm_id = p_farm_id 
    AND is_deleted = false 
    AND exit_date IS NULL;

  -- Calculate average daily milk (last 7 days) - FIXED: use record_date not record_datetime
  SELECT COALESCE(AVG(daily_total), 0) INTO v_avg_daily_milk
  FROM (
    SELECT SUM(mr.liters) as daily_total
    FROM milking_records mr
    JOIN animals a ON mr.animal_id = a.id
    WHERE a.farm_id = p_farm_id
      AND a.is_deleted = false
      AND mr.record_date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY mr.record_date
  ) daily_totals;

  -- Count pregnant animals
  SELECT COUNT(*) INTO v_pregnant_count
  FROM animals a
  WHERE a.farm_id = p_farm_id
    AND a.is_deleted = false
    AND a.exit_date IS NULL
    AND EXISTS (
      SELECT 1 FROM ai_records ar
      WHERE ar.animal_id = a.id
        AND ar.pregnancy_confirmed = true
        AND (ar.expected_delivery_date IS NULL OR ar.expected_delivery_date > CURRENT_DATE)
    );

  -- Count pending confirmation
  SELECT COUNT(*) INTO v_pending_confirmation
  FROM animals a
  WHERE a.farm_id = p_farm_id
    AND a.is_deleted = false
    AND a.exit_date IS NULL
    AND EXISTS (
      SELECT 1 FROM ai_records ar
      WHERE ar.animal_id = a.id
        AND ar.pregnancy_confirmed IS NULL
        AND ar.performed_date IS NOT NULL
        AND ar.performed_date > CURRENT_DATE - INTERVAL '60 days'
    );

  -- Count recent health events (last 30 days)
  SELECT COUNT(*) INTO v_recent_health_events
  FROM health_records hr
  JOIN animals a ON hr.animal_id = a.id
  WHERE a.farm_id = p_farm_id
    AND hr.visit_date >= CURRENT_DATE - INTERVAL '30 days';

  -- Calculate feed inventory by category (SSOT: category field is authoritative)
  SELECT 
    COALESCE(SUM(CASE WHEN LOWER(COALESCE(category, 'roughage')) = 'roughage' THEN quantity_kg ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN LOWER(COALESCE(category, 'roughage')) IN ('concentrates', 'concentrate', 'minerals', 'supplements') THEN quantity_kg ELSE 0 END), 0)
  INTO v_roughage_kg, v_concentrate_kg
  FROM feed_inventory
  WHERE farm_id = p_farm_id;

  -- Calculate daily consumption using weight-based dry matter intake with fallback chain
  -- Weight fallback: current_weight_kg → entry_weight_kg → birth_weight_kg → species default
  -- DM% based on life_stage/milking_stage, Fresh forage = DM intake / 0.30
  SELECT 
    COUNT(*),
    COALESCE(SUM(
      (
        COALESCE(NULLIF(a.current_weight_kg, 0), NULLIF(a.entry_weight_kg, 0), NULLIF(a.birth_weight_kg, 0),
          CASE a.livestock_type
            WHEN 'cattle' THEN 400
            WHEN 'carabao' THEN 450
            WHEN 'goat' THEN 40
            ELSE 400
          END
        )
        * 
        CASE 
          WHEN a.life_stage = 'calf' OR a.life_stage = 'kid' THEN 0.03
          WHEN a.life_stage = 'heifer' OR a.life_stage = 'doeling' THEN 0.025
          WHEN a.milking_stage IN ('early', 'peak') THEN 0.035
          WHEN a.milking_stage = 'mid' THEN 0.03
          WHEN a.milking_stage IN ('late', 'dry') THEN 0.025
          WHEN a.gender = 'male' THEN 0.02
          ELSE 0.025
        END
      ) / 0.30
    ), 0)
  INTO v_animal_count, v_daily_fresh_forage_kg
  FROM animals a
  WHERE a.farm_id = p_farm_id 
    AND a.is_deleted = false 
    AND a.exit_date IS NULL;

  -- Calculate roughage/concentrate needs (70/30 split)
  v_daily_roughage_need_kg := v_daily_fresh_forage_kg * 0.70;
  v_daily_concentrate_need_kg := v_daily_fresh_forage_kg * 0.30;

  -- Calculate days of stock
  IF v_daily_roughage_need_kg > 0 THEN
    v_roughage_days := FLOOR(v_roughage_kg / v_daily_roughage_need_kg);
  ELSE
    v_roughage_days := NULL;
  END IF;

  IF v_daily_concentrate_need_kg > 0 THEN
    v_concentrate_days := FLOOR(v_concentrate_kg / v_daily_concentrate_need_kg);
  ELSE
    v_concentrate_days := NULL;
  END IF;

  -- Headline metric: roughage-only days (survival buffer)
  v_feed_stock_days := v_roughage_days;

  -- Build stats object
  v_stats := jsonb_build_object(
    'totalAnimals', v_total_animals,
    'avgDailyMilk', ROUND(v_avg_daily_milk::numeric, 1),
    'pregnantCount', v_pregnant_count,
    'pendingConfirmation', v_pending_confirmation,
    'recentHealthEvents', v_recent_health_events,
    'feedStockDays', v_feed_stock_days,
    'feedStockBreakdown', jsonb_build_object(
      'roughageKg', ROUND(v_roughage_kg::numeric, 1),
      'concentrateKg', ROUND(v_concentrate_kg::numeric, 1),
      'roughageDays', v_roughage_days,
      'concentrateDays', v_concentrate_days,
      'animalCount', v_animal_count,
      'dailyFreshForageKg', ROUND(v_daily_fresh_forage_kg::numeric, 1),
      'dailyRoughageNeedKg', ROUND(v_daily_roughage_need_kg::numeric, 1),
      'dailyConcentrateNeedKg', ROUND(v_daily_concentrate_need_kg::numeric, 1),
      'calculationMethod', 'weight-based-dm-coalesce'
    )
  );

  -- Get daily milk data - FIXED: use record_date not record_datetime
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date', d.milk_date::text,
      'milkTotal', COALESCE(d.total_liters, 0)
    ) ORDER BY d.milk_date
  ), '[]'::jsonb) INTO v_daily_data
  FROM (
    SELECT 
      mr.record_date as milk_date,
      SUM(mr.liters) as total_liters
    FROM milking_records mr
    JOIN animals a ON mr.animal_id = a.id
    WHERE a.farm_id = p_farm_id
      AND a.is_deleted = false
      AND mr.record_date >= p_start_date
      AND mr.record_date <= p_end_date
    GROUP BY mr.record_date
  ) d;

  -- Get monthly headcount data
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'monthDate', dfs.stat_date::text,
      'stageCounts', dfs.stage_counts
    ) ORDER BY dfs.stat_date
  ), '[]'::jsonb) INTO v_monthly_data
  FROM daily_farm_stats dfs
  WHERE dfs.farm_id = p_farm_id
    AND dfs.stat_date >= p_monthly_start_date
    AND dfs.stat_date <= p_monthly_end_date;

  -- Get unique stage keys
  SELECT COALESCE(jsonb_agg(DISTINCT stage_key), '[]'::jsonb) INTO v_stage_keys
  FROM (
    SELECT jsonb_object_keys(stage_counts) as stage_key
    FROM daily_farm_stats
    WHERE farm_id = p_farm_id
      AND stat_date >= p_monthly_start_date
  ) keys;

  -- Build final result
  v_result := jsonb_build_object(
    'stats', v_stats,
    'dailyData', v_daily_data,
    'monthlyData', v_monthly_data,
    'stageKeys', v_stage_keys
  );

  RETURN v_result;
END;
$$;