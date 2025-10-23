-- Migration 3: Remove Role Column from profiles and Create Role Management Functions
-- First, ensure all profiles.role data is migrated to user_roles
-- Insert any missing roles from profiles into user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, p.role::user_role
FROM public.profiles p
WHERE p.role IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = p.id AND ur.role = p.role::user_role
  )
ON CONFLICT (user_id, role) DO NOTHING;

-- Now drop the role column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- Create secure RPC function for admins to assign roles
CREATE OR REPLACE FUNCTION public.admin_assign_role(
  _user_id UUID,
  _role user_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is super admin
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can assign roles';
  END IF;
  
  -- Insert or update role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Create function to remove role
CREATE OR REPLACE FUNCTION public.admin_remove_role(
  _user_id UUID,
  _role user_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is super admin
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can remove roles';
  END IF;
  
  DELETE FROM public.user_roles
  WHERE user_id = _user_id AND role = _role;
END;
$$;