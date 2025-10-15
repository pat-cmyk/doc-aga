-- Allow farmhands to insert feed stock transactions when recording feeding activities
DROP POLICY IF EXISTS "Farm owners and managers can insert transactions" ON feed_stock_transactions;

CREATE POLICY "Farm members can insert transactions"
ON feed_stock_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM feed_inventory fi
    WHERE fi.id = feed_stock_transactions.feed_inventory_id
    AND (
      is_farm_owner(auth.uid(), fi.farm_id)
      OR is_farm_manager(auth.uid(), fi.farm_id)
      OR is_farmhand(auth.uid(), fi.farm_id)
    )
  )
);