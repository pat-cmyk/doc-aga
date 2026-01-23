-- Update get_combined_dashboard_data to use unified weight-based feed consumption calculation
-- This aligns the dashboard with the Feed Forecast module for consistent feed requirement estimates
-- Formula: Daily Fresh Forage = (Body Weight × DM%) / 0.30 where DM% varies by life stage

CREATE OR REPLACE FUNCTION public.get_combined_dashboard_data(
  p_farm_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_monthly_start_date DATE,
  p_monthly_end_date DATE
)
RETURNS JSONB
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
  v_daily_milk JSONB;
  v_stage_counts JSONB;
  v_monthly_data JSONB;
  v_stage_keys TEXT[];
  v_feed_stock_days INTEGER;
  v_concentrate_kg NUMERIC;
  v_roughage_kg NUMERIC;
  v_total_feed_kg NUMERIC;
  v_concentrate_days INTEGER;
  v_roughage_days INTEGER;
  v_daily_concentrate_consumption NUMERIC;
  v_daily_roughage_consumption NUMERIC;
  v_total_daily_fresh_forage NUMERIC;
  v_feed_breakdown JSONB;
BEGIN
  SELECT COUNT(*) INTO v_total_animals
  FROM animals
  WHERE farm_id = p_farm_id AND is_deleted = false;

  SELECT
    COALESCE(SUM(CASE
      WHEN category IN ('concentrates', 'minerals', 'supplements') THEN quantity_kg
      ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN category = 'roughage' OR category IS NULL THEN quantity_kg
      ELSE 0
    END), 0),
    COALESCE(SUM(quantity_kg), 0)
  INTO v_concentrate_kg, v_roughage_kg, v_total_feed_kg
  FROM feed_inventory
  WHERE farm_id = p_farm_id;

  WITH animal_consumption AS (
    SELECT 
      SUM(
        COALESCE(current_weight_kg, 
          COALESCE(entry_weight_kg,
            COALESCE(birth_weight_kg,
              CASE 
                WHEN livestock_type = 'cattle' THEN 400
                WHEN livestock_type = 'carabao' THEN 350
                WHEN livestock_type = 'goat' THEN 40
                WHEN livestock_type = 'sheep' THEN 50
                ELSE 400
              END
            )
          )
        )
        * CASE
            WHEN milking_stage IS NOT NULL AND milking_stage != 'Dry Period' THEN 0.035
            WHEN life_stage IN ('Calf', 'Bull Calf') THEN 0.030
            WHEN life_stage IN ('Heifer Calf', 'Breeding Heifer', 'Young Bull') THEN 0.025
            WHEN life_stage IN ('Pregnant Heifer', 'Mature Cow', 'Dry Period') THEN 0.020
            WHEN life_stage = 'Mature Bull' OR (gender = 'male' AND life_stage NOT IN ('Calf', 'Bull Calf', 'Young Bull')) THEN 0.025
            ELSE 0.022
          END
        / 0.30
      ) as total_daily_fresh
    FROM animals
    WHERE farm_id = p_farm_id AND is_deleted = false AND exit_date IS NULL
  )
  SELECT 
    COALESCE(total_daily_fresh, 0),
    COALESCE(total_daily_fresh * 0.3, 0),
    COALESCE(total_daily_fresh * 0.7, 0)
  INTO v_total_daily_fresh_forage, v_daily_concentrate_consumption, v_daily_roughage_consumption
  FROM animal_consumption;

  v_concentrate_days := CASE 
    WHEN v_daily_concentrate_consumption > 0 THEN FLOOR(v_concentrate_kg / v_daily_concentrate_consumption)::INTEGER
    ELSE NULL 
  END;
  
  v_roughage_days := CASE 
    WHEN v_daily_roughage_consumption > 0 THEN FLOOR(v_roughage_kg / v_daily_roughage_consumption)::INTEGER
    ELSE NULL 
  END;

  v_feed_stock_days := v_roughage_days;

  v_feed_breakdown := jsonb_build_object(
    'concentrateDays', v_concentrate_days,
    'roughageDays', v_roughage_days,
    'concentrateKg', v_concentrate_kg,
    'roughageKg', v_roughage_kg,
    'totalKg', v_total_feed_kg,
    'dailyConcentrateConsumption', ROUND(v_daily_concentrate_consumption::numeric, 1),
    'dailyRoughageConsumption', ROUND(v_daily_roughage_consumption::numeric, 1),
    'totalDailyConsumption', ROUND(v_total_daily_fresh_forage::numeric, 1),
    'calculationMethod', 'weight-based-dm'
  );

  SELECT COALESCE(AVG(total_milk_liters), 0) INTO v_avg_daily_milk
  FROM daily_farm_stats
  WHERE farm_id = p_farm_id
    AND stat_date >= p_start_date
    AND stat_date <= p_end_date;

  SELECT COUNT(DISTINCT animal_id) INTO v_pregnant_count
  FROM ai_records ar
  JOIN animals a ON ar.animal_id = a.id
  WHERE a.farm_id = p_farm_id
    AND ar.pregnancy_confirmed = true;

  SELECT COUNT(DISTINCT animal_id) INTO v_pending_confirmation
  FROM ai_records ar
  JOIN animals a ON ar.animal_id = a.id
  WHERE a.farm_id = p_farm_id
    AND ar.pregnancy_confirmed = false
    AND ar.performed_date IS NOT NULL;

  SELECT COUNT(*) INTO v_recent_health_events
  FROM health_records hr
  JOIN animals a ON hr.animal_id = a.id
  WHERE a.farm_id = p_farm_id
    AND hr.visit_date >= p_start_date;

  SELECT COALESCE(jsonb_object_agg(stat_date::text, total_milk_liters), '{}'::jsonb)
  INTO v_daily_milk
  FROM daily_farm_stats
  WHERE farm_id = p_farm_id
    AND stat_date >= p_start_date
    AND stat_date <= p_end_date;

  WITH stage_data AS (
    SELECT 
      COALESCE(life_stage, 'Unknown') as stage,
      COUNT(*) as count
    FROM animals
    WHERE farm_id = p_farm_id AND is_deleted = false
    GROUP BY life_stage
  )
  SELECT 
    COALESCE(jsonb_object_agg(stage, count), '{}'::jsonb),
    COALESCE(array_agg(stage ORDER BY stage), ARRAY[]::text[])
  INTO v_stage_counts, v_stage_keys
  FROM stage_data;

  WITH monthly_stats AS (
    SELECT 
      to_char(stat_date, 'Mon') as month,
      EXTRACT(MONTH FROM stat_date) as month_num,
      MAX(COALESCE((stage_counts->>'total')::int, 0)) as headcount
    FROM daily_farm_stats
    WHERE farm_id = p_farm_id
      AND stat_date >= p_monthly_start_date
      AND stat_date <= p_monthly_end_date
    GROUP BY to_char(stat_date, 'Mon'), EXTRACT(MONTH FROM stat_date)
    ORDER BY month_num
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('month', month, 'headcount', headcount)), '[]'::jsonb)
  INTO v_monthly_data
  FROM monthly_stats;

  RETURN jsonb_build_object(
    'stats', jsonb_build_object(
      'totalAnimals', v_total_animals,
      'feedStockDays', v_feed_stock_days,
      'feedStockBreakdown', v_feed_breakdown,
      'avgDailyMilk', v_avg_daily_milk,
      'pregnantCount', v_pregnant_count,
      'pendingConfirmation', v_pending_confirmation,
      'recentHealthEvents', v_recent_health_events
    ),
    'dailyMilk', v_daily_milk,
    'stageCounts', v_stage_counts,
    'monthlyData', v_monthly_data,
    'stageKeys', v_stage_keys
  );
END;
$$;