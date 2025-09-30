-- Create trigger function to automatically add farm owner to memberships
CREATE OR REPLACE FUNCTION public.add_farm_owner_membership()
RETURNS TRIGGER AS $$
BEGIN
  -- Add the farm owner to farm_memberships with owner role
  INSERT INTO public.farm_memberships (farm_id, user_id, role_in_farm)
  VALUES (NEW.id, NEW.owner_id, 'farmer_owner');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on farms table
CREATE TRIGGER trigger_add_farm_owner_membership
  AFTER INSERT ON public.farms
  FOR EACH ROW
  EXECUTE FUNCTION public.add_farm_owner_membership();

-- Backfill existing farms that don't have memberships
INSERT INTO public.farm_memberships (farm_id, user_id, role_in_farm)
SELECT f.id, f.owner_id, 'farmer_owner'
FROM public.farms f
LEFT JOIN public.farm_memberships fm ON fm.farm_id = f.id AND fm.user_id = f.owner_id
WHERE fm.id IS NULL;