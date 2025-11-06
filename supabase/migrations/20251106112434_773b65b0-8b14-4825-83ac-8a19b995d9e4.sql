-- Add policy for admins to view all user roles
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid()) OR user_id = auth.uid()
);

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;