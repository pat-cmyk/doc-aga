-- Add is_stale column to animal_ovr_cache for incremental updates
ALTER TABLE public.animal_ovr_cache 
ADD COLUMN IF NOT EXISTS is_stale BOOLEAN DEFAULT false;

-- Create index for efficient stale record lookup
CREATE INDEX IF NOT EXISTS idx_animal_ovr_cache_stale 
ON public.animal_ovr_cache(is_stale) WHERE is_stale = true;

-- Function to calculate OVR for a single animal
CREATE OR REPLACE FUNCTION public.calculate_animal_ovr(p_animal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
          ((MAX(weight_kg) - MIN(weight_kg)) / NULLIF(EXTRACT(days FROM MAX(measurement_date) - MIN(measurement_date)), 0)) * 1000
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
    
    -- Get calving interval from AI records
    SELECT EXTRACT(days FROM (MAX(performed_date) - MIN(performed_date)))::int
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

-- Function to batch calculate OVR for all animals (or by farm)
CREATE OR REPLACE FUNCTION public.batch_calculate_ovr_scores(p_farm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_animal RECORD;
  v_ovr_result jsonb;
  v_processed int := 0;
  v_errors int := 0;
BEGIN
  FOR v_animal IN 
    SELECT id
    FROM animals 
    WHERE is_deleted = false 
      AND exit_date IS NULL
      AND (p_farm_id IS NULL OR farm_id = p_farm_id)
    ORDER BY 
      -- Prioritize stale cache entries
      CASE WHEN EXISTS (
        SELECT 1 FROM animal_ovr_cache c WHERE c.animal_id = animals.id AND c.is_stale = true
      ) THEN 0 ELSE 1 END,
      updated_at DESC
  LOOP
    BEGIN
      v_ovr_result := calculate_animal_ovr(v_animal.id);
      
      IF v_ovr_result IS NOT NULL THEN
        INSERT INTO animal_ovr_cache (animal_id, score, tier, trend, breakdown, computed_at, is_stale)
        VALUES (
          v_animal.id,
          (v_ovr_result->>'score')::int,
          v_ovr_result->>'tier',
          v_ovr_result->>'trend',
          v_ovr_result->'breakdown',
          now(),
          false
        )
        ON CONFLICT (animal_id) DO UPDATE SET
          score = (v_ovr_result->>'score')::int,
          tier = v_ovr_result->>'tier',
          trend = v_ovr_result->>'trend',
          breakdown = v_ovr_result->'breakdown',
          computed_at = now(),
          is_stale = false;
        
        v_processed := v_processed + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'errors', v_errors,
    'farm_id', p_farm_id,
    'completed_at', now()
  );
END;
$$;

-- Trigger function to mark cache as stale
CREATE OR REPLACE FUNCTION public.mark_ovr_cache_stale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE animal_ovr_cache 
  SET is_stale = true
  WHERE animal_id = COALESCE(NEW.animal_id, OLD.animal_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers on tables that affect OVR calculation
DROP TRIGGER IF EXISTS trg_milking_stale_ovr ON milking_records;
CREATE TRIGGER trg_milking_stale_ovr
AFTER INSERT OR UPDATE OR DELETE ON milking_records
FOR EACH ROW EXECUTE FUNCTION mark_ovr_cache_stale();

DROP TRIGGER IF EXISTS trg_weight_stale_ovr ON weight_records;
CREATE TRIGGER trg_weight_stale_ovr
AFTER INSERT OR UPDATE OR DELETE ON weight_records
FOR EACH ROW EXECUTE FUNCTION mark_ovr_cache_stale();

DROP TRIGGER IF EXISTS trg_bcs_stale_ovr ON body_condition_scores;
CREATE TRIGGER trg_bcs_stale_ovr
AFTER INSERT OR UPDATE OR DELETE ON body_condition_scores
FOR EACH ROW EXECUTE FUNCTION mark_ovr_cache_stale();

DROP TRIGGER IF EXISTS trg_health_schedule_stale_ovr ON preventive_health_schedules;
CREATE TRIGGER trg_health_schedule_stale_ovr
AFTER INSERT OR UPDATE OR DELETE ON preventive_health_schedules
FOR EACH ROW EXECUTE FUNCTION mark_ovr_cache_stale();

DROP TRIGGER IF EXISTS trg_ai_records_stale_ovr ON ai_records;
CREATE TRIGGER trg_ai_records_stale_ovr
AFTER INSERT OR UPDATE OR DELETE ON ai_records
FOR EACH ROW EXECUTE FUNCTION mark_ovr_cache_stale();

DROP TRIGGER IF EXISTS trg_health_records_stale_ovr ON health_records;
CREATE TRIGGER trg_health_records_stale_ovr
AFTER INSERT OR UPDATE OR DELETE ON health_records
FOR EACH ROW EXECUTE FUNCTION mark_ovr_cache_stale();