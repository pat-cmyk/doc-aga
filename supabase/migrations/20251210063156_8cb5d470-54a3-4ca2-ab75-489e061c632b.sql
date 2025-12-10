-- Update can_access_farm to allow super admin access
CREATE OR REPLACE FUNCTION public.can_access_farm(fid uuid)
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Super admins can access any farm
    public.is_super_admin(auth.uid()) 
    OR 
    -- Regular access: owner or member
    EXISTS(
      SELECT 1
      FROM public.farms f
      LEFT JOIN public.farm_memberships fm ON fm.farm_id = f.id AND fm.user_id = auth.uid()
      WHERE f.id = fid AND (f.owner_id = auth.uid() OR fm.user_id IS NOT NULL)
    )
$$;