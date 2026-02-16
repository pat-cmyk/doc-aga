
-- Add milk quality columns to milking_records
ALTER TABLE milking_records ADD COLUMN milk_quality text NOT NULL DEFAULT 'good';
ALTER TABLE milking_records ADD COLUMN milk_quality_rejection_reason text;

-- Update inventory sync trigger for inserts: rejected milk gets is_available=false, liters_remaining=0
CREATE OR REPLACE FUNCTION sync_milk_inventory_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.milk_inventory (
    farm_id, animal_id, milking_record_id, record_date,
    liters_original, liters_remaining, is_available, client_generated_id
  )
  SELECT 
    a.farm_id,
    NEW.animal_id,
    NEW.id,
    NEW.record_date,
    NEW.liters,
    CASE WHEN NEW.milk_quality = 'rejected' THEN 0 ELSE NEW.liters END,
    CASE WHEN NEW.milk_quality = 'rejected' THEN false ELSE NOT COALESCE(NEW.is_sold, false) END,
    NEW.client_generated_id
  FROM animals a WHERE a.id = NEW.animal_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update inventory sync trigger for updates: handle quality changes
CREATE OR REPLACE FUNCTION sync_milk_inventory_on_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If milk_quality changed to rejected, mark inventory unavailable
  IF NEW.milk_quality = 'rejected' AND (OLD.milk_quality IS NULL OR OLD.milk_quality != 'rejected') THEN
    UPDATE public.milk_inventory
    SET is_available = false, 
        liters_remaining = 0,
        updated_at = now()
    WHERE milking_record_id = NEW.id;
    RETURN NEW;
  END IF;

  -- If milk_quality changed FROM rejected to good, restore inventory
  IF NEW.milk_quality = 'good' AND OLD.milk_quality = 'rejected' THEN
    UPDATE public.milk_inventory
    SET is_available = NOT COALESCE(NEW.is_sold, false),
        liters_remaining = NEW.liters,
        liters_original = NEW.liters,
        updated_at = now()
    WHERE milking_record_id = NEW.id;
    RETURN NEW;
  END IF;

  -- If is_sold changed to true, mark inventory unavailable
  IF NEW.is_sold = true AND (OLD.is_sold = false OR OLD.is_sold IS NULL) THEN
    UPDATE public.milk_inventory
    SET is_available = false, 
        liters_remaining = 0,
        updated_at = now()
    WHERE milking_record_id = NEW.id;
  END IF;
  
  -- If liters changed, update inventory
  IF NEW.liters != OLD.liters THEN
    UPDATE public.milk_inventory
    SET liters_original = NEW.liters,
        liters_remaining = GREATEST(0, liters_remaining + (NEW.liters - OLD.liters)),
        updated_at = now()
    WHERE milking_record_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update approve_pending_activity (3-param version) to carry milk_quality
