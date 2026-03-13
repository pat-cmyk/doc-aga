-- ============================================================================
-- Fix historical feeding_records.cost_per_kg_at_time
-- ============================================================================
-- The calculateCostPerKg() function had a bug where it divided cost_per_unit
-- by weight_per_unit for non-kg units (bags, bales, barrels). Since
-- cost_per_unit is stored as ₱/kg, this produced wrong values:
--   e.g., 6 / 200 = 0.03 instead of 6
--
-- This migration corrects all affected feeding_records by setting
-- cost_per_kg_at_time = feed_inventory.cost_per_unit for records linked
-- to inventory items with non-kg units and weight_per_unit > 0.
-- ============================================================================

UPDATE feeding_records fr
SET cost_per_kg_at_time = fi.cost_per_unit
FROM feed_inventory fi
WHERE fr.feed_inventory_id = fi.id
  AND fi.unit IN ('bags', 'bales', 'barrels')
  AND fi.weight_per_unit IS NOT NULL
  AND fi.weight_per_unit > 0
  AND fi.cost_per_unit IS NOT NULL
  AND fi.cost_per_unit > 0
  AND fr.cost_per_kg_at_time IS NOT NULL
  AND fr.cost_per_kg_at_time > 0
  -- Only fix records where the cost was incorrectly divided
  -- (current value ≈ cost_per_unit / weight_per_unit)
  AND ABS(fr.cost_per_kg_at_time - (fi.cost_per_unit / fi.weight_per_unit)) < 0.01;
