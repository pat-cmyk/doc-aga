-- Migration: Merge duplicate feed inventory items
--
-- Problem: Multiple feed_inventory rows exist for the same feed_type + category
-- within a farm (e.g., two "Bag Corn Silage" roughage cards, two "Drum Silage").
-- This happened because the old Add Feed Stock flow always created a new row
-- on repurchase instead of merging into the existing item.
--
-- Strategy: For each set of duplicates (same farm_id + normalized feed_type + category):
-- 1. Pick the "keeper" (highest quantity_kg, then earliest created_at as tiebreaker)
-- 2. Re-point all FK references from duplicate rows to the keeper
-- 3. Add the duplicate's quantity to the keeper
-- 4. Recalculate weighted-average cost
-- 5. Delete the duplicate rows
--
-- FK dependencies to handle:
-- - feed_stock_transactions.feed_inventory_id (ON DELETE CASCADE, but we move first)
-- - feeding_records.feed_inventory_id (nullable, no cascade)
-- - farm_expenses.linked_feed_inventory_id (nullable, no cascade)

DO $$
DECLARE
  v_dup RECORD;
  v_keeper_id uuid;
  v_keeper_qty numeric;
  v_keeper_cost numeric;
  v_dup_item RECORD;
  v_new_total_qty numeric;
  v_weighted_cost numeric;
  v_latest_expiry date;
BEGIN
  -- Find all duplicate groups: same farm_id + lower(feed_type) + category with > 1 row
  FOR v_dup IN
    SELECT
      farm_id,
      lower(trim(feed_type)) AS norm_feed_type,
      COALESCE(category, 'roughage') AS norm_category,
      count(*) AS cnt
    FROM feed_inventory
    WHERE is_deleted IS NOT TRUE
    GROUP BY farm_id, lower(trim(feed_type)), COALESCE(category, 'roughage')
    HAVING count(*) > 1
  LOOP
    RAISE NOTICE 'Merging % duplicates of "%" (%) in farm %',
      v_dup.cnt, v_dup.norm_feed_type, v_dup.norm_category, v_dup.farm_id;

    -- Pick the keeper: highest quantity, then earliest created
    SELECT id, quantity_kg, COALESCE(cost_per_unit, 0)
    INTO v_keeper_id, v_keeper_qty, v_keeper_cost
    FROM feed_inventory
    WHERE farm_id = v_dup.farm_id
      AND lower(trim(feed_type)) = v_dup.norm_feed_type
      AND COALESCE(category, 'roughage') = v_dup.norm_category
      AND is_deleted IS NOT TRUE
    ORDER BY quantity_kg DESC, created_at ASC
    LIMIT 1;

    -- Initialize accumulator with keeper's values
    v_new_total_qty := v_keeper_qty;
    v_weighted_cost := v_keeper_qty * v_keeper_cost;

    -- Find the latest expiry across all items in this group
    SELECT MAX(expiry_date)
    INTO v_latest_expiry
    FROM feed_inventory
    WHERE farm_id = v_dup.farm_id
      AND lower(trim(feed_type)) = v_dup.norm_feed_type
      AND COALESCE(category, 'roughage') = v_dup.norm_category
      AND is_deleted IS NOT TRUE;

    -- Process each duplicate (non-keeper) row
    FOR v_dup_item IN
      SELECT id, quantity_kg, COALESCE(cost_per_unit, 0) AS cost_per_unit, supplier
      FROM feed_inventory
      WHERE farm_id = v_dup.farm_id
        AND lower(trim(feed_type)) = v_dup.norm_feed_type
        AND COALESCE(category, 'roughage') = v_dup.norm_category
        AND is_deleted IS NOT TRUE
        AND id != v_keeper_id
    LOOP
      -- 1. Re-point feed_stock_transactions to keeper
      UPDATE feed_stock_transactions
      SET feed_inventory_id = v_keeper_id
      WHERE feed_inventory_id = v_dup_item.id;

      -- 2. Re-point feeding_records to keeper
      UPDATE feeding_records
      SET feed_inventory_id = v_keeper_id
      WHERE feed_inventory_id = v_dup_item.id;

      -- 3. Re-point farm_expenses to keeper
      UPDATE farm_expenses
      SET linked_feed_inventory_id = v_keeper_id
      WHERE linked_feed_inventory_id = v_dup_item.id;

      -- 4. Accumulate quantity and cost for weighted average
      v_new_total_qty := v_new_total_qty + v_dup_item.quantity_kg;
      v_weighted_cost := v_weighted_cost + (v_dup_item.quantity_kg * v_dup_item.cost_per_unit);

      -- 5. Insert a merge transaction for audit trail
      INSERT INTO feed_stock_transactions (
        feed_inventory_id, transaction_type, quantity_change_kg,
        balance_after, notes
      ) VALUES (
        v_keeper_id, 'adjustment', v_dup_item.quantity_kg,
        v_new_total_qty,
        'Merged from duplicate inventory item (ID: ' || v_dup_item.id || ')'
      );

      -- 6. Delete the duplicate row
      DELETE FROM feed_inventory WHERE id = v_dup_item.id;

      RAISE NOTICE '  Merged duplicate % (%.0f kg) into keeper %',
        v_dup_item.id, v_dup_item.quantity_kg, v_keeper_id;
    END LOOP;

    -- 7. Update keeper with merged totals
    UPDATE feed_inventory
    SET
      quantity_kg = v_new_total_qty,
      cost_per_unit = CASE
        WHEN v_new_total_qty > 0 THEN ROUND((v_weighted_cost / v_new_total_qty)::numeric, 2)
        ELSE cost_per_unit
      END,
      expiry_date = v_latest_expiry,
      last_updated = now()
    WHERE id = v_keeper_id;

    RAISE NOTICE '  Keeper % now has %.0f kg total', v_keeper_id, v_new_total_qty;
  END LOOP;
END $$;