CREATE OR REPLACE FUNCTION public.approve_pending_activity(_pending_id uuid, _approved_by uuid, _is_auto boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _pending RECORD;
  _result JSONB;
  _animal_id UUID;
  _record_date DATE;
  _record_datetime TIMESTAMP WITH TIME ZONE;
  _session TEXT;
  _raw_session TEXT;
  _dist JSONB;
  _animal_dist JSONB;
  _input_method TEXT;
  _milk_quality TEXT;
  _milk_quality_rejection_reason TEXT;
BEGIN
  SELECT * INTO _pending
  FROM pending_activities
  WHERE id = _pending_id AND status = 'pending'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Activity not found or already processed');
  END IF;
  
  _input_method := COALESCE(_pending.input_method, 'typed');
  
  _record_date := COALESCE(
    (_pending.activity_data->>'validated_date')::DATE,
    (_pending.created_at)::DATE
  );
  _record_datetime := COALESCE(
    (_pending.activity_data->>'validated_datetime')::TIMESTAMP WITH TIME ZONE,
    _pending.created_at
  );
  
  _raw_session := LOWER(COALESCE(_pending.activity_data->>'session', ''));
  _session := CASE 
    WHEN _raw_session IN ('am', 'morning', 'umaga') THEN 'AM'
    WHEN _raw_session IN ('pm', 'afternoon', 'evening', 'hapon', 'gabi') THEN 'PM'
    WHEN _raw_session IN ('full day', 'fullday', 'whole day', 'buong araw', 'all day') THEN 'Full Day'
    WHEN _raw_session = '' THEN 
      CASE WHEN EXTRACT(HOUR FROM _record_datetime) < 12 THEN 'AM' ELSE 'PM' END
    ELSE 'AM'
  END;
  
  -- Extract milk quality fields
  _milk_quality := COALESCE(_pending.activity_data->>'milk_quality', 'good');
  _milk_quality_rejection_reason := _pending.activity_data->>'milk_quality_rejection_reason';
  
  CASE _pending.activity_type
    WHEN 'milking' THEN
      IF _pending.activity_data ? 'distributions_by_type' AND 
         jsonb_array_length(_pending.activity_data->'distributions_by_type') > 0 THEN
        FOR _dist IN SELECT * FROM jsonb_array_elements(_pending.activity_data->'distributions_by_type')
        LOOP
          FOR _animal_dist IN SELECT * FROM jsonb_array_elements(_dist->'distributions')
          LOOP
            IF (_animal_dist->>'milk_liters')::NUMERIC > 0 THEN
              INSERT INTO milking_records (animal_id, record_date, liters, session, created_by, input_method, milk_quality, milk_quality_rejection_reason)
              VALUES (
                (_animal_dist->>'animal_id')::UUID,
                _record_date,
                (_animal_dist->>'milk_liters')::NUMERIC,
                _session,
                _pending.submitted_by,
                _input_method,
                _milk_quality,
                _milk_quality_rejection_reason
              );
            END IF;
          END LOOP;
        END LOOP;
      ELSE
        FOREACH _animal_id IN ARRAY _pending.animal_ids LOOP
          INSERT INTO milking_records (animal_id, record_date, liters, session, created_by, input_method, milk_quality, milk_quality_rejection_reason)
          VALUES (
            _animal_id,
            _record_date,
            (_pending.activity_data->>'quantity')::NUMERIC,
            _session,
            _pending.submitted_by,
            _input_method,
            _milk_quality,
            _milk_quality_rejection_reason
          );
        END LOOP;
      END IF;
      
    WHEN 'feeding' THEN
      IF _pending.activity_data ? 'distributions' THEN
        INSERT INTO feeding_records (animal_id, record_datetime, feed_type, kilograms, notes, created_by, input_method)
        SELECT 
          (dist->>'animal_id')::UUID,
          _record_datetime,
          _pending.activity_data->>'feed_type',
          (dist->>'feed_amount')::NUMERIC,
          _pending.activity_data->>'notes',
          _pending.submitted_by,
          _input_method
        FROM jsonb_array_elements(_pending.activity_data->'distributions') AS dist;
      ELSE
        FOREACH _animal_id IN ARRAY _pending.animal_ids LOOP
          INSERT INTO feeding_records (animal_id, record_datetime, feed_type, kilograms, notes, created_by, input_method)
          VALUES (
            _animal_id,
            _record_datetime,
            _pending.activity_data->>'feed_type',
            (_pending.activity_data->>'quantity')::NUMERIC,
            _pending.activity_data->>'notes',
            _pending.submitted_by,
            _input_method
          );
        END LOOP;
      END IF;
      
    WHEN 'weight_measurement' THEN
      FOREACH _animal_id IN ARRAY _pending.animal_ids LOOP
        INSERT INTO weight_records (animal_id, weight_kg, measurement_date, recorded_by, notes, input_method)
        VALUES (
          _animal_id,
          (_pending.activity_data->>'quantity')::NUMERIC,
          _record_date,
          _pending.submitted_by,
          _pending.activity_data->>'notes',
          _input_method
        );
      END LOOP;
      
    WHEN 'health_observation' THEN
      FOREACH _animal_id IN ARRAY _pending.animal_ids LOOP
        INSERT INTO health_records (animal_id, visit_date, notes, created_by, input_method)
        VALUES (
          _animal_id,
          _record_date,
          _pending.activity_data->>'notes',
          _pending.submitted_by,
          _input_method
        );
      END LOOP;
      
    WHEN 'injection' THEN
      FOREACH _animal_id IN ARRAY _pending.animal_ids LOOP
        INSERT INTO injection_records (animal_id, record_datetime, medicine_name, dosage, instructions, created_by, input_method)
        VALUES (
          _animal_id,
          _record_datetime,
          _pending.activity_data->>'medicine_name',
          _pending.activity_data->>'dosage',
          _pending.activity_data->>'notes',
          _pending.submitted_by,
          _input_method
        );
      END LOOP;
  END CASE;
  
  UPDATE pending_activities
  SET 
    status = CASE WHEN _is_auto THEN 'auto_approved'::pending_activity_status ELSE 'approved'::pending_activity_status END,
    reviewed_by = _approved_by,
    reviewed_at = now()
  WHERE id = _pending_id;
  
  INSERT INTO notifications (user_id, type, title, body)
  VALUES (
    _pending.submitted_by,
    'activity_approved',
    CASE WHEN _is_auto THEN 'Activity Auto-Approved' ELSE 'Activity Approved' END,
    'Your ' || _pending.activity_type::TEXT || ' submission has been ' || 
    CASE WHEN _is_auto THEN 'auto-approved' ELSE 'approved' END || '.'
  );
  
  RETURN jsonb_build_object('success', true, 'activity_id', _pending_id);
END;
$function$;

-- Update 2-param version to carry milk_quality
CREATE OR REPLACE FUNCTION public.approve_pending_activity(
  p_activity_id uuid,
  p_approver_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _activity record;
  _raw_session text;
  _session text;
  _record_datetime timestamptz;
  _result_id uuid;
  _animal record;
  _farm record;
  _input_method text;
  _milk_quality text;
  _milk_quality_rejection_reason text;
BEGIN
  SELECT * INTO _activity FROM pending_activities WHERE id = p_activity_id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Activity not found or already processed');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM farm_memberships 
    WHERE farm_id = _activity.farm_id 
    AND user_id = p_approver_id 
    AND role_in_farm IN ('farmer_owner', 'admin')
    AND invitation_status = 'accepted'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to approve');
  END IF;

  SELECT * INTO _animal FROM animals WHERE id = _activity.animal_id;
  
  _input_method := COALESCE(_activity.input_method, 'typed');
  _milk_quality := COALESCE(_activity.extracted_data->>'milk_quality', 'good');
  _milk_quality_rejection_reason := _activity.extracted_data->>'milk_quality_rejection_reason';

  _raw_session := lower(coalesce(_activity.extracted_data->>'session', ''));
  _record_datetime := coalesce((_activity.extracted_data->>'record_datetime')::timestamptz, _activity.created_at);
  
  _session := CASE 
    WHEN _raw_session IN ('am', 'morning', 'umaga') THEN 'AM'
    WHEN _raw_session IN ('pm', 'afternoon', 'evening', 'hapon', 'gabi') THEN 'PM'
    WHEN _raw_session IN ('full day', 'fullday', 'whole day', 'buong araw', 'all day') THEN 'Full Day'
    WHEN _raw_session = '' THEN 
      CASE WHEN EXTRACT(HOUR FROM _record_datetime) < 12 THEN 'AM' ELSE 'PM' END
    ELSE 'AM'
  END;

  CASE _activity.activity_type
    WHEN 'milking' THEN
      INSERT INTO milking_records (animal_id, liters, record_date, session, created_by, client_generated_id, input_method, milk_quality, milk_quality_rejection_reason)
      VALUES (
        _activity.animal_id,
        (_activity.extracted_data->>'quantity')::numeric,
        (_record_datetime AT TIME ZONE 'Asia/Manila')::date,
        _session,
        _activity.submitted_by,
        'pa_' || _activity.id::text,
        _input_method,
        _milk_quality,
        _milk_quality_rejection_reason
      )
      RETURNING id INTO _result_id;

    WHEN 'feeding' THEN
      INSERT INTO feeding_records (animal_id, quantity_kg, feed_type, record_datetime, created_by, client_generated_id, input_method)
      VALUES (
        _activity.animal_id,
        (_activity.extracted_data->>'quantity')::numeric,
        coalesce(_activity.extracted_data->>'feed_type', 'General Feed'),
        _record_datetime,
        _activity.submitted_by,
        'pa_' || _activity.id::text,
        _input_method
      )
      RETURNING id INTO _result_id;

    WHEN 'health_observation' THEN
      INSERT INTO health_records (animal_id, visit_date, diagnosis, notes, created_by, client_generated_id, input_method)
      VALUES (
        _activity.animal_id,
        (_record_datetime AT TIME ZONE 'Asia/Manila')::date,
        coalesce(_activity.extracted_data->>'diagnosis', 'Observation'),
        _activity.extracted_data->>'notes',
        _activity.submitted_by,
        'pa_' || _activity.id::text,
        _input_method
      )
      RETURNING id INTO _result_id;

    WHEN 'weight_measurement' THEN
      INSERT INTO weight_records (animal_id, weight_kg, measurement_date, measurement_method, notes, created_by, client_generated_id, input_method)
      VALUES (
        _activity.animal_id,
        (_activity.extracted_data->>'quantity')::numeric,
        (_record_datetime AT TIME ZONE 'Asia/Manila')::date,
        coalesce(_activity.extracted_data->>'measurement_method', 'scale'),
        _activity.extracted_data->>'notes',
        _activity.submitted_by,
        'pa_' || _activity.id::text,
        _input_method
      )
      RETURNING id INTO _result_id;

    WHEN 'injection' THEN
      INSERT INTO injection_records (animal_id, injection_date, medication_name, dosage, route, administered_by, notes, created_by, client_generated_id, input_method)
      VALUES (
        _activity.animal_id,
        (_record_datetime AT TIME ZONE 'Asia/Manila')::date,
        coalesce(_activity.extracted_data->>'medication_name', 'Unknown'),
        _activity.extracted_data->>'dosage',
        coalesce(_activity.extracted_data->>'route', 'IM'),
        _activity.submitted_by,
        _activity.extracted_data->>'notes',
        _activity.submitted_by,
        'pa_' || _activity.id::text,
        _input_method
      )
      RETURNING id INTO _result_id;

    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Unknown activity type: ' || _activity.activity_type);
  END CASE;

  UPDATE pending_activities 
  SET status = 'approved', 
      reviewed_by = p_approver_id, 
      reviewed_at = now()
  WHERE id = p_activity_id;

  INSERT INTO notifications (user_id, farm_id, type, title, body, metadata)
  VALUES (
    _activity.submitted_by,
    _activity.farm_id,
    'activity_approved',
    'Activity Approved',
    'Your ' || _activity.activity_type || ' record has been approved',
    jsonb_build_object('activity_id', _activity.id, 'activity_type', _activity.activity_type, 'result_id', _result_id)
  );

  RETURN jsonb_build_object('success', true, 'result_id', _result_id);
END;
$$;
