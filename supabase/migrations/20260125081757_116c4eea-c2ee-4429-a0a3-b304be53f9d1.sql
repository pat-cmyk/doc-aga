-- Update trigger function to immediately recalculate OVR instead of just marking stale
CREATE OR REPLACE FUNCTION public.mark_ovr_cache_stale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_animal_id uuid;
  v_ovr_result jsonb;
BEGIN
  -- Get the animal_id from the triggering record
  v_animal_id := COALESCE(NEW.animal_id, OLD.animal_id);
  
  -- Skip if no animal_id (shouldn't happen but safety check)
  IF v_animal_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Immediately recalculate OVR for this animal
  v_ovr_result := calculate_animal_ovr(v_animal_id);
  
  IF v_ovr_result IS NOT NULL THEN
    INSERT INTO animal_ovr_cache (animal_id, score, tier, trend, breakdown, computed_at, is_stale)
    VALUES (
      v_animal_id,
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
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;