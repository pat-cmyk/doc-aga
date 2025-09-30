-- Drop the existing buggy farms_select policy
DROP POLICY IF EXISTS "farms_select" ON public.farms;

-- Create security definer function to check farm membership
CREATE OR REPLACE FUNCTION public.is_farm_member(farm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.farms f
    LEFT JOIN public.farm_memberships fm ON fm.farm_id = f.id
    WHERE f.id = farm_id 
      AND (f.owner_id = auth.uid() OR fm.user_id = auth.uid())
  );
$$;

-- Create new farms_select policy using the security definer function
CREATE POLICY "farms_select" ON public.farms
FOR SELECT
USING (public.is_farm_member(id));