-- Update approve_pending_activity to carry input_method from pending_activities to target records
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
BEGIN
  -- Get the pending activity
  SELECT * INTO _pending
  FROM pending_activities
  WHERE id = _pending_id AND status = 'pending'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Activity not found or already processed');
  END IF;
  
  -- Extract input_method from the pending activity (column-level, not from activity_data)
  _input_method := COALESCE(_pending.input_method, 'typed');
  
  -- Extract common data
  _record_date := COALESCE(
    (_pending.activity_data->>'validated_date')::DATE,
    (_pending.created_at)::DATE
  );
  _record_datetime := COALESCE(
    (_pending.activity_data->>'validated_datetime')::TIMESTAMP WITH TIME ZONE,
    _pending.created_at
  );
  
  -- Extract and normalize session for milking
  _raw_session := LOWER(COALESCE(_pending.activity_data->>'session', ''));
  _session := CASE 
    WHEN _raw_session IN ('am', 'morning', 'umaga') THEN 'AM'
    WHEN _raw_session IN ('pm', 'afternoon', 'evening', 'hapon', 'gabi') THEN 'PM'
    WHEN _raw_session IN ('full day', 'fullday', 'whole day', 'buong araw', 'all day') THEN 'Full Day'
    WHEN _raw_session = '' THEN 
      CASE WHEN EXTRACT(HOUR FROM _record_datetime) < 12 THEN 'AM' ELSE 'PM' END
    ELSE 'AM'
  END;
  
  -- Insert into appropriate production table based on activity type
  CASE _pending.activity_type
    WHEN 'milking' THEN
      IF _pending.activity_data ? 'distributions_by_type' AND 
         jsonb_array_length(_pending.activity_data->'distributions_by_type') > 0 THEN
        FOR _dist IN SELECT * FROM jsonb_array_elements(_pending.activity_data->'distributions_by_type')
        LOOP
          FOR _animal_dist IN SELECT * FROM jsonb_array_elements(_dist->'distributions')
          LOOP
            IF (_animal_dist->>'milk_liters')::NUMERIC > 0 THEN
              INSERT INTO milking_records (animal_id, record_date, liters, session, created_by, input_method)
              VALUES (
                (_animal_dist->>'animal_id')::UUID,
                _record_date,
                (_animal_dist->>'milk_liters')::NUMERIC,
                _session,
                _pending.submitted_by,
                _input_method
              );
            END IF;
          END LOOP;
        END LOOP;
      ELSE
        FOREACH _animal_id IN ARRAY _pending.animal_ids LOOP
          INSERT INTO milking_records (animal_id, record_date, liters, session, created_by, input_method)
          VALUES (
            _animal_id,
            _record_date,
            (_pending.activity_data->>'quantity')::NUMERIC,
            _session,
            _pending.submitted_by,
            _input_method
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
    CASE WHEN _is_auto THEN 'auto-approved' ELSE 'approved' END || '.'
  );
  
  RETURN jsonb_build_object('success', true, 'activity_id', _pending_id);
END;
$function$;

