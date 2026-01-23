-- Fix get_combined_dashboard_data RPC to use case-insensitive stage matching
-- This ensures lactating animals correctly get 3.5% DM rate instead of falling through to 2.0%

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
  v_total_animals integer;
  v_avg_daily_milk numeric;
  v_pregnant_count integer;
  v_pending_confirmation integer;
  v_recent_health_events integer;
  v_feed_stock_days numeric;
  v_feed_stock_breakdown jsonb;
  v_total_roughage_kg numeric;
  v_total_concentrate_kg numeric;
  v_total_daily_consumption numeric;
  v_daily_roughage_need numeric;
  v_daily_concentrate_need numeric;
  v_roughage_days numeric;
  v_concentrate_days numeric;
BEGIN
  -- Get total active animals
  SELECT COUNT(*) INTO v_total_animals
  FROM animals
  WHERE farm_id = p_farm_id AND is_deleted = false;

  -- Get average daily milk for the period
  SELECT COALESCE(AVG(total_milk_liters), 0) INTO v_avg_daily_milk
  FROM daily_farm_stats
  WHERE farm_id = p_farm_id
    AND stat_date >= p_start_date
    AND stat_date <= p_end_date;

  -- Get pregnant count
  SELECT COUNT(DISTINCT animal_id) INTO v_pregnant_count
  FROM ai_records ar
  JOIN animals a ON ar.animal_id = a.id
  WHERE a.farm_id = p_farm_id
    AND ar.pregnancy_confirmed = true
    AND a.is_deleted = false;

  -- Get pending confirmations
  SELECT COUNT(DISTINCT animal_id) INTO v_pending_confirmation
  FROM ai_records ar
  JOIN animals a ON ar.animal_id = a.id
  WHERE a.farm_id = p_farm_id
    AND ar.pregnancy_confirmed IS NULL
    AND ar.performed_date IS NOT NULL
    AND a.is_deleted = false;

  -- Get recent health events
  SELECT COUNT(*) INTO v_recent_health_events
  FROM health_records hr
  JOIN animals a ON hr.animal_id = a.id
  WHERE a.farm_id = p_farm_id
    AND hr.visit_date >= p_start_date
    AND hr.visit_date <= p_end_date;

  -- Calculate feed inventory totals by category
  SELECT 
    COALESCE(SUM(CASE WHEN LOWER(category) = 'roughage' THEN quantity_kg ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN LOWER(category) = 'concentrate' THEN quantity_kg ELSE 0 END), 0)
  INTO v_total_roughage_kg, v_total_concentrate_kg
  FROM feed_inventory
  WHERE farm_id = p_farm_id;

  -- Calculate total daily consumption using weight-based DM formula with CASE-INSENSITIVE matching
  SELECT COALESCE(SUM(
    CASE 
      WHEN a.current_weight_kg IS NOT NULL AND a.current_weight_kg > 0 THEN
        CASE 
          -- Lactating animals (any milking_stage except Dry Period): 3.5% DM
          WHEN a.milking_stage IS NOT NULL 
               AND a.milking_stage NOT ILIKE '%Dry%Period%' 
               AND a.milking_stage != '' THEN 
            (a.current_weight_kg * 0.035) / 0.30
          
          -- Dry period: 2.0% DM
          WHEN a.milking_stage ILIKE '%Dry%Period%' THEN 
            (a.current_weight_kg * 0.020) / 0.30
          
          -- Calves/Kids/Lambs: 3.0% DM
          WHEN a.life_stage ILIKE '%Calf%' 
               OR a.life_stage ILIKE '%Kid%' 
               OR a.life_stage ILIKE '%Lamb%' THEN 
            (a.current_weight_kg * 0.030) / 0.30
          
          -- Growing animals (yearlings, heifers, young bulls, etc.): 2.5% DM
          WHEN a.life_stage ILIKE '%Yearling%' 
               OR a.life_stage ILIKE '%Heifer%'
               OR a.life_stage ILIKE '%Young%Bull%'
               OR a.life_stage ILIKE '%Doeling%'
               OR a.life_stage ILIKE '%Buckling%' THEN 
            (a.current_weight_kg * 0.025) / 0.30
          
          -- Maintenance/other: 2.0% DM
          ELSE 
            (a.current_weight_kg * 0.020) / 0.30
        END
      ELSE 
        -- Fallback for animals without weight: use livestock-type defaults
        CASE a.livestock_type
          WHEN 'cattle' THEN (400 * 0.022) / 0.30
          WHEN 'carabao' THEN (350 * 0.022) / 0.30
          WHEN 'goat' THEN (40 * 0.022) / 0.30
          WHEN 'sheep' THEN (50 * 0.022) / 0.30
          ELSE (400 * 0.022) / 0.30
        END
    END
  ), 0)
  INTO v_total_daily_consumption
  FROM animals a
  WHERE a.farm_id = p_farm_id AND a.is_deleted = false;

  -- Calculate daily needs using 70/30 roughage/concentrate split
  v_daily_roughage_need := v_total_daily_consumption * 0.70;
  v_daily_concentrate_need := v_total_daily_consumption * 0.30;

  -- Calculate days of stock for each category
  IF v_daily_roughage_need > 0 THEN
    v_roughage_days := v_total_roughage_kg / v_daily_roughage_need;
  ELSE
    v_roughage_days := NULL;
  END IF;

  IF v_daily_concentrate_need > 0 THEN
    v_concentrate_days := v_total_concentrate_kg / v_daily_concentrate_need;
  ELSE
    v_concentrate_days := NULL;
  END IF;

  -- Feed stock days is the minimum of roughage and concentrate days
  IF v_roughage_days IS NOT NULL AND v_concentrate_days IS NOT NULL THEN
    v_feed_stock_days := LEAST(v_roughage_days, v_concentrate_days);
  ELSIF v_roughage_days IS NOT NULL THEN
    v_feed_stock_days := v_roughage_days;
  ELSIF v_concentrate_days IS NOT NULL THEN
    v_feed_stock_days := v_concentrate_days;
  ELSE
    v_feed_stock_days := NULL;
  END IF;

  -- Build feed stock breakdown for tooltip
  v_feed_stock_breakdown := jsonb_build_object(
    'totalRoughageKg', ROUND(v_total_roughage_kg::numeric, 1),
    'totalConcentrateKg', ROUND(v_total_concentrate_kg::numeric, 1),
    'dailyFreshForageKg', ROUND(v_total_daily_consumption::numeric, 1),
    'dailyRoughageNeedKg', ROUND(v_daily_roughage_need::numeric, 1),
    'dailyConcentrateNeedKg', ROUND(v_daily_concentrate_need::numeric, 1),
    'roughageDays', CASE WHEN v_roughage_days IS NOT NULL THEN ROUND(v_roughage_days::numeric, 1) ELSE NULL END,
    'concentrateDays', CASE WHEN v_concentrate_days IS NOT NULL THEN ROUND(v_concentrate_days::numeric, 1) ELSE NULL END,
    'calculationMethod', 'weight-based-dm'
  );

  -- Build stats object
  v_stats := jsonb_build_object(
    'totalAnimals', v_total_animals,
    'avgDailyMilk', ROUND(v_avg_daily_milk::numeric, 1),
    'pregnantCount', v_pregnant_count,
    'pendingConfirmation', v_pending_confirmation,
    'recentHealthEvents', v_recent_health_events,
    'feedStockDays', CASE WHEN v_feed_stock_days IS NOT NULL THEN ROUND(v_feed_stock_days::numeric, 1) ELSE NULL END,
    'feedStockBreakdown', v_feed_stock_breakdown
  );

  -- Get daily data with milk totals and stage counts
  WITH daily_stats AS (
    SELECT 
      stat_date::text as date,
      total_milk_liters as "milkTotal",
      stage_counts as "stageCounts"
    FROM daily_farm_stats
    WHERE farm_id = p_farm_id
      AND stat_date >= p_start_date
      AND stat_date <= p_end_date
    ORDER BY stat_date
  )
  SELECT COALESCE(jsonb_agg(row_to_json(daily_stats)::jsonb), '[]'::jsonb)
  INTO v_daily_data
  FROM daily_stats;

  -- Get monthly data aggregated by month (last day of each month)
  WITH monthly_stats AS (
    SELECT 
      (date_trunc('month', stat_date) + interval '1 month' - interval '1 day')::date::text as "monthDate",
      stage_counts as "stageCounts"
    FROM daily_farm_stats
    WHERE farm_id = p_farm_id
      AND stat_date >= p_monthly_start_date
      AND stat_date <= p_monthly_end_date
      AND stat_date = (
        SELECT MAX(d2.stat_date)
        FROM daily_farm_stats d2
        WHERE d2.farm_id = p_farm_id
          AND date_trunc('month', d2.stat_date) = date_trunc('month', daily_farm_stats.stat_date)
      )
    ORDER BY stat_date
  )
  SELECT COALESCE(jsonb_agg(row_to_json(monthly_stats)::jsonb), '[]'::jsonb)
  INTO v_monthly_data
  FROM monthly_stats;

  -- Get all unique stage keys from the farm's animals
  WITH stage_keys AS (
    SELECT DISTINCT life_stage as stage
    FROM animals
    WHERE farm_id = p_farm_id AND is_deleted = false AND life_stage IS NOT NULL
  )
  SELECT COALESCE(jsonb_agg(stage), '[]'::jsonb)
  INTO v_stage_keys
  FROM stage_keys;

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