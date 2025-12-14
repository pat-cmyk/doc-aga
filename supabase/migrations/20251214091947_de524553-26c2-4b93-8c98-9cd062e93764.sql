-- Fix: Remove overly permissive team_profiles_select policy
-- This policy exposed email and phone to farm owners/managers which is a privacy risk

-- Drop the problematic policy
DROP POLICY IF EXISTS "team_profiles_select" ON public.profiles;

-- Create a secure RPC function for team member access that only returns safe fields
CREATE OR REPLACE FUNCTION public.get_team_members(p_farm_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  role_in_farm user_role,
  invitation_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has access to this farm as owner or manager
  IF NOT (is_farm_owner(auth.uid(), p_farm_id) OR is_farm_manager(auth.uid(), p_farm_id)) THEN
    RAISE EXCEPTION 'Access denied: must be farm owner or manager';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    fm.role_in_farm,
    fm.invitation_status
  FROM farm_memberships fm
  JOIN profiles p ON p.id = fm.user_id
  WHERE fm.farm_id = p_farm_id
    AND fm.user_id IS NOT NULL
    AND fm.invitation_status = 'accepted';
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_team_members(uuid) TO authenticated;