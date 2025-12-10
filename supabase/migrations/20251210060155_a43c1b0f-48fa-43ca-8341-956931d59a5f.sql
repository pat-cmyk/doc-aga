
-- Phase 1: Admin Farm Editing Capabilities

-- Create admin_farm_edits audit table for detailed change tracking
CREATE TABLE public.admin_farm_edits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL,
  reason TEXT NOT NULL,
  ticket_number TEXT,
  changes_made JSONB NOT NULL DEFAULT '{}',
  previous_values JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on admin_farm_edits
ALTER TABLE public.admin_farm_edits ENABLE ROW LEVEL SECURITY;

-- Only super admins can view audit logs
CREATE POLICY "Super admins can view farm edit audits"
ON public.admin_farm_edits
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Only super admins can insert audit logs (via the edit function)
CREATE POLICY "System can insert farm edit audits"
ON public.admin_farm_edits
FOR INSERT
WITH CHECK (is_super_admin(auth.uid()));

-- RLS policy allowing super admins to UPDATE farms
CREATE POLICY "Super admins can update farms"
ON public.farms
FOR UPDATE
USING (is_super_admin(auth.uid()));

-- Create function to safely edit farm with audit logging
CREATE OR REPLACE FUNCTION public.admin_edit_farm(
  _farm_id UUID,
  _changes JSONB,
  _reason TEXT,
  _ticket_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin_id UUID;
  _previous_values JSONB;
  _farm RECORD;
BEGIN
  -- Verify caller is super admin
  _admin_id := auth.uid();
  IF NOT is_super_admin(_admin_id) THEN
    RAISE EXCEPTION 'Only super admins can edit farms';
  END IF;

  -- Get current farm values for audit
  SELECT 
    name, region, province, municipality, gps_lat, gps_lng, 
    livestock_type, ffedis_id, lgu_code, validation_status,
    is_program_participant, program_group
  INTO _farm
  FROM farms WHERE id = _farm_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Farm not found';
  END IF;

  -- Build previous values JSON
  _previous_values := jsonb_build_object(
    'name', _farm.name,
    'region', _farm.region,
    'province', _farm.province,
    'municipality', _farm.municipality,
    'gps_lat', _farm.gps_lat,
    'gps_lng', _farm.gps_lng,
    'livestock_type', _farm.livestock_type,
    'ffedis_id', _farm.ffedis_id,
    'lgu_code', _farm.lgu_code,
    'validation_status', _farm.validation_status,
    'is_program_participant', _farm.is_program_participant,
    'program_group', _farm.program_group
  );

  -- Update the farm with provided changes
  UPDATE farms SET
    name = COALESCE((_changes->>'name')::TEXT, name),
    region = COALESCE((_changes->>'region')::TEXT, region),
    province = COALESCE((_changes->>'province')::TEXT, province),
    municipality = COALESCE((_changes->>'municipality')::TEXT, municipality),
    gps_lat = COALESCE((_changes->>'gps_lat')::NUMERIC, gps_lat),
    gps_lng = COALESCE((_changes->>'gps_lng')::NUMERIC, gps_lng),
    livestock_type = COALESCE((_changes->>'livestock_type')::TEXT, livestock_type),
    ffedis_id = COALESCE((_changes->>'ffedis_id')::TEXT, ffedis_id),
    lgu_code = COALESCE((_changes->>'lgu_code')::TEXT, lgu_code),
    validation_status = COALESCE((_changes->>'validation_status')::TEXT, validation_status),
    is_program_participant = COALESCE((_changes->>'is_program_participant')::BOOLEAN, is_program_participant),
    program_group = COALESCE((_changes->>'program_group')::TEXT, program_group),
    updated_at = now()
  WHERE id = _farm_id;

  -- Insert audit record
  INSERT INTO admin_farm_edits (farm_id, admin_id, reason, ticket_number, changes_made, previous_values)
  VALUES (_farm_id, _admin_id, _reason, _ticket_number, _changes, _previous_values);

  -- Log to activity logs
  PERFORM log_user_activity(
    _admin_id,
    'admin_farm_edit',
    'admin_action',
    'Edited farm: ' || _farm.name,
    jsonb_build_object(
      'farm_id', _farm_id,
      'reason', _reason,
      'ticket_number', _ticket_number,
      'changes', _changes
    )
  );

  RETURN jsonb_build_object('success', true, 'farm_id', _farm_id);
END;
$$;

-- Phase 2: Admin Animal Management

-- RLS policy allowing super admins to INSERT/UPDATE animals
CREATE POLICY "Super admins can insert animals"
ON public.animals
FOR INSERT
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update animals"
ON public.animals
FOR UPDATE
USING (is_super_admin(auth.uid()));

-- Create admin_animal_edits audit table
CREATE TABLE public.admin_animal_edits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  animal_id UUID NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL,
  action_type TEXT NOT NULL, -- 'create', 'update'
  reason TEXT NOT NULL,
  ticket_number TEXT,
  changes_made JSONB NOT NULL DEFAULT '{}',
  previous_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on admin_animal_edits
ALTER TABLE public.admin_animal_edits ENABLE ROW LEVEL SECURITY;

-- Only super admins can view animal edit audits
CREATE POLICY "Super admins can view animal edit audits"
ON public.admin_animal_edits
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Only super admins can insert animal edit audits
CREATE POLICY "System can insert animal edit audits"
ON public.admin_animal_edits
FOR INSERT
WITH CHECK (is_super_admin(auth.uid()));

-- Create function to safely add animal with audit logging
CREATE OR REPLACE FUNCTION public.admin_add_animal(
  _farm_id UUID,
  _animal_data JSONB,
  _reason TEXT,
  _ticket_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin_id UUID;
  _animal_id UUID;
  _livestock_type TEXT;
BEGIN
  -- Verify caller is super admin
  _admin_id := auth.uid();
  IF NOT is_super_admin(_admin_id) THEN
    RAISE EXCEPTION 'Only super admins can add animals on behalf of farmers';
  END IF;

  -- Get livestock type from farm
  SELECT livestock_type INTO _livestock_type FROM farms WHERE id = _farm_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Farm not found';
  END IF;

  -- Insert the animal
  INSERT INTO animals (
    farm_id,
    name,
    ear_tag,
    breed,
    gender,
    birth_date,
    livestock_type,
    life_stage,
    current_weight_kg
  ) VALUES (
    _farm_id,
    (_animal_data->>'name')::TEXT,
    (_animal_data->>'ear_tag')::TEXT,
    (_animal_data->>'breed')::TEXT,
    (_animal_data->>'gender')::TEXT,
    (_animal_data->>'birth_date')::DATE,
    COALESCE((_animal_data->>'livestock_type')::TEXT, _livestock_type),
    (_animal_data->>'life_stage')::TEXT,
    (_animal_data->>'current_weight_kg')::NUMERIC
  )
  RETURNING id INTO _animal_id;

  -- Insert audit record
  INSERT INTO admin_animal_edits (animal_id, farm_id, admin_id, action_type, reason, ticket_number, changes_made)
  VALUES (_animal_id, _farm_id, _admin_id, 'create', _reason, _ticket_number, _animal_data);

  -- Log to activity logs
  PERFORM log_user_activity(
    _admin_id,
    'admin_animal_create',
    'admin_action',
    'Added animal to farm on behalf of farmer',
    jsonb_build_object(
      'animal_id', _animal_id,
      'farm_id', _farm_id,
      'reason', _reason,
      'ticket_number', _ticket_number
    )
  );

  RETURN jsonb_build_object('success', true, 'animal_id', _animal_id);
END;
$$;

-- Create function to safely edit animal with audit logging
CREATE OR REPLACE FUNCTION public.admin_edit_animal(
  _animal_id UUID,
  _changes JSONB,
  _reason TEXT,
  _ticket_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin_id UUID;
  _previous_values JSONB;
  _animal RECORD;
BEGIN
  -- Verify caller is super admin
  _admin_id := auth.uid();
  IF NOT is_super_admin(_admin_id) THEN
    RAISE EXCEPTION 'Only super admins can edit animals on behalf of farmers';
  END IF;

  -- Get current animal values for audit
  SELECT 
    id, farm_id, name, ear_tag, breed, gender, birth_date, 
    livestock_type, life_stage, current_weight_kg
  INTO _animal
  FROM animals WHERE id = _animal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Animal not found';
  END IF;

  -- Build previous values JSON
  _previous_values := jsonb_build_object(
    'name', _animal.name,
    'ear_tag', _animal.ear_tag,
    'breed', _animal.breed,
    'gender', _animal.gender,
    'birth_date', _animal.birth_date,
    'livestock_type', _animal.livestock_type,
    'life_stage', _animal.life_stage,
    'current_weight_kg', _animal.current_weight_kg
  );

  -- Update the animal with provided changes
  UPDATE animals SET
    name = COALESCE((_changes->>'name')::TEXT, name),
    ear_tag = COALESCE((_changes->>'ear_tag')::TEXT, ear_tag),
    breed = COALESCE((_changes->>'breed')::TEXT, breed),
    gender = COALESCE((_changes->>'gender')::TEXT, gender),
    birth_date = COALESCE((_changes->>'birth_date')::DATE, birth_date),
    life_stage = COALESCE((_changes->>'life_stage')::TEXT, life_stage),
    current_weight_kg = COALESCE((_changes->>'current_weight_kg')::NUMERIC, current_weight_kg),
    updated_at = now()
  WHERE id = _animal_id;

  -- Insert audit record
  INSERT INTO admin_animal_edits (animal_id, farm_id, admin_id, action_type, reason, ticket_number, changes_made, previous_values)
  VALUES (_animal_id, _animal.farm_id, _admin_id, 'update', _reason, _ticket_number, _changes, _previous_values);

  -- Log to activity logs
  PERFORM log_user_activity(
    _admin_id,
    'admin_animal_edit',
    'admin_action',
    'Edited animal: ' || COALESCE(_animal.name, _animal.ear_tag, 'Unknown'),
    jsonb_build_object(
      'animal_id', _animal_id,
      'farm_id', _animal.farm_id,
      'reason', _reason,
      'ticket_number', _ticket_number,
      'changes', _changes
    )
  );

  RETURN jsonb_build_object('success', true, 'animal_id', _animal_id);
END;
$$;