-- Also update the 2-param version to carry input_method
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
      INSERT INTO milking_records (animal_id, liters, record_date, session, created_by, client_generated_id, input_method)
      VALUES (
        _activity.animal_id,
        (_activity.extracted_data->>'quantity')::numeric,
        (_record_datetime AT TIME ZONE 'Asia/Manila')::date,
        _session,
        _activity.submitted_by,
        'pa_' || _activity.id::text,
        _input_method
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

-- Phase 3: Create get_data_entry_analytics RPC
CREATE OR REPLACE FUNCTION public.get_data_entry_analytics(
  _start_date date DEFAULT (CURRENT_DATE - interval '30 days')::date,
  _end_date date DEFAULT CURRENT_DATE,
  _data_category text DEFAULT 'all',
  _region text DEFAULT NULL,
  _province text DEFAULT NULL,
  _municipality text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _summary jsonb;
  _daily jsonb;
  _by_type jsonb;
  _by_location jsonb;
  _prev_voice bigint;
  _prev_total bigint;
BEGIN
  -- Build a temp table of all records with input_method + farm location
  CREATE TEMP TABLE _all_entries ON COMMIT DROP AS
  SELECT r.input_method, r.entry_date, r.activity_type, f.region, f.province, f.municipality
  FROM (
    SELECT input_method, record_date AS entry_date, 'milking'::text AS activity_type, a.farm_id
    FROM milking_records mr JOIN animals a ON a.id = mr.animal_id
    WHERE mr.record_date BETWEEN _start_date AND _end_date
    UNION ALL
    SELECT input_method, (record_datetime AT TIME ZONE 'Asia/Manila')::date, 'feeding', a.farm_id
    FROM feeding_records fr JOIN animals a ON a.id = fr.animal_id
    WHERE (fr.record_datetime AT TIME ZONE 'Asia/Manila')::date BETWEEN _start_date AND _end_date
    UNION ALL
    SELECT input_method, measurement_date, 'weight', a.farm_id
    FROM weight_records wr JOIN animals a ON a.id = wr.animal_id
    WHERE wr.measurement_date BETWEEN _start_date AND _end_date
    UNION ALL
    SELECT input_method, visit_date, 'health', a.farm_id
    FROM health_records hr JOIN animals a ON a.id = hr.animal_id
    WHERE hr.visit_date BETWEEN _start_date AND _end_date
    UNION ALL
    SELECT input_method, (record_datetime AT TIME ZONE 'Asia/Manila')::date, 'injection', a.farm_id
    FROM injection_records ir JOIN animals a ON a.id = ir.animal_id
    WHERE (ir.record_datetime AT TIME ZONE 'Asia/Manila')::date BETWEEN _start_date AND _end_date
  ) r
  JOIN farms f ON f.id = r.farm_id AND f.is_deleted = false
  WHERE (_data_category = 'all' OR f.data_category = _data_category)
    AND (_region IS NULL OR f.region = _region)
    AND (_province IS NULL OR f.province = _province)
    AND (_municipality IS NULL OR f.municipality = _municipality);

  -- Summary
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'voice_count', COUNT(*) FILTER (WHERE input_method = 'voice'),
    'typed_count', COUNT(*) FILTER (WHERE input_method = 'typed'),
    'voice_pct', CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE input_method = 'voice')::numeric / COUNT(*)::numeric * 100, 1) ELSE 0 END
  ) INTO _summary FROM _all_entries;

  -- Previous period for trend
  SELECT COUNT(*) FILTER (WHERE input_method = 'voice'), COUNT(*)
  INTO _prev_voice, _prev_total
  FROM (
    SELECT input_method
    FROM milking_records mr JOIN animals a ON a.id = mr.animal_id JOIN farms f ON f.id = a.farm_id
    WHERE mr.record_date BETWEEN (_start_date - (_end_date - _start_date)) AND (_start_date - 1)
      AND (_data_category = 'all' OR f.data_category = _data_category) AND f.is_deleted = false
  ) prev;
  
  _summary := _summary || jsonb_build_object(
    'prev_voice_pct', CASE WHEN _prev_total > 0 THEN ROUND(_prev_voice::numeric / _prev_total::numeric * 100, 1) ELSE 0 END
  );

  -- Daily breakdown
  SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.day), '[]'::jsonb)
  INTO _daily
  FROM (
    SELECT entry_date AS day,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE input_method = 'voice') AS voice_count,
      COUNT(*) FILTER (WHERE input_method = 'typed') AS typed_count
    FROM _all_entries
    GROUP BY entry_date
  ) d;

  -- By activity type
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO _by_type
  FROM (
    SELECT activity_type,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE input_method = 'voice') AS voice_count,
      CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE input_method = 'voice')::numeric / COUNT(*)::numeric * 100, 1) ELSE 0 END AS voice_pct
    FROM _all_entries
    GROUP BY activity_type
    ORDER BY total DESC
  ) t;

  -- By location (region level)
  SELECT COALESCE(jsonb_agg(row_to_json(l)), '[]'::jsonb)
  INTO _by_location
  FROM (
    SELECT COALESCE(region, 'Unknown') AS region,
      COALESCE(province, 'Unknown') AS province,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE input_method = 'voice') AS voice_count,
      COUNT(*) FILTER (WHERE input_method = 'typed') AS typed_count,
      CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE input_method = 'voice')::numeric / COUNT(*)::numeric * 100, 1) ELSE 0 END AS voice_pct
    FROM _all_entries
    GROUP BY region, province
    ORDER BY total DESC
  ) l;

  RETURN jsonb_build_object(
    'summary', _summary,
    'daily', _daily,
    'by_type', _by_type,
    'by_location', _by_location
  );
END;
$fn$;