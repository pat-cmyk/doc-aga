-- Fix get_combined_dashboard_data to include monthly data fallback
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
BEGIN
  -- Verify access
  IF NOT can_access_farm(p_farm_id) THEN
    RAISE EXCEPTION 'Access denied to farm';
  END IF;

  -- Get dashboard stats
  SELECT json_build_object(
    'totalAnimals', COALESCE((
      SELECT COUNT(*) FROM animals 
      WHERE farm_id = p_farm_id AND is_deleted = false
    ), 0),
    'avgDailyMilk', COALESCE((
      SELECT AVG(total_milk_liters)
      FROM daily_farm_stats
      WHERE farm_id = p_farm_id
        AND stat_date >= p_start_date
        AND stat_date <= p_end_date
    ), 0),
    'pregnantCount', COALESCE((
      SELECT COUNT(DISTINCT animal_id)
      FROM ai_records air
      JOIN animals a ON a.id = air.animal_id
      WHERE a.farm_id = p_farm_id
        AND air.pregnancy_confirmed = true
    ), 0),
    'pendingConfirmation', COALESCE((
      SELECT COUNT(DISTINCT animal_id)
      FROM ai_records air
      JOIN animals a ON a.id = air.animal_id
      WHERE a.farm_id = p_farm_id
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

  -- Get daily milk and stage data
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
    AND stat_date <= p_end_date;

  -- Get monthly headcount data from monthly_farm_stats
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

  -- FALLBACK: If monthly_farm_stats is empty, aggregate from daily_farm_stats
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

  -- Get unique stage keys from daily stats
  SELECT ARRAY_AGG(DISTINCT stage_key)
  INTO v_stage_keys
  FROM (
    SELECT jsonb_object_keys(stage_counts::jsonb) as stage_key
    FROM daily_farm_stats
    WHERE farm_id = p_farm_id
      AND stat_date >= p_start_date
      AND stat_date <= p_end_date
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