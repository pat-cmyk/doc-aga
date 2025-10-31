-- Update RLS policy to allow farmhands to update feed inventory
DROP POLICY IF EXISTS "Farm members can update feed inventory" ON feed_inventory;
DROP POLICY IF EXISTS "Farm owners and managers can update feed inventory" ON feed_inventory;

CREATE POLICY "Farm members can update feed inventory"
ON feed_inventory
FOR UPDATE
TO authenticated
USING (
  is_farm_owner(auth.uid(), farm_id) 
  OR is_farm_manager(auth.uid(), farm_id)
  OR is_farmhand(auth.uid(), farm_id)
);