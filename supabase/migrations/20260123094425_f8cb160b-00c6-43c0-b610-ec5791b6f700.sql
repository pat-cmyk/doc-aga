-- Fix get_combined_dashboard_data RPC to return correct monthlyData structure
-- The frontend expects {monthDate: "2026-01-22", stageCounts: {...}} but RPC returns {month: "Jan", headcount: 0}

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
  v_total_animals integer;
  v_pregnant_count integer;
  v_pending_confirmation integer;
  v_recent_health_events integer;
  v_avg_daily_milk numeric;
  v_feed_stock_days integer;
  v_daily_data jsonb;
  v_monthly_data jsonb;
  v_stage_keys jsonb;
  v_concentrate_kg numeric := 0;
  v_roughage_kg numeric := 0;
  v_daily_concentrate_consumption numeric := 0;
  v_daily_roughage_consumption numeric := 0;
  v_concentrate_days integer := 0;
  v_roughage_days integer := 0;
  v_total_daily_consumption numeric := 0;
  v_feed_breakdown jsonb;
BEGIN
  -- Get total active animals
  SELECT COUNT(*)
  INTO v_total_animals
  FROM animals
  WHERE farm_id = p_farm_id AND is_deleted = false;

  -- Get pregnant count (confirmed pregnancies)
  SELECT COUNT(DISTINCT ai.animal_id)
  INTO v_pregnant_count
  FROM ai_records ai
  JOIN animals a ON ai.animal_id = a.id
  WHERE a.farm_id = p_farm_id
    AND a.is_deleted = false
    AND ai.pregnancy_confirmed = true
    AND (ai.expected_delivery_date IS NULL OR ai.expected_delivery_date > CURRENT_DATE);

  -- Get pending confirmation count (AI performed but not confirmed)
  SELECT COUNT(DISTINCT ai.animal_id)
  INTO v_pending_confirmation
  FROM ai_records ai
  JOIN animals a ON ai.animal_id = a.id
  WHERE a.farm_id = p_farm_id
    AND a.is_deleted = false
    AND ai.performed_date IS NOT NULL
    AND ai.pregnancy_confirmed IS NULL;

  -- Get recent health events (last 30 days)
  SELECT COUNT(*)
  INTO v_recent_health_events
  FROM health_records hr
  JOIN animals a ON hr.animal_id = a.id
  WHERE a.farm_id = p_farm_id
    AND hr.visit_date >= CURRENT_DATE - INTERVAL '30 days';

  -- Get average daily milk from daily_farm_stats
  SELECT COALESCE(AVG(total_milk_liters), 0)
  INTO v_avg_daily_milk
  FROM daily_farm_stats
  WHERE farm_id = p_farm_id
    AND stat_date >= p_start_date
    AND stat_date <= p_end_date;

  -- Calculate feed stock using weight-based consumption
  SELECT 
    COALESCE(SUM(CASE WHEN LOWER(category) = 'concentrate' THEN quantity_kg ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN LOWER(category) = 'roughage' THEN quantity_kg ELSE 0 END), 0)
  INTO v_concentrate_kg, v_roughage_kg
  FROM feed_inventory
  WHERE farm_id = p_farm_id;

  -- Calculate daily consumption based on animal weights and life stages
  SELECT COALESCE(SUM(
    CASE 
      WHEN a.current_weight_kg IS NOT NULL AND a.current_weight_kg > 0 THEN
        -- Calculate fresh forage based on dry matter percentage by life stage
        -- Formula: (Body Weight × DM%) / 0.30 (converting DM to fresh weight)
        CASE 
          WHEN a.milking_stage IN ('early', 'mid', 'late') THEN 
            (a.current_weight_kg * 0.035) / 0.30  -- Lactating: 3.5% DM
          WHEN a.life_stage = 'calf' THEN 
            (a.current_weight_kg * 0.030) / 0.30  -- Calves: 3.0% DM
          WHEN a.life_stage IN ('weaner', 'yearling', 'growing') THEN 
            (a.current_weight_kg * 0.025) / 0.30  -- Growing: 2.5% DM
          ELSE 
            (a.current_weight_kg * 0.020) / 0.30  -- Maintenance: 2.0% DM
        END
      ELSE 
        -- Fallback for animals without weight: estimate 8kg/day
        8.0
    END
  ), 0)
  INTO v_total_daily_consumption
  FROM animals a
  WHERE a.farm_id = p_farm_id AND a.is_deleted = false;

  -- Split consumption: 30% concentrate, 70% roughage
  v_daily_concentrate_consumption := v_total_daily_consumption * 0.30;
  v_daily_roughage_consumption := v_total_daily_consumption * 0.70;

  -- Calculate days of stock remaining
  IF v_daily_concentrate_consumption > 0 THEN
    v_concentrate_days := FLOOR(v_concentrate_kg / v_daily_concentrate_consumption);
  END IF;
  
  IF v_daily_roughage_consumption > 0 THEN
    v_roughage_days := FLOOR(v_roughage_kg / v_daily_roughage_consumption);
  END IF;

  -- Feed stock days is based on roughage (limiting factor)
  v_feed_stock_days := v_roughage_days;

  -- Build feed breakdown object
  v_feed_breakdown := jsonb_build_object(
    'concentrateDays', v_concentrate_days,
    'roughageDays', v_roughage_days,
    'concentrateKg', ROUND(v_concentrate_kg::numeric, 1),
    'roughageKg', ROUND(v_roughage_kg::numeric, 1),
    'totalKg', ROUND((v_concentrate_kg + v_roughage_kg)::numeric, 1),
    'dailyConcentrateConsumption', ROUND(v_daily_concentrate_consumption::numeric, 1),
    'dailyRoughageConsumption', ROUND(v_daily_roughage_consumption::numeric, 1),
    'totalDailyConsumption', ROUND(v_total_daily_consumption::numeric, 1),
    'calculationMethod', 'weight-based-dm'
  );

  -- Get daily data with milk totals and stage counts
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date', stat_date::text,
      'milkTotal', total_milk_liters,
      'stageCounts', stage_counts
    ) ORDER BY stat_date
  ), '[]'::jsonb)
  INTO v_daily_data
  FROM daily_farm_stats
  WHERE farm_id = p_farm_id
    AND stat_date >= p_start_date
    AND stat_date <= p_end_date;

  -- Get monthly data - use last day of each month with full stageCounts
  WITH monthly_last_days AS (
    SELECT 
      stat_date,
      stage_counts,
      ROW_NUMBER() OVER (
        PARTITION BY date_trunc('month', stat_date) 
        ORDER BY stat_date DESC
      ) as rn
    FROM daily_farm_stats
    WHERE farm_id = p_farm_id
      AND stat_date >= p_monthly_start_date
      AND stat_date <= p_monthly_end_date
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'monthDate', stat_date::text,
      'stageCounts', stage_counts
    ) ORDER BY stat_date
  ), '[]'::jsonb)
  INTO v_monthly_data
  FROM monthly_last_days
  WHERE rn = 1;

  -- Get unique stage keys from the data
  WITH all_stages AS (
    SELECT DISTINCT jsonb_object_keys(stage_counts) as stage_key
    FROM daily_farm_stats
    WHERE farm_id = p_farm_id
      AND stat_date >= p_monthly_start_date
      AND stat_date <= p_monthly_end_date
  )
  SELECT COALESCE(jsonb_agg(stage_key ORDER BY stage_key), '[]'::jsonb)
  INTO v_stage_keys
  FROM all_stages;

  -- Return combined result
  RETURN jsonb_build_object(
    'stats', jsonb_build_object(
      'totalAnimals', v_total_animals,
      'feedStockDays', v_feed_stock_days,
      'feedStockBreakdown', v_feed_breakdown,
      'avgDailyMilk', ROUND(v_avg_daily_milk::numeric, 1),
      'pregnantCount', v_pregnant_count,
      'pendingConfirmation', v_pending_confirmation,
      'recentHealthEvents', v_recent_health_events
    ),
    'dailyData', v_daily_data,
    'monthlyData', v_monthly_data,
    'stageKeys', v_stage_keys
  );
END;
$$;