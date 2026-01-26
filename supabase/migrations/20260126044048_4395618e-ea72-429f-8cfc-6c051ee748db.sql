-- Fix the calculate_animal_ovr function to handle date subtraction correctly
-- The issue is that subtracting two dates returns an integer in PostgreSQL, not an interval
-- EXTRACT(days FROM integer) doesn't work - we need to use the integer directly

CREATE OR REPLACE FUNCTION public.calculate_animal_ovr(p_animal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_animal RECORD;
  v_production_score numeric := 50;
  v_health_score numeric := 100;
  v_fertility_score numeric := 50;
  v_growth_score numeric := 50;
  v_bcs_score numeric := 50;
  v_final_score numeric;
  v_tier text;
  v_trend text := 'stable';
  v_previous_score numeric;
  v_weights jsonb;
  v_vaccination_total int := 0;
  v_vaccination_completed int := 0;
  v_overdue_vaccines int := 0;
  v_has_active_health_issues boolean := false;
  v_has_withdrawal boolean := false;
  v_is_pregnant boolean := false;
  v_calving_interval int;
  v_latest_bcs numeric;
  v_avg_daily_milk numeric;
  v_milk_benchmark numeric;
  v_adg_grams numeric;
  v_adg_benchmark numeric := 500; -- Default ADG benchmark
BEGIN
  -- Get animal details
  SELECT * INTO v_animal 
  FROM animals 
  WHERE id = p_animal_id AND is_deleted = false;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Determine weights based on livestock type and milking status
  IF v_animal.livestock_type = 'cattle' AND LOWER(v_animal.gender) = 'female' AND v_animal.milking_stage IS NOT NULL THEN
    v_weights := '{"production": 0.30, "health": 0.25, "fertility": 0.20, "growth": 0.15, "bodyCondition": 0.10}'::jsonb;
  ELSE
    v_weights := '{"production": 0.40, "health": 0.25, "fertility": 0.15, "growth": 0.15, "bodyCondition": 0.05}'::jsonb;
  END IF;

  -- Set milk benchmark based on milking stage
  v_milk_benchmark := CASE v_animal.milking_stage
    WHEN 'Early Lactation' THEN 12
    WHEN 'Peak Lactation' THEN 15
    WHEN 'Mid Lactation' THEN 10
    WHEN 'Late Lactation' THEN 6
    WHEN 'Dry Period' THEN 0
    ELSE 8
  END;

  -- ============ PRODUCTION SCORE ============
  -- For milking females, use milk production
  IF LOWER(v_animal.gender) = 'female' AND v_animal.milking_stage IS NOT NULL AND v_milk_benchmark > 0 THEN
    SELECT COALESCE(AVG(daily_total), 0) INTO v_avg_daily_milk
    FROM (
      SELECT SUM(liters) as daily_total
      FROM milking_records
      WHERE animal_id = p_animal_id
        AND record_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY record_date
    ) daily;
    
    IF v_avg_daily_milk > 0 THEN
      v_production_score := LEAST(100, GREATEST(0, (v_avg_daily_milk / v_milk_benchmark) * 83));
    END IF;
  ELSE
    -- For others, use ADG from weight records
    SELECT 
      CASE 
        WHEN COUNT(*) >= 2 AND MAX(measurement_date) > MIN(measurement_date) THEN
          ((MAX(weight_kg) - MIN(weight_kg)) / NULLIF((MAX(measurement_date) - MIN(measurement_date)), 0)) * 1000
        ELSE NULL
      END INTO v_adg_grams
    FROM (
      SELECT weight_kg, measurement_date
      FROM weight_records
      WHERE animal_id = p_animal_id
      ORDER BY measurement_date DESC
      LIMIT 5
    ) recent_weights;
    
    IF v_adg_grams IS NOT NULL AND v_adg_grams > 0 THEN
      v_production_score := LEAST(100, GREATEST(0, (v_adg_grams / v_adg_benchmark) * 83));
    END IF;
  END IF;

  -- ============ HEALTH SCORE ============
  -- Count vaccination compliance
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'scheduled' AND scheduled_date < CURRENT_DATE)
  INTO v_vaccination_total, v_vaccination_completed, v_overdue_vaccines
  FROM preventive_health_schedules
  WHERE animal_id = p_animal_id;

  IF v_vaccination_total > 0 THEN
    v_health_score := (v_vaccination_completed::numeric / v_vaccination_total::numeric) * 100;
  END IF;

  -- Check for active health issues (health records in last 30 days without resolution)
  SELECT EXISTS(
    SELECT 1 FROM health_records
    WHERE animal_id = p_animal_id
      AND visit_date >= CURRENT_DATE - INTERVAL '30 days'
      AND (resolution_notes IS NULL OR resolution_notes = '')
  ) INTO v_has_active_health_issues;

  -- Check for withdrawal period (milk sold flag false on recent records)
  SELECT EXISTS(
    SELECT 1 FROM milking_records
    WHERE animal_id = p_animal_id
      AND record_date >= CURRENT_DATE - INTERVAL '14 days'
      AND is_sold = false
  ) INTO v_has_withdrawal;

  -- Apply penalties
  IF v_has_active_health_issues THEN v_health_score := v_health_score - 40; END IF;
  IF v_has_withdrawal THEN v_health_score := v_health_score - 15; END IF;
  v_health_score := v_health_score - (v_overdue_vaccines * 15);
  v_health_score := LEAST(100, GREATEST(0, v_health_score));

  -- ============ FERTILITY SCORE ============
  IF LOWER(v_animal.gender) = 'male' OR v_animal.life_stage IN ('calf', 'kid') THEN
    v_fertility_score := 75; -- Neutral for males/young
  ELSE
    -- Check pregnancy
    SELECT EXISTS(
      SELECT 1 FROM ai_records
      WHERE animal_id = p_animal_id
        AND pregnancy_confirmed = true
        AND (expected_delivery_date IS NULL OR expected_delivery_date > CURRENT_DATE)
    ) INTO v_is_pregnant;
    
    IF v_is_pregnant THEN v_fertility_score := v_fertility_score + 25; END IF;
    
    -- Get calving interval from AI records (date - date returns integer directly in PostgreSQL)
    SELECT (MAX(performed_date) - MIN(performed_date))
    INTO v_calving_interval
    FROM ai_records
    WHERE animal_id = p_animal_id
      AND performed_date IS NOT NULL;
    
    IF v_calving_interval IS NOT NULL THEN
      IF v_calving_interval >= 365 AND v_calving_interval <= 400 THEN
        v_fertility_score := v_fertility_score + 25;
      ELSIF v_calving_interval < 365 THEN
        v_fertility_score := v_fertility_score + 15;
      ELSIF v_calving_interval <= 450 THEN
        v_fertility_score := v_fertility_score + 10;
      ELSE
        v_fertility_score := v_fertility_score - 10;
      END IF;
    END IF;
    
    v_fertility_score := LEAST(100, GREATEST(0, v_fertility_score));
  END IF;

  -- ============ GROWTH SCORE ============
  IF v_adg_grams IS NOT NULL THEN
    v_growth_score := LEAST(100, GREATEST(0, (v_adg_grams / v_adg_benchmark) * 80));
  ELSE
    -- Fallback based on weight status if available
    v_growth_score := 50;
  END IF;

  -- ============ BODY CONDITION SCORE ============
  SELECT score INTO v_latest_bcs
  FROM body_condition_scores
  WHERE animal_id = p_animal_id
  ORDER BY assessment_date DESC
  LIMIT 1;
  
  IF v_latest_bcs IS NOT NULL THEN
    IF v_latest_bcs >= 2.5 AND v_latest_bcs <= 4.0 THEN
      v_bcs_score := 100;
    ELSIF v_latest_bcs < 2.5 THEN
      v_bcs_score := GREATEST(0, 100 - ((2.5 - v_latest_bcs) * 40));
    ELSE
      v_bcs_score := GREATEST(0, 100 - ((v_latest_bcs - 4.0) * 30));
    END IF;
  END IF;

  -- ============ CALCULATE FINAL SCORE ============
  v_final_score := ROUND(
    v_production_score * (v_weights->>'production')::numeric +
    v_health_score * (v_weights->>'health')::numeric +
    v_fertility_score * (v_weights->>'fertility')::numeric +
    v_growth_score * (v_weights->>'growth')::numeric +
    v_bcs_score * (v_weights->>'bodyCondition')::numeric
  );
  v_final_score := LEAST(100, GREATEST(0, v_final_score));

  -- Determine tier
  v_tier := CASE
    WHEN v_final_score >= 85 THEN 'diamond'
    WHEN v_final_score >= 70 THEN 'gold'
    WHEN v_final_score >= 50 THEN 'silver'
    ELSE 'bronze'
  END;

  -- Calculate trend from previous cached score
  SELECT score INTO v_previous_score
  FROM animal_ovr_cache
  WHERE animal_id = p_animal_id;
  
  IF v_previous_score IS NOT NULL THEN
    IF v_final_score > v_previous_score + 2 THEN
      v_trend := 'up';
    ELSIF v_final_score < v_previous_score - 2 THEN
      v_trend := 'down';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'score', v_final_score,
    'tier', v_tier,
    'trend', v_trend,
    'breakdown', jsonb_build_object(
      'production', ROUND(v_production_score),
      'health', ROUND(v_health_score),
      'fertility', ROUND(v_fertility_score),
      'growth', ROUND(v_growth_score),
      'bodyCondition', ROUND(v_bcs_score)
    ),
    'computed_at', now()
  );
END;
$$;