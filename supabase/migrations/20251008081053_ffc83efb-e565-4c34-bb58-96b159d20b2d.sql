-- Update animals_select RLS policy to include admin access
DROP POLICY IF EXISTS animals_select ON animals;

CREATE POLICY animals_select ON animals
  FOR SELECT
  USING (
    can_access_farm(farm_id) 
    OR has_role(auth.uid(), 'admin'::user_role)
  );