-- Migration: Species-specific Voluntary Waiting Period (VWP)
--
-- Previously the update_animal_fertility_status trigger hardcoded 60 days
-- for all livestock types. Goats and sheep have a shorter VWP (45 days)
-- per industry standards. This migration aligns the DB trigger with
-- the frontend VWP_DAYS constants in src/types/fertility.ts.
--
-- VWP values:
--   cattle   → 60 days
--   carabao  → 60 days
--   goat     → 45 days
--   sheep    → 45 days

CREATE OR REPLACE FUNCTION public.update_animal_fertility_status()
RETURNS TRIGGER AS $$
DECLARE
  v_animal_record RECORD;
  v_new_status public.fertility_status;
  v_vwp_days INTEGER;
BEGIN
  -- Get current animal data
  SELECT * INTO v_animal_record FROM public.animals WHERE id = NEW.animal_id;

  -- Determine new status based on event type
  CASE NEW.event_type
    WHEN 'heat_detected' THEN
      v_new_status := 'in_heat';
      UPDATE public.animals
      SET fertility_status = v_new_status,
          last_heat_date = NEW.event_date,
          updated_at = now()
      WHERE id = NEW.animal_id;

    WHEN 'ai_performed' THEN
      v_new_status := 'bred_waiting';
      UPDATE public.animals
      SET fertility_status = v_new_status,
          last_ai_date = NEW.event_date::date,
          services_this_cycle = COALESCE(services_this_cycle, 0) + 1,
          updated_at = now()
      WHERE id = NEW.animal_id;

    WHEN 'non_return' THEN
      v_new_status := 'suspected_pregnant';
      UPDATE public.animals
      SET fertility_status = v_new_status,
          updated_at = now()
      WHERE id = NEW.animal_id;

    WHEN 'pregnancy_confirmed' THEN
      v_new_status := 'confirmed_pregnant';
      UPDATE public.animals
      SET fertility_status = v_new_status,
          updated_at = now()
      WHERE id = NEW.animal_id;

    WHEN 'pregnancy_failed', 'heat_return' THEN
      v_new_status := 'open_cycling';
      UPDATE public.animals
      SET fertility_status = v_new_status,
          updated_at = now()
      WHERE id = NEW.animal_id;

    WHEN 'calving' THEN
      v_new_status := 'fresh_postpartum';
      -- Species-specific VWP: goats/sheep = 45 days, cattle/carabao = 60 days
      v_vwp_days := CASE v_animal_record.livestock_type
        WHEN 'goat'  THEN 45
        WHEN 'sheep' THEN 45
        ELSE 60  -- cattle, carabao, and any future types default to 60
      END;
      UPDATE public.animals
      SET fertility_status = v_new_status,
          last_calving_date = NEW.event_date::date,
          parity = COALESCE(parity, 0) + 1,
          services_this_cycle = 0,
          voluntary_waiting_end_date = (NEW.event_date::date + (v_vwp_days || ' days')::interval)::date,
          updated_at = now()
      WHERE id = NEW.animal_id;

    WHEN 'vwp_ended' THEN
      v_new_status := 'open_cycling';
      UPDATE public.animals
      SET fertility_status = v_new_status,
          updated_at = now()
      WHERE id = NEW.animal_id;

    ELSE
      -- No status change for other events
      NULL;
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
