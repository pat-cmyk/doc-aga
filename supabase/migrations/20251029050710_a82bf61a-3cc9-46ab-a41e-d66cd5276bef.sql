-- Enhanced role-based access control for existing tables
-- This migration adds admin override and ensures proper role enforcement

-- Helper function to check if user is farm manager only (not owner)
CREATE OR REPLACE FUNCTION public.is_farm_manager_only(_user_id uuid, _farm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM farm_memberships
    WHERE farm_id = _farm_id
      AND user_id = _user_id
      AND role_in_farm = 'farmer_owner'
      AND NOT EXISTS (
        SELECT 1 FROM farms 
        WHERE id = _farm_id AND owner_id = _user_id
      )
  )
$$;

-- Update animals delete policy - only owners and admins
DROP POLICY IF EXISTS "animals_delete" ON public.animals;
CREATE POLICY "animals_delete" 
ON public.animals 
FOR DELETE
USING (
  is_farm_owner(auth.uid(), farm_id) 
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- Update farms policies - add admin override
DROP POLICY IF EXISTS "farms_update" ON public.farms;
CREATE POLICY "farms_update"
ON public.farms
FOR UPDATE
USING (
  owner_id = auth.uid() 
  OR has_role(auth.uid(), 'admin'::user_role)
);

DROP POLICY IF EXISTS "farms_delete" ON public.farms;
CREATE POLICY "farms_delete"
ON public.farms
FOR DELETE
USING (
  owner_id = auth.uid() 
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- Update farm memberships policies - add admin override
DROP POLICY IF EXISTS "fm_delete" ON public.farm_memberships;
CREATE POLICY "fm_delete"
ON public.farm_memberships
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM farms f
    WHERE f.id = farm_memberships.farm_id 
    AND f.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::user_role)
);

DROP POLICY IF EXISTS "fm_insert" ON public.farm_memberships;
CREATE POLICY "fm_insert"
ON public.farm_memberships
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM farms f
    WHERE f.id = farm_memberships.farm_id 
    AND f.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::user_role)
);