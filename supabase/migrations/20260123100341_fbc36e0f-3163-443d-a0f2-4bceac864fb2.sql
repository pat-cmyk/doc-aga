-- Fix Feed Stock SSOT: Category matching, Weight fallback, Roughage-only headline
-- Drop existing function first to allow return type change
DROP FUNCTION IF EXISTS public.get_combined_dashboard_data(UUID, DATE, DATE, DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_combined_dashboard_data(
  p_farm_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_monthly_start_date DATE,
  p_monthly_end_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_animals INTEGER;
  v_avg_daily_milk NUMERIC;
  v_pregnant_count INTEGER;
  v_pending_confirmation INTEGER;
  v_recent_health_events INTEGER;
  v_feed_stock_days INTEGER;
  v_feed_stock_breakdown JSON;
  v_daily_data JSON;
  v_monthly_data JSON;
  v_stage_keys JSON;
  v_roughage_kg NUMERIC;
  v_concentrate_kg NUMERIC;
  v_total_daily_consumption NUMERIC;
  v_roughage_days INTEGER;
  v_concentrate_days INTEGER;
  v_animal_count INTEGER;
  v_daily_roughage_need NUMERIC;
  v_daily_concentrate_need NUMERIC;
BEGIN
  -- 1. Total active animals
  SELECT COUNT(*) INTO v_total_animals
  FROM animals
  WHERE farm_id = p_farm_id AND is_deleted = FALSE AND exit_date IS NULL;

  -- 2. Average daily milk (last 7 days from daily_farm_stats or milking_records)
  SELECT COALESCE(AVG(total_milk_liters), 0) INTO v_avg_daily_milk
  FROM daily_farm_stats
  WHERE farm_id = p_farm_id AND stat_date >= (CURRENT_DATE - INTERVAL '7 days');

  IF v_avg_daily_milk = 0 THEN
    SELECT COALESCE(AVG(daily_total), 0) INTO v_avg_daily_milk
    FROM (
      SELECT DATE(record_datetime) as milk_date, SUM(liters) as daily_total
      FROM milking_records mr
      JOIN animals a ON mr.animal_id = a.id
      WHERE a.farm_id = p_farm_id AND mr.record_datetime >= (CURRENT_DATE - INTERVAL '7 days')
      GROUP BY DATE(record_datetime)
    ) daily_totals;
  END IF;

  -- 3. Pregnancy counts
  SELECT COUNT(*) INTO v_pregnant_count
  FROM ai_records ar
  JOIN animals a ON ar.animal_id = a.id
  WHERE a.farm_id = p_farm_id AND a.is_deleted = FALSE AND a.exit_date IS NULL
    AND ar.pregnancy_confirmed = TRUE;

  SELECT COUNT(*) INTO v_pending_confirmation
  FROM ai_records ar
  JOIN animals a ON ar.animal_id = a.id
  WHERE a.farm_id = p_farm_id AND a.is_deleted = FALSE AND a.exit_date IS NULL
    AND ar.pregnancy_confirmed IS NULL AND ar.performed_date IS NOT NULL;

  -- 4. Recent health events (last 30 days)
  SELECT COUNT(*) INTO v_recent_health_events
  FROM health_records hr
  JOIN animals a ON hr.animal_id = a.id
  WHERE a.farm_id = p_farm_id AND hr.visit_date >= (CURRENT_DATE - INTERVAL '30 days');

  -- 5. Feed stock calculation with PROPER category matching and weight fallback
  -- Get inventory totals (FIX: use 'concentrates' plural and case-insensitive)
  SELECT 
    COALESCE(SUM(CASE WHEN LOWER(category) = 'roughage' THEN quantity_kg ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN LOWER(category) IN ('concentrates', 'concentrate', 'minerals', 'supplements') THEN quantity_kg ELSE 0 END), 0)
  INTO v_roughage_kg, v_concentrate_kg
  FROM feed_inventory
  WHERE farm_id = p_farm_id AND quantity_kg > 0;

  -- Calculate daily consumption using PROPER weight fallback chain: current → entry → birth → default
  -- Formula: Fresh Forage = (Weight × DM%) / 0.30
  -- Then split: Roughage = Fresh × 0.70, Concentrate = Fresh × 0.30
  SELECT 
    COUNT(*),
    COALESCE(SUM(
      (
        COALESCE(
          NULLIF(a.current_weight_kg, 0),
          NULLIF(a.entry_weight_kg, 0),
          NULLIF(a.birth_weight_kg, 0),
          CASE LOWER(a.livestock_type)
            WHEN 'cattle' THEN 400
            WHEN 'carabao' THEN 350
            WHEN 'goat' THEN 40
            WHEN 'sheep' THEN 50
            ELSE 400
          END
        ) *
        CASE
          -- Lactating animals: 3.5% DM
          WHEN LOWER(COALESCE(a.milking_stage, '')) IN ('early', 'mid', 'late', 'peak') THEN 0.035
          -- Dry cows: 2.0% DM
          WHEN LOWER(COALESCE(a.milking_stage, '')) = 'dry' THEN 0.020
          -- Growing animals: 2.5% DM
          WHEN LOWER(COALESCE(a.life_stage, '')) IN ('calf', 'weaner', 'yearling heifer', 'yearling bull', 'growing bull', 'doeling', 'buckling', 'kid') THEN 0.025
          -- Breeding/mature: 3.0% DM
          WHEN LOWER(COALESCE(a.life_stage, '')) IN ('breeding heifer', 'breeding bull', 'mature cow', 'mature bull', 'doe', 'buck') THEN 0.030
          -- Default for unknown: 2.2% DM (conservative)
          ELSE 0.022
        END
      ) / 0.30  -- Convert DM to Fresh Forage
    ), 0)
  INTO v_animal_count, v_total_daily_consumption
  FROM animals a
  WHERE a.farm_id = p_farm_id AND a.is_deleted = FALSE AND a.exit_date IS NULL;

  -- Calculate daily needs by category (70/30 split)
  v_daily_roughage_need := v_total_daily_consumption * 0.70;
  v_daily_concentrate_need := v_total_daily_consumption * 0.30;

  -- Calculate days of stock for each category
  IF v_daily_roughage_need > 0 THEN
    v_roughage_days := FLOOR(v_roughage_kg / v_daily_roughage_need);
  ELSE
    v_roughage_days := NULL;
  END IF;

  IF v_daily_concentrate_need > 0 THEN
    v_concentrate_days := FLOOR(v_concentrate_kg / v_daily_concentrate_need);
  ELSE
    v_concentrate_days := NULL;
  END IF;

  -- HEADLINE: Use roughage-only days (survival buffer as per user preference)
  v_feed_stock_days := v_roughage_days;

  -- Build detailed breakdown for tooltip
  v_feed_stock_breakdown := json_build_object(
    'concentrateDays', v_concentrate_days,
    'roughageDays', v_roughage_days,
    'concentrateKg', ROUND(v_concentrate_kg::NUMERIC, 1),
    'roughageKg', ROUND(v_roughage_kg::NUMERIC, 1),
    'totalKg', ROUND((v_concentrate_kg + v_roughage_kg)::NUMERIC, 1),
    'dailyConcentrateConsumption', ROUND(v_daily_concentrate_need::NUMERIC, 2),
    'dailyRoughageConsumption', ROUND(v_daily_roughage_need::NUMERIC, 2),
    'dailyFreshForageKg', ROUND(v_total_daily_consumption::NUMERIC, 2),
    'animalCount', v_animal_count,
    'calculationMethod', 'weight-based-dm-coalesce'
  );

  -- 6. Daily data for charts
  SELECT json_agg(daily_row ORDER BY daily_row->>'date') INTO v_daily_data
  FROM (
    SELECT json_build_object(
      'date', d.stat_date::TEXT,
      'milkTotal', COALESCE(d.total_milk_liters, 0),
      'stageCounts', COALESCE(d.stage_counts, '{}'::JSON)
    ) as daily_row
    FROM daily_farm_stats d
    WHERE d.farm_id = p_farm_id AND d.stat_date BETWEEN p_start_date AND p_end_date
  ) daily_rows;

  -- 7. Monthly data for headcount chart
  SELECT json_agg(monthly_row ORDER BY monthly_row->>'monthDate') INTO v_monthly_data
  FROM (
    SELECT json_build_object(
      'monthDate', DATE_TRUNC('month', d.stat_date)::DATE::TEXT,
      'stageCounts', COALESCE(
        (SELECT json_object_agg(key, value) FROM json_each(d.stage_counts)),
        '{}'::JSON
      )
    ) as monthly_row
    FROM daily_farm_stats d
    WHERE d.farm_id = p_farm_id AND d.stat_date BETWEEN p_monthly_start_date AND p_monthly_end_date
    AND d.stat_date = (
      SELECT MAX(d2.stat_date)
      FROM daily_farm_stats d2
      WHERE d2.farm_id = p_farm_id
        AND DATE_TRUNC('month', d2.stat_date) = DATE_TRUNC('month', d.stat_date)
    )
  ) monthly_rows;

  -- 8. Collect all unique stage keys
  SELECT json_agg(DISTINCT stage_key) INTO v_stage_keys
  FROM (
    SELECT json_object_keys(stage_counts) as stage_key
    FROM daily_farm_stats
    WHERE farm_id = p_farm_id AND stat_date BETWEEN p_start_date AND p_end_date
  ) keys;

  -- Return combined result
  RETURN json_build_object(
    'stats', json_build_object(
      'totalAnimals', v_total_animals,
      'avgDailyMilk', ROUND(v_avg_daily_milk::NUMERIC, 1),
      'pregnantCount', v_pregnant_count,
      'pendingConfirmation', v_pending_confirmation,
      'recentHealthEvents', v_recent_health_events,
      'feedStockDays', v_feed_stock_days,
      'feedStockBreakdown', v_feed_stock_breakdown
    ),
    'dailyData', COALESCE(v_daily_data, '[]'::JSON),
    'monthlyData', COALESCE(v_monthly_data, '[]'::JSON),
    'stageKeys', COALESCE(v_stage_keys, '[]'::JSON)
  );
END;
$$;