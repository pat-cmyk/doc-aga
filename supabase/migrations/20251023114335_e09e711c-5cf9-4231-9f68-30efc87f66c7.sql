-- Migration 2: Add Write Protection RLS Policies to user_roles Table
-- Create audit log table for role changes
CREATE TABLE IF NOT EXISTS public.user_roles_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  changed_by UUID REFERENCES auth.users(id),
  is_super_admin BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_roles_audit ENABLE ROW LEVEL SECURITY;

-- Only super admins can view audit logs
CREATE POLICY "super_admins_view_audit" ON public.user_roles_audit
  FOR SELECT USING (is_super_admin(auth.uid()));

-- Create trigger function for audit logging
CREATE OR REPLACE FUNCTION public.log_user_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO public.user_roles_audit (user_id, role, action, changed_by, is_super_admin)
    VALUES (OLD.user_id, OLD.role, TG_OP, auth.uid(), OLD.is_super_admin);
    RETURN OLD;
  ELSE
    INSERT INTO public.user_roles_audit (user_id, role, action, changed_by, is_super_admin)
    VALUES (NEW.user_id, NEW.role, TG_OP, auth.uid(), NEW.is_super_admin);
    RETURN NEW;
  END IF;
END;
$$;

-- Attach trigger to user_roles table
DROP TRIGGER IF EXISTS audit_user_roles_changes ON public.user_roles;
CREATE TRIGGER audit_user_roles_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_user_role_changes();

-- Add RLS policies for INSERT, UPDATE, DELETE operations
-- Only super admins can INSERT roles
CREATE POLICY "super_admins_insert_roles" ON public.user_roles
  FOR INSERT 
  WITH CHECK (is_super_admin(auth.uid()));

-- Only super admins can UPDATE roles
CREATE POLICY "super_admins_update_roles" ON public.user_roles
  FOR UPDATE 
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Only super admins can DELETE roles
CREATE POLICY "super_admins_delete_roles" ON public.user_roles
  FOR DELETE 
  USING (is_super_admin(auth.uid()));