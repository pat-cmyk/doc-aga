-- Create user activity logs table
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  activity_category TEXT NOT NULL,
  description TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_user_activity_logs_user_id ON public.user_activity_logs(user_id);
CREATE INDEX idx_user_activity_logs_activity_type ON public.user_activity_logs(activity_type);
CREATE INDEX idx_user_activity_logs_activity_category ON public.user_activity_logs(activity_category);
CREATE INDEX idx_user_activity_logs_created_at ON public.user_activity_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can view activity logs
CREATE POLICY "Admins can view all activity logs"
ON public.user_activity_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role));

-- Policy for system to insert logs
CREATE POLICY "System can insert activity logs"
ON public.user_activity_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Function to log user activity
CREATE OR REPLACE FUNCTION public.log_user_activity(
  _user_id UUID,
  _activity_type TEXT,
  _activity_category TEXT,
  _description TEXT,
  _metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _log_id UUID;
BEGIN
  INSERT INTO public.user_activity_logs (
    user_id,
    activity_type,
    activity_category,
    description,
    metadata
  ) VALUES (
    _user_id,
    _activity_type,
    _activity_category,
    _description,
    _metadata
  ) RETURNING id INTO _log_id;
  
  RETURN _log_id;
END;
$$;

-- Trigger to log role changes from user_roles_audit
CREATE OR REPLACE FUNCTION public.log_role_change_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _description TEXT;
BEGIN
  -- Create description based on action
  IF (TG_OP = 'INSERT') THEN
    _description := 'Role "' || NEW.role || '" assigned to user';
  ELSIF (TG_OP = 'UPDATE') THEN
    _description := 'Role updated from "' || OLD.role || '" to "' || NEW.role || '"';
  ELSIF (TG_OP = 'DELETE') THEN
    _description := 'Role "' || OLD.role || '" removed from user';
  END IF;

  -- Log the activity
  PERFORM log_user_activity(
    COALESCE(NEW.user_id, OLD.user_id),
    'role_change',
    'security',
    _description,
    jsonb_build_object(
      'action', TG_OP,
      'role', COALESCE(NEW.role, OLD.role),
      'changed_by', COALESCE(NEW.changed_by, OLD.changed_by),
      'is_super_admin', COALESCE(NEW.is_super_admin, OLD.is_super_admin)
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach trigger to user_roles_audit table
CREATE TRIGGER log_role_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles_audit
FOR EACH ROW
EXECUTE FUNCTION public.log_role_change_activity();

-- Function to log farm access changes
CREATE OR REPLACE FUNCTION public.log_farm_membership_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _description TEXT;
  _farm_name TEXT;
BEGIN
  -- Get farm name
  SELECT name INTO _farm_name FROM public.farms WHERE id = COALESCE(NEW.farm_id, OLD.farm_id);

  -- Create description based on action
  IF (TG_OP = 'INSERT') THEN
    _description := 'Invited to farm "' || _farm_name || '" as ' || NEW.role_in_farm;
  ELSIF (TG_OP = 'UPDATE' AND OLD.invitation_status != NEW.invitation_status) THEN
    _description := 'Farm invitation ' || NEW.invitation_status || ' for "' || _farm_name || '"';
  ELSIF (TG_OP = 'DELETE') THEN
    _description := 'Removed from farm "' || _farm_name || '"';
  ELSE
    RETURN NEW; -- Skip if no relevant change
  END IF;

  -- Only log if user_id exists
  IF COALESCE(NEW.user_id, OLD.user_id) IS NOT NULL THEN
    PERFORM log_user_activity(
      COALESCE(NEW.user_id, OLD.user_id),
      'farm_access',
      'access_control',
      _description,
      jsonb_build_object(
        'action', TG_OP,
        'farm_id', COALESCE(NEW.farm_id, OLD.farm_id),
        'farm_name', _farm_name,
        'role_in_farm', COALESCE(NEW.role_in_farm, OLD.role_in_farm),
        'invitation_status', COALESCE(NEW.invitation_status, OLD.invitation_status)
      )
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach trigger to farm_memberships table
CREATE TRIGGER log_farm_membership_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.farm_memberships
FOR EACH ROW
EXECUTE FUNCTION public.log_farm_membership_activity();