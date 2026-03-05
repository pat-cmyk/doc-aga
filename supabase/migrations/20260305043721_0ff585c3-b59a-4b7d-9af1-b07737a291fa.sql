CREATE OR REPLACE FUNCTION public.update_animal_fertility_status()
RETURNS TRIGGER AS $$
DECLARE
  v_animal_record RECORD;
  v_new_status public.fertility_status;
  v_vwp_days INTEGER;
BEGIN
  SELECT * INTO v_animal_record FROM public.animals WHERE id = NEW.animal_id;

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
      v_vwp_days := CASE v_animal_record.livestock_type
        WHEN 'goat'  THEN 45
        WHEN 'sheep' THEN 45
        ELSE 60
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
      NULL;
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;