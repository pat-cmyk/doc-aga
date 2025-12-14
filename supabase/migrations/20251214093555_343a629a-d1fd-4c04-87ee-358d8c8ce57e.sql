-- Revoke direct access from anon and public roles
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM public;

-- Drop redundant duplicate policies (keeping the cleaner ones)
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "admins_select_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "admins_update_profiles" ON public.profiles;

-- The remaining policies are:
-- users_select_own_profile: (auth.uid() = id)
-- users_update_own_profile: (auth.uid() = id)
-- profiles_self_insert: (auth.uid() = id)

-- Add admin SELECT access back as a single clean policy
CREATE POLICY "admins_can_view_all_profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role));

-- Add admin UPDATE access
CREATE POLICY "admins_can_update_profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role));