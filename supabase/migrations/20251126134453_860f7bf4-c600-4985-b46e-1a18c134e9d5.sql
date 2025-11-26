-- Phase 1: Database Schema for Hybrid Approval Queue System

-- 1.1 Create Enums
CREATE TYPE pending_activity_type AS ENUM (
  'milking',
  'feeding', 
  'health_observation',
  'weight_measurement',
  'injection'
);

CREATE TYPE pending_activity_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'auto_approved'
);

-- 1.2 Create pending_activities Table
CREATE TABLE public.pending_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type pending_activity_type NOT NULL,
  activity_data JSONB NOT NULL,
  animal_ids UUID[] NOT NULL,
  status pending_activity_status NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  auto_approve_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_activities ENABLE ROW LEVEL SECURITY;

-- 1.3 Create farm_approval_settings Table
CREATE TABLE public.farm_approval_settings (
  farm_id UUID PRIMARY KEY REFERENCES public.farms(id) ON DELETE CASCADE,
  auto_approve_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_approve_hours INTEGER NOT NULL DEFAULT 48,
  require_approval_for_types TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.farm_approval_settings ENABLE ROW LEVEL SECURITY;

-- 1.4 RLS Policies for pending_activities
CREATE POLICY "farmhands_insert_pending"
  ON public.pending_activities FOR INSERT
  WITH CHECK (
    submitted_by = auth.uid() AND
    is_farmhand(auth.uid(), farm_id)
  );

CREATE POLICY "farmhands_view_own_pending"
  ON public.pending_activities FOR SELECT
  USING (submitted_by = auth.uid());

CREATE POLICY "managers_view_farm_pending"
  ON public.pending_activities FOR SELECT
  USING (
    is_farm_owner(auth.uid(), farm_id) OR 
    is_farm_manager(auth.uid(), farm_id)
  );

CREATE POLICY "managers_update_pending"
  ON public.pending_activities FOR UPDATE
  USING (
    is_farm_owner(auth.uid(), farm_id) OR 
    is_farm_manager(auth.uid(), farm_id)
  );

-- 1.5 RLS Policies for farm_approval_settings
CREATE POLICY "members_view_settings"
  ON public.farm_approval_settings FOR SELECT
  USING (can_access_farm(farm_id));

CREATE POLICY "owners_manage_settings"
  ON public.farm_approval_settings FOR ALL
  USING (is_farm_owner(auth.uid(), farm_id));

-- 1.6 Indexes for Performance
CREATE INDEX idx_pending_activities_farm_status 
  ON public.pending_activities(farm_id, status);

CREATE INDEX idx_pending_activities_submitted_by 
  ON public.pending_activities(submitted_by, status);

CREATE INDEX idx_pending_activities_auto_approve 
  ON public.pending_activities(auto_approve_at) 
  WHERE status = 'pending';

-- 1.7 Insert Default Settings for Existing Farms
INSERT INTO public.farm_approval_settings (farm_id, auto_approve_enabled, auto_approve_hours)
SELECT id, true, 48
FROM public.farms
WHERE is_deleted = false
ON CONFLICT (farm_id) DO NOTHING;

-- Phase 2: Database Functions

-- 2.1 Function: requires_approval()
CREATE OR REPLACE FUNCTION public.requires_approval(
  _farm_id UUID,
  _user_id UUID,
  _activity_type TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_farmhand BOOLEAN;
  _settings RECORD;
BEGIN
  -- Only farmhands need approval (owners/managers skip)
  _is_farmhand := is_farmhand(_user_id, _farm_id);
  
  IF NOT _is_farmhand THEN
    RETURN false;
  END IF;
  
  -- Check farm-specific settings
  SELECT * INTO _settings
  FROM farm_approval_settings
  WHERE farm_id = _farm_id;
  
  -- No settings = use defaults (require approval)
  IF NOT FOUND THEN
    RETURN true;
  END IF;
  
  -- Check if this activity type requires approval
  IF _settings.require_approval_for_types IS NOT NULL THEN
    RETURN _activity_type = ANY(_settings.require_approval_for_types);
  END IF;
  
  -- Default: require approval for all types
  RETURN true;
END;
$$;

-- 2.2 Function: calculate_auto_approve_time()
CREATE OR REPLACE FUNCTION public.calculate_auto_approve_time(_farm_id UUID)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hours INTEGER;
BEGIN
  SELECT COALESCE(
    (SELECT auto_approve_hours FROM farm_approval_settings WHERE farm_id = _farm_id),
    48
  ) INTO _hours;
  
  RETURN now() + (_hours || ' hours')::INTERVAL;
END;
$$;

-- 2.3 Function: approve_pending_activity()
CREATE OR REPLACE FUNCTION public.approve_pending_activity(
  _pending_id UUID,
  _approved_by UUID,
  _is_auto BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pending RECORD;
  _result JSONB;
  _animal_id UUID;
  _record_date DATE;
  _record_datetime TIMESTAMP WITH TIME ZONE;
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
  
  -- Insert into appropriate production table based on activity type
  CASE _pending.activity_type
    WHEN 'milking' THEN
      FOREACH _animal_id IN ARRAY _pending.animal_ids LOOP
        INSERT INTO milking_records (animal_id, record_date, liters, created_by)
        VALUES (
          _animal_id,
          _record_date,
          (_pending.activity_data->>'quantity')::NUMERIC,
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
    CASE WHEN _is_auto THEN 'auto-approved' ELSE 'approved' END || '.'
  );
  
  RETURN jsonb_build_object('success', true, 'activity_id', _pending_id);
END;
$$;