-- =============================================================================
-- Migration: Auto-initialize fertility_status on animal creation + backfill
-- =============================================================================
-- Problem: New animals get fertility_status = 'not_eligible' (DB default),
-- which blocks the entire breeding action progression for breeding-age females.
-- The eligibility gating (PR #17) correctly gates on fertility_status, but the
-- status was never initialized properly on INSERT.
--
-- Fix:
--   1. BEFORE INSERT trigger to set fertility_status based on gender/age/species
--   2. Backfill existing breeding-age females stuck at 'not_eligible'
--   3. Mark existing parentage AI records (from is_father_ai) so they can be
--      filtered from the breeding timeline
-- =============================================================================

-- 1. BEFORE INSERT trigger function
-- Sets fertility_status for new animals using species-specific breeding age
CREATE OR REPLACE FUNCTION public.set_initial_fertility_status()
RETURNS TRIGGER AS $$
DECLARE
  v_min_age_days INTEGER;
BEGIN
  -- If caller explicitly set a non-default fertility_status, respect it
  IF NEW.fertility_status IS NOT NULL AND NEW.fertility_status != 'not_eligible' THEN
    RETURN NEW;
  END IF;

  -- Males or unknown gender: not eligible
  IF NEW.gender IS NULL OR lower(NEW.gender) != 'female' THEN
    NEW.fertility_status := 'not_eligible';
    RETURN NEW;
  END IF;

  -- Species-specific minimum breeding age (matches MIN_BREEDING_AGE_MONTHS in fertility.ts)
  v_min_age_days := CASE lower(COALESCE(NEW.livestock_type, 'cattle'))
    WHEN 'cattle'  THEN 450  -- ~15 months
    WHEN 'carabao' THEN 540  -- ~18 months
    WHEN 'goat'    THEN 240  -- ~8 months
    WHEN 'sheep'   THEN 240  -- ~8 months
    ELSE 450
  END;

  -- If birth_date known and too young: not eligible
  IF NEW.birth_date IS NOT NULL
     AND (CURRENT_DATE - NEW.birth_date) < v_min_age_days THEN
    NEW.fertility_status := 'not_eligible';
    RETURN NEW;
  END IF;

  -- Female at breeding age (or unknown age): open_cycling
  NEW.fertility_status := 'open_cycling';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger (drop first if exists from a retry)
DROP TRIGGER IF EXISTS set_initial_fertility_status_trigger ON public.animals;
CREATE TRIGGER set_initial_fertility_status_trigger
BEFORE INSERT ON public.animals
FOR EACH ROW
EXECUTE FUNCTION public.set_initial_fertility_status();


-- 2. Backfill: Fix breeding-age females stuck at 'not_eligible'

-- 2a. For females WITH breeding_events, replay the latest event to compute correct status
UPDATE public.animals a
SET fertility_status = CASE latest.event_type
    WHEN 'ai_performed'        THEN 'bred_waiting'::public.fertility_status
    WHEN 'non_return'          THEN 'suspected_pregnant'::public.fertility_status
    WHEN 'pregnancy_confirmed' THEN 'confirmed_pregnant'::public.fertility_status
    WHEN 'calving'             THEN 'fresh_postpartum'::public.fertility_status
    WHEN 'vwp_ended'           THEN 'open_cycling'::public.fertility_status
    WHEN 'heat_return'         THEN 'open_cycling'::public.fertility_status
    WHEN 'pregnancy_failed'    THEN 'open_cycling'::public.fertility_status
    WHEN 'heat_detected'       THEN 'in_heat'::public.fertility_status
    ELSE 'open_cycling'::public.fertility_status
  END,
  updated_at = now()
FROM (
  SELECT DISTINCT ON (animal_id) animal_id, event_type
  FROM public.breeding_events
  ORDER BY animal_id, event_date DESC, created_at DESC
) latest
WHERE a.id = latest.animal_id
  AND a.fertility_status = 'not_eligible'
  AND lower(a.gender) = 'female'
  AND a.is_deleted = false;

-- 2b. For females WITHOUT breeding_events, set to open_cycling if breeding age
UPDATE public.animals
SET fertility_status = 'open_cycling', updated_at = now()
WHERE fertility_status = 'not_eligible'
  AND lower(gender) = 'female'
  AND is_deleted = false
  AND id NOT IN (SELECT DISTINCT animal_id FROM public.breeding_events)
  AND (
    birth_date IS NULL  -- unknown age, assume adult
    OR (CURRENT_DATE - birth_date) >= CASE lower(COALESCE(livestock_type, 'cattle'))
      WHEN 'cattle'  THEN 450
      WHEN 'carabao' THEN 540
      WHEN 'goat'    THEN 240
      WHEN 'sheep'   THEN 240
      ELSE 450
    END
  );


-- 3. Mark existing parentage AI records (from is_father_ai checkbox)
-- These records have both scheduled_date = performed_date = animal's birth_date
-- and notes starting with 'Bull Brand:' — they're about the MOTHER's AI, not this animal's
UPDATE public.ai_records ar
SET notes = '[PARENTAGE] ' || COALESCE(ar.notes, '')
WHERE ar.notes IS NOT NULL
  AND ar.notes LIKE 'Bull Brand:%'
  AND ar.scheduled_date = ar.performed_date
  AND ar.notes NOT LIKE '[PARENTAGE]%'  -- idempotent
  AND NOT EXISTS (
    -- Exclude records that have a breeding_event (those are real breeding AI records)
    SELECT 1 FROM public.breeding_events be
    WHERE be.related_ai_record_id = ar.id
  );
