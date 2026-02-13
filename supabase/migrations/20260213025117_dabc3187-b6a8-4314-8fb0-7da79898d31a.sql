-- Add 'Full Day' to milking_records session CHECK constraint
ALTER TABLE milking_records DROP CONSTRAINT IF EXISTS milking_records_session_check;
ALTER TABLE milking_records ADD CONSTRAINT milking_records_session_check 
  CHECK (session IN ('AM', 'PM', 'Full Day'));

-- Update approve_pending_activity RPC to recognize 'Full Day' variants
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
BEGIN
  -- Get the pending activity
  SELECT * INTO _activity FROM pending_activities WHERE id = p_activity_id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Activity not found or already processed');
  END IF;

  -- Verify approver has permission (owner or manager of the farm)
  IF NOT EXISTS (
    SELECT 1 FROM farm_memberships 
    WHERE farm_id = _activity.farm_id 
    AND user_id = p_approver_id 
    AND role_in_farm IN ('farmer_owner', 'admin')
    AND invitation_status = 'accepted'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to approve');
  END IF;

  -- Get the animal info
  SELECT * INTO _animal FROM animals WHERE id = _activity.animal_id;

  -- Normalize session
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

  -- Process based on activity type
  CASE _activity.activity_type
    WHEN 'milking' THEN
      INSERT INTO milking_records (animal_id, liters, record_date, session, created_by, client_generated_id)
      VALUES (
        _activity.animal_id,
        (_activity.extracted_data->>'quantity')::numeric,
        (_record_datetime AT TIME ZONE 'Asia/Manila')::date,
        _session,
        _activity.submitted_by,
        'pa_' || _activity.id::text
      )
      RETURNING id INTO _result_id;

    WHEN 'feeding' THEN
      INSERT INTO feeding_records (animal_id, quantity_kg, feed_type, record_datetime, created_by, client_generated_id)
      VALUES (
        _activity.animal_id,
        (_activity.extracted_data->>'quantity')::numeric,
        coalesce(_activity.extracted_data->>'feed_type', 'General Feed'),
        _record_datetime,
        _activity.submitted_by,
        'pa_' || _activity.id::text
      )
      RETURNING id INTO _result_id;

    WHEN 'health_observation' THEN
      INSERT INTO health_records (animal_id, visit_date, diagnosis, notes, created_by, client_generated_id)
      VALUES (
        _activity.animal_id,
        (_record_datetime AT TIME ZONE 'Asia/Manila')::date,
        coalesce(_activity.extracted_data->>'diagnosis', 'Observation'),
        _activity.extracted_data->>'notes',
        _activity.submitted_by,
        'pa_' || _activity.id::text
      )
      RETURNING id INTO _result_id;

    WHEN 'weight_measurement' THEN
      INSERT INTO weight_records (animal_id, weight_kg, measurement_date, measurement_method, notes, created_by, client_generated_id)
      VALUES (
        _activity.animal_id,
        (_activity.extracted_data->>'quantity')::numeric,
        (_record_datetime AT TIME ZONE 'Asia/Manila')::date,
        coalesce(_activity.extracted_data->>'measurement_method', 'scale'),
        _activity.extracted_data->>'notes',
        _activity.submitted_by,
        'pa_' || _activity.id::text
      )
      RETURNING id INTO _result_id;

    WHEN 'injection' THEN
      INSERT INTO injection_records (animal_id, injection_date, medication_name, dosage, route, administered_by, notes, created_by, client_generated_id)
      VALUES (
        _activity.animal_id,
        (_record_datetime AT TIME ZONE 'Asia/Manila')::date,
        coalesce(_activity.extracted_data->>'medication_name', 'Unknown'),
        _activity.extracted_data->>'dosage',
        coalesce(_activity.extracted_data->>'route', 'IM'),
        _activity.submitted_by,
        _activity.extracted_data->>'notes',
        _activity.submitted_by,
        'pa_' || _activity.id::text
      )
      RETURNING id INTO _result_id;

    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Unknown activity type: ' || _activity.activity_type);
  END CASE;

  -- Update the pending activity status
  UPDATE pending_activities 
  SET status = 'approved', 
      reviewed_by = p_approver_id, 
      reviewed_at = now()
  WHERE id = p_activity_id;

  -- Create notification for the farmhand
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