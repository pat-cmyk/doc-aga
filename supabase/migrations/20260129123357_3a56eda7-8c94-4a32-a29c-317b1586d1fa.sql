-- Fix approve_pending_activity to include session column for milking records
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
BEGIN
  -- Get the pending activity
  SELECT * INTO _pending
  FROM pending_activities
  WHERE id = _pending_id AND status = 'pending'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Activity not found or already processed');
  END IF;
  
  -- Extract common data
  _record_date := COALESCE((_pending.activity_data->>'validated_date')::DATE, CURRENT_DATE);
  _record_datetime := COALESCE((_pending.activity_data->>'validated_datetime')::TIMESTAMP WITH TIME ZONE, now());
  -- Extract session for milking, default to 'morning' if not provided
  _session := COALESCE(_pending.activity_data->>'session', 'morning');
  
  -- Insert into appropriate production table based on activity type
  CASE _pending.activity_type
    WHEN 'milking' THEN
      FOREACH _animal_id IN ARRAY _pending.animal_ids LOOP
        INSERT INTO milking_records (animal_id, record_date, liters, session, created_by)
        VALUES (
          _animal_id,
          _record_date,
          (_pending.activity_data->>'quantity')::NUMERIC,
          _session,
          _pending.submitted_by
        );
      END LOOP;
      
    WHEN 'feeding' THEN
      -- Handle both single and bulk feeding
      IF _pending.activity_data ? 'distributions' THEN
        -- Bulk feeding with distributions
        INSERT INTO feeding_records (animal_id, record_datetime, feed_type, kilograms, notes, created_by)
        SELECT 
          (dist->>'animal_id')::UUID,
          _record_datetime,
          _pending.activity_data->>'feed_type',
          (dist->>'feed_amount')::NUMERIC,
          _pending.activity_data->>'notes',
          _pending.submitted_by
        FROM jsonb_array_elements(_pending.activity_data->'distributions') AS dist;
      ELSE
        -- Single animal feeding
        FOREACH _animal_id IN ARRAY _pending.animal_ids LOOP
          INSERT INTO feeding_records (animal_id, record_datetime, feed_type, kilograms, notes, created_by)
          VALUES (
            _animal_id,
            _record_datetime,
            _pending.activity_data->>'feed_type',
            (_pending.activity_data->>'quantity')::NUMERIC,
            _pending.activity_data->>'notes',
            _pending.submitted_by
          );
        END LOOP;
      END IF;
      
    WHEN 'weight_measurement' THEN
      FOREACH _animal_id IN ARRAY _pending.animal_ids LOOP
        INSERT INTO weight_records (animal_id, weight_kg, measurement_date, recorded_by, notes)
        VALUES (
          _animal_id,
          (_pending.activity_data->>'quantity')::NUMERIC,
          _record_date,
          _pending.submitted_by,
          _pending.activity_data->>'notes'
        );
      END LOOP;
      
    WHEN 'health_observation' THEN
      FOREACH _animal_id IN ARRAY _pending.animal_ids LOOP
        INSERT INTO health_records (animal_id, visit_date, notes, created_by)
        VALUES (
          _animal_id,
          _record_date,
          _pending.activity_data->>'notes',
          _pending.submitted_by
        );
      END LOOP;
      
    WHEN 'injection' THEN
      FOREACH _animal_id IN ARRAY _pending.animal_ids LOOP
        INSERT INTO injection_records (animal_id, record_datetime, medicine_name, dosage, instructions, created_by)
        VALUES (
          _animal_id,
          _record_datetime,
          _pending.activity_data->>'medicine_name',
          _pending.activity_data->>'dosage',
          _pending.activity_data->>'notes',
          _pending.submitted_by
        );
      END LOOP;
  END CASE;
  
  -- Update the pending activity status
  UPDATE pending_activities
  SET 
    status = CASE WHEN _is_auto THEN 'auto_approved'::pending_activity_status ELSE 'approved'::pending_activity_status END,
    reviewed_by = _approved_by,
    reviewed_at = now()
  WHERE id = _pending_id;
  
  -- Create notification for farmhand
  INSERT INTO notifications (user_id, type, title, body)
  VALUES (
    _pending.submitted_by,
    'activity_approved',
    CASE WHEN _is_auto THEN 'Activity Auto-Approved' ELSE 'Activity Approved' END,
    'Your ' || _pending.activity_type::TEXT || ' submission has been ' || 
    CASE WHEN _is_auto THEN 'auto-approved' ELSE 'auto-approved' END || '.'
  );
  
  RETURN jsonb_build_object('success', true, 'activity_id', _pending_id);
END;
$function$;