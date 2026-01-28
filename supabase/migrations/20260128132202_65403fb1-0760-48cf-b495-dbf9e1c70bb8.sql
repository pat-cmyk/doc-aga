-- Fix is_farm_manager() function to correctly check farm_memberships.role_in_farm
-- instead of incorrectly joining user_roles table

CREATE OR REPLACE FUNCTION public.is_farm_manager(_user_id uuid, _farm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.farm_memberships fm
    WHERE fm.farm_id = _farm_id 
      AND fm.user_id = _user_id 
      AND fm.role_in_farm = 'farmer_owner'
      AND fm.invitation_status = 'accepted'
      AND NOT EXISTS (
        SELECT 1 FROM public.farms f 
        WHERE f.id = _farm_id AND f.owner_id = _user_id
      )
  )
$$;