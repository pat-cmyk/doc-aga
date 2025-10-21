-- Enable RLS on profiles table (safe if already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile or team profiles for farms they own/manage
CREATE POLICY team_profiles_select ON public.profiles
FOR SELECT
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.farm_memberships fm
    WHERE fm.user_id = profiles.id
      AND fm.invitation_status = 'accepted'
      AND (is_farm_owner(auth.uid(), fm.farm_id) OR is_farm_manager(auth.uid(), fm.farm_id))
  )
);