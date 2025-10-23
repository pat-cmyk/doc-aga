-- Migration 1: Add Super Admin Flag System
-- Add is_super_admin column to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- Set the current super admin as super admin
UPDATE public.user_roles 
SET is_super_admin = true 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'pat@goldenforage.com'
) 
AND role = 'admin';

-- Update the is_super_admin() function to check the flag instead of hardcoded email
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
      AND is_super_admin = true
  )
$$;