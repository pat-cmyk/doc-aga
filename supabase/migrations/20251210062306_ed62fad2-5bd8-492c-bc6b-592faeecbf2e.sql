-- Phase 5: Enhanced User Management

-- 1. Add is_disabled column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_disabled boolean DEFAULT false;

-- 2. Create admin_profile_edits audit table
CREATE TABLE IF NOT EXISTS public.admin_profile_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL,
  changes_made jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_values jsonb,
  reason text NOT NULL,
  ticket_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on audit table
ALTER TABLE public.admin_profile_edits ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin_profile_edits
CREATE POLICY "Super admins can view profile edit audits"
ON public.admin_profile_edits FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "System can insert profile edit audits"
ON public.admin_profile_edits FOR INSERT
WITH CHECK (is_super_admin(auth.uid()));

-- 3. Create admin_edit_profile RPC function
CREATE OR REPLACE FUNCTION public.admin_edit_profile(
  _profile_id uuid,
  _changes jsonb,
  _reason text,
  _ticket_number text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_id UUID;
  _previous_values JSONB;
  _profile RECORD;
BEGIN
  -- Verify caller is super admin
  _admin_id := auth.uid();
  IF NOT is_super_admin(_admin_id) THEN
    RAISE EXCEPTION 'Only super admins can edit user profiles';
  END IF;

  -- Get current profile values for audit
  SELECT id, full_name, phone, is_disabled
  INTO _profile
  FROM profiles WHERE id = _profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Build previous values JSON
  _previous_values := jsonb_build_object(
    'full_name', _profile.full_name,
    'phone', _profile.phone,
    'is_disabled', _profile.is_disabled
  );

  -- Update the profile with provided changes
  UPDATE profiles SET
    full_name = COALESCE((_changes->>'full_name')::TEXT, full_name),
    phone = COALESCE((_changes->>'phone')::TEXT, phone),
    is_disabled = COALESCE((_changes->>'is_disabled')::BOOLEAN, is_disabled)
  WHERE id = _profile_id;

  -- Insert audit record
  INSERT INTO admin_profile_edits (profile_id, admin_id, reason, ticket_number, changes_made, previous_values)
  VALUES (_profile_id, _admin_id, _reason, _ticket_number, _changes, _previous_values);

  -- Log to activity logs
  PERFORM log_user_activity(
    _admin_id,
    'admin_profile_edit',
    'admin_action',
    'Edited user profile',
    jsonb_build_object(
      'profile_id', _profile_id,
      'reason', _reason,
      'ticket_number', _ticket_number,
      'changes', _changes
    )
  );

  RETURN jsonb_build_object('success', true, 'profile_id', _profile_id);
END;
$$;

-- 4. Create admin_disable_user function
CREATE OR REPLACE FUNCTION public.admin_disable_user(_profile_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN admin_edit_profile(
    _profile_id,
    jsonb_build_object('is_disabled', true),
    _reason
  );
END;
$$;

-- 5. Create admin_enable_user function
CREATE OR REPLACE FUNCTION public.admin_enable_user(_profile_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN admin_edit_profile(
    _profile_id,
    jsonb_build_object('is_disabled', false),
    _reason
  );
END;
$$;