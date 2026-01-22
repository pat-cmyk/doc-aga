-- Add feed stock breakdown by category (Concentrates vs Roughage) to get_combined_dashboard_data
CREATE OR REPLACE FUNCTION public.get_combined_dashboard_data(
  p_farm_id uuid, 
  p_start_date date, 
  p_end_date date, 
  p_monthly_start_date date, 
  p_monthly_end_date date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
  v_stats JSON;
  v_daily_data JSON;
  v_monthly_data JSON;
  v_stage_keys TEXT[];
  v_today_milk NUMERIC;
  v_today_stage_counts JSONB;
  v_has_today_in_stats BOOLEAN;
  v_animal_count INTEGER;
  v_feed_stock_days INTEGER;
  v_feed_breakdown JSONB;
  v_concentrate_kg NUMERIC;
  v_roughage_kg NUMERIC;
  v_daily_concentrate_consumption NUMERIC;
  v_daily_roughage_consumption NUMERIC;
BEGIN
  -- Verify access
  IF NOT can_access_farm(p_farm_id) THEN
    RAISE EXCEPTION 'Access denied to farm';
  END IF;

  -- Get animal count (used for multiple calculations)
  SELECT COUNT(*)::INTEGER INTO v_animal_count
  FROM animals 
  WHERE farm_id = p_farm_id AND is_deleted = false AND exit_date IS NULL;

  -- Calculate feed consumption rates by livestock type
  -- Concentrate rates: cattle=3kg, carabao=2.5kg, goat=0.3kg, sheep=0.3kg
  -- Roughage rates: cattle=12kg, carabao=10kg, goat=1.5kg, sheep=2kg
  SELECT 
    COALESCE(SUM(CASE livestock_type
      WHEN 'cattle' THEN 3.0
      WHEN 'carabao' THEN 2.5
      WHEN 'goat' THEN 0.3
      WHEN 'sheep' THEN 0.3
      ELSE 1.5
    END), 0),
    COALESCE(SUM(CASE livestock_type
      WHEN 'cattle' THEN 12.0
      WHEN 'carabao' THEN 10.0
      WHEN 'goat' THEN 1.5
      WHEN 'sheep' THEN 2.0
      ELSE 5.0
    END), 0)
  INTO v_daily_concentrate_consumption, v_daily_roughage_consumption
  FROM animals
  WHERE farm_id = p_farm_id AND is_deleted = false AND exit_date IS NULL;

  -- Calculate feed stock by category
  -- Concentrates: bran, corn, mineral, pellet, grower, concentrate
  -- Roughage: everything else (silage, hay, napier, roughage, etc.)
  SELECT 
    COALESCE(SUM(CASE 
      WHEN LOWER(feed_type) SIMILAR TO '%(concentrate|bran|corn|mineral|pellet|grower|premix|urea|molasses)%' 
        THEN quantity_kg 
      ELSE 0 
    END), 0),
    COALESCE(SUM(CASE 
      WHEN LOWER(feed_type) NOT SIMILAR TO '%(concentrate|bran|corn|mineral|pellet|grower|premix|urea|molasses)%' 
        THEN quantity_kg 
      ELSE 0 
    END), 0)
  INTO v_concentrate_kg, v_roughage_kg
  FROM feed_inventory
  WHERE farm_id = p_farm_id;

  -- Build feed breakdown JSON
  v_feed_breakdown := jsonb_build_object(
    'concentrateDays', CASE 
      WHEN v_daily_concentrate_consumption > 0 THEN 
        FLOOR(v_concentrate_kg / v_daily_concentrate_consumption)::INTEGER
      ELSE NULL 
    END,
    'roughageDays', CASE 
      WHEN v_daily_roughage_consumption > 0 THEN 
        FLOOR(v_roughage_kg / v_daily_roughage_consumption)::INTEGER
      ELSE NULL 
    END,
    'concentrateKg', ROUND(v_concentrate_kg::NUMERIC, 1),
    'roughageKg', ROUND(v_roughage_kg::NUMERIC, 1)
  );

  -- Overall feed stock days = minimum of both categories (most limiting)
  v_feed_stock_days := LEAST(
    NULLIF((v_feed_breakdown->>'concentrateDays')::INTEGER, NULL),
    NULLIF((v_feed_breakdown->>'roughageDays')::INTEGER, NULL)
  );
  
  -- If one category is null but other exists, use the existing one
  IF v_feed_stock_days IS NULL THEN
    v_feed_stock_days := COALESCE(
      (v_feed_breakdown->>'concentrateDays')::INTEGER,
      (v_feed_breakdown->>'roughageDays')::INTEGER
    );
  END IF;

  -- ========== Fetch today's live milk data if today is in range ==========
  IF p_end_date >= CURRENT_DATE THEN
    -- Get today's milk directly from milking_records
    SELECT COALESCE(SUM(mr.liters), 0)
    INTO v_today_milk
    FROM milking_records mr
    JOIN animals a ON mr.animal_id = a.id
    WHERE a.farm_id = p_farm_id
      AND mr.record_date = CURRENT_DATE
      AND a.is_deleted = false;
    
    -- Get today's stage counts from animals table
    SELECT jsonb_object_agg(stage, cnt)
    INTO v_today_stage_counts
    FROM (
      SELECT COALESCE(NULLIF(milking_stage, ''), NULLIF(life_stage, ''), 'Unknown') as stage,
             COUNT(*) as cnt
      FROM animals
      WHERE farm_id = p_farm_id 
        AND is_deleted = false 
        AND exit_date IS NULL
      GROUP BY 1
    ) sub;
    
    -- Check if today already exists in daily_farm_stats
    SELECT EXISTS(
      SELECT 1 FROM daily_farm_stats 
      WHERE farm_id = p_farm_id AND stat_date = CURRENT_DATE
    ) INTO v_has_today_in_stats;
  END IF;

  -- Get dashboard stats with today's live milk included in average
  SELECT json_build_object(
    'totalAnimals', v_animal_count,
    'feedStockDays', v_feed_stock_days,
    'feedStockBreakdown', v_feed_breakdown,
    'avgDailyMilk', COALESCE((
      SELECT AVG(milk_total) FROM (
        -- Historical data from daily_farm_stats (exclude today to avoid double-counting)
        SELECT total_milk_liters as milk_total
        FROM daily_farm_stats
        WHERE farm_id = p_farm_id
          AND stat_date >= p_start_date
          AND stat_date < CURRENT_DATE
        UNION ALL
        -- Add today's live data if it exists
        SELECT v_today_milk as milk_total
        WHERE p_end_date >= CURRENT_DATE AND v_today_milk IS NOT NULL AND v_today_milk > 0
      ) combined
    ), 0),
    'pregnantCount', COALESCE((
      SELECT COUNT(DISTINCT animal_id)
      FROM ai_records air
      JOIN animals a ON a.id = air.animal_id
      WHERE a.farm_id = p_farm_id
        AND a.is_deleted = false
        AND air.pregnancy_confirmed = true
    ), 0),
    'pendingConfirmation', COALESCE((
      SELECT COUNT(DISTINCT animal_id)
      FROM ai_records air
      JOIN animals a ON a.id = air.animal_id
      WHERE a.farm_id = p_farm_id
        AND a.is_deleted = false
        AND air.pregnancy_confirmed = false
        AND air.performed_date IS NOT NULL
    ), 0),
    'recentHealthEvents', COALESCE((
      SELECT COUNT(*)
      FROM health_records hr
      JOIN animals a ON a.id = hr.animal_id
      WHERE a.farm_id = p_farm_id
        AND hr.visit_date >= p_start_date
    ), 0)
  ) INTO v_stats;

  -- Get daily milk and stage data from daily_farm_stats
  SELECT json_agg(
    json_build_object(
      'date', stat_date,
      'milkTotal', total_milk_liters,
      'stageCounts', stage_counts
    ) ORDER BY stat_date
  )
  INTO v_daily_data
  FROM daily_farm_stats
  WHERE farm_id = p_farm_id
    AND stat_date >= p_start_date
    AND stat_date <= p_end_date
    AND stat_date < CURRENT_DATE;  -- Exclude today, we'll add live data

  -- ========== Append today's live data ==========
  IF p_end_date >= CURRENT_DATE AND v_today_milk IS NOT NULL THEN
    v_daily_data := COALESCE(v_daily_data, '[]'::json)::jsonb || jsonb_build_array(
      jsonb_build_object(
        'date', CURRENT_DATE,
        'milkTotal', v_today_milk,
        'stageCounts', COALESCE(v_today_stage_counts, '{}'::jsonb)
      )
    );
    v_daily_data := v_daily_data::json;
  END IF;

  -- Get monthly headcount data
  SELECT json_agg(
    json_build_object(
      'monthDate', month_date,
      'stageCounts', stage_counts
    ) ORDER BY month_date
  )
  INTO v_monthly_data
  FROM monthly_farm_stats
  WHERE farm_id = p_farm_id
    AND month_date >= p_monthly_start_date
    AND month_date <= p_monthly_end_date;

  -- FALLBACK: If monthly_farm_stats is empty, derive from daily_farm_stats
  IF v_monthly_data IS NULL THEN
    SELECT json_agg(
      json_build_object(
        'monthDate', month_date,
        'stageCounts', stage_counts
      ) ORDER BY month_date
    )
    INTO v_monthly_data
    FROM (
      SELECT DISTINCT ON (date_trunc('month', stat_date))
        date_trunc('month', stat_date)::date as month_date,
        stage_counts
      FROM daily_farm_stats
      WHERE farm_id = p_farm_id
        AND stat_date >= p_monthly_start_date
        AND stat_date <= p_monthly_end_date
      ORDER BY date_trunc('month', stat_date), stat_date DESC
    ) subquery;
  END IF;

  -- Get unique stage keys
  SELECT ARRAY_AGG(DISTINCT stage_key)
  INTO v_stage_keys
  FROM (
    SELECT jsonb_object_keys(stage_counts::jsonb) as stage_key
    FROM daily_farm_stats
    WHERE farm_id = p_farm_id
      AND stat_date >= p_start_date
      AND stat_date <= p_end_date
    UNION
    SELECT jsonb_object_keys(v_today_stage_counts) as stage_key
    WHERE v_today_stage_counts IS NOT NULL
    LIMIT 100
  ) subquery;

  -- Combine all data
  v_result := json_build_object(
    'stats', v_stats,
    'dailyData', COALESCE(v_daily_data, '[]'::json),
    'monthlyData', COALESCE(v_monthly_data, '[]'::json),
    'stageKeys', COALESCE(v_stage_keys, ARRAY[]::TEXT[])
  );

  RETURN v_result;
END;
$function$;