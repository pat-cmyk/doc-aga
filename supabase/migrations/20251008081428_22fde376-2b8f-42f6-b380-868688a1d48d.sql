-- Update profiles RLS policy to allow admins to see all profiles
DROP POLICY IF EXISTS "profiles_select" ON profiles;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT
  USING (
    auth.uid() = id 
    OR has_role(auth.uid(), 'admin'::user_role)
  );