-- Drop existing function first to change its structure
DROP FUNCTION IF EXISTS public.get_combined_dashboard_data(UUID, DATE, DATE, DATE, DATE);

-- Update get_combined_dashboard_data to compute feedStockDays from ROUGHAGE ONLY
-- Rationale: Livestock can survive on roughage alone but not concentrates alone.
-- feedStockDays now represents the survival buffer, not optimal nutrition.

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
  v_feed_breakdown JSONB;
BEGIN
  -- Get total animals
  SELECT COUNT(*) INTO v_total_animals
  FROM animals
  WHERE farm_id = p_farm_id AND is_deleted = false;

  -- Get feed inventory with category-based classification
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

  -- Calculate daily consumption based on livestock type
  -- Cattle: 12kg/day, Carabao: 10kg/day, Goat: 1.5kg/day, Sheep: 2kg/day
  -- Roughage typically 70% of diet, concentrates 30%
  WITH animal_consumption AS (
    SELECT 
      COALESCE(SUM(
        CASE 
          WHEN livestock_type = 'cattle' THEN 12
          WHEN livestock_type = 'carabao' THEN 10
          WHEN livestock_type = 'goat' THEN 1.5
          WHEN livestock_type = 'sheep' THEN 2
          ELSE 10
        END
      ), 0) as total_daily
    FROM animals
    WHERE farm_id = p_farm_id AND is_deleted = false
  )
  SELECT 
    total_daily * 0.3, -- 30% concentrates
    total_daily * 0.7  -- 70% roughage
  INTO v_daily_concentrate_consumption, v_daily_roughage_consumption
  FROM animal_consumption;

  -- Calculate days remaining for each category
  v_concentrate_days := CASE 
    WHEN v_daily_concentrate_consumption > 0 THEN FLOOR(v_concentrate_kg / v_daily_concentrate_consumption)::INTEGER
    ELSE NULL 
  END;
  
  v_roughage_days := CASE 
    WHEN v_daily_roughage_consumption > 0 THEN FLOOR(v_roughage_kg / v_daily_roughage_consumption)::INTEGER
    ELSE NULL 
  END;

  -- CRITICAL: Feed stock days is based on ROUGHAGE ONLY
  -- Livestock can survive on roughage alone but cannot survive on concentrates alone
  v_feed_stock_days := v_roughage_days;

  -- Build feed breakdown for tooltip display
  v_feed_breakdown := jsonb_build_object(
    'concentrateDays', v_concentrate_days,
    'roughageDays', v_roughage_days,
    'concentrateKg', v_concentrate_kg,
    'roughageKg', v_roughage_kg,
    'totalKg', v_total_feed_kg,
    'dailyConcentrateConsumption', v_daily_concentrate_consumption,
    'dailyRoughageConsumption', v_daily_roughage_consumption
  );

  -- Get average daily milk from daily_farm_stats
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
    AND ar.pregnancy_confirmed = true;

  -- Get pending confirmation count
  SELECT COUNT(DISTINCT animal_id) INTO v_pending_confirmation
  FROM ai_records ar
  JOIN animals a ON ar.animal_id = a.id
  WHERE a.farm_id = p_farm_id
    AND ar.pregnancy_confirmed = false
    AND ar.performed_date IS NOT NULL;

  -- Get recent health events
  SELECT COUNT(*) INTO v_recent_health_events
  FROM health_records hr
  JOIN animals a ON hr.animal_id = a.id
  WHERE a.farm_id = p_farm_id
    AND hr.visit_date >= p_start_date;

  -- Get daily milk data
  SELECT COALESCE(jsonb_object_agg(stat_date::text, total_milk_liters), '{}'::jsonb)
  INTO v_daily_milk
  FROM daily_farm_stats
  WHERE farm_id = p_farm_id
    AND stat_date >= p_start_date
    AND stat_date <= p_end_date;

  -- Get stage counts
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

  -- Get monthly headcount data
  WITH monthly_stats AS (
    SELECT 
      to_char(stat_date, 'Mon') as month,
      EXTRACT(MONTH FROM stat_date) as month_num,
      MAX(active_animal_count) as headcount
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