

# Fix: Link Demo Feeding Data to Farm Inventory (with Cost Tracking)

## Problem

The `seed-demo-data` edge function currently generates feeding records using **hardcoded feed types** from `SPECIES_CONFIG` (e.g., "Napier Grass", "Concentrate Feed") with **no connection** to the farm's actual `feed_inventory`. This means:

1. `feed_inventory_id` is always NULL on seeded feeding records
2. `cost_per_kg_at_time` is always NULL -- no cost data flows through
3. Feed types in records don't match what the farm actually has in stock
4. Inventory quantities are never deducted, creating an unrealistic picture

## Current State

- **12 demo farms** have inventory (4-8 items each, with real cost_per_unit values)
- **53 demo farms** have zero inventory items
- Feeding records are inserted with only `animal_id`, `record_datetime`, `feed_type`, `kilograms`, `notes` -- missing `feed_inventory_id` and `cost_per_kg_at_time`

## Solution

Modify the feeding logic in `seed-demo-data/index.ts` to:

### For farms WITH inventory:
1. Fetch `feed_inventory` items (where `quantity_kg > 0`) for the farm, ordered by `created_at` (FIFO)
2. Pick an inventory item using the seeded random (preferring roughage category)
3. Set `feed_inventory_id` to the matched item's ID
4. Set `cost_per_kg_at_time` to the item's `cost_per_unit`
5. Deduct `kilograms` from the inventory item's `quantity_kg` (batch update after all animals processed)
6. If the selected item runs out mid-seeding, move to the next available item (FIFO)

### For farms WITHOUT inventory (fallback):
1. Use feed_type = `"Fresh Cut & Carry"` (realistic zero-cost forage)
2. Set `feed_inventory_id` = NULL (no inventory to link)
3. Set `cost_per_kg_at_time` = 0 (zero cost -- free forage)

## Technical Changes

**File: `supabase/functions/seed-demo-data/index.ts`**

1. **Add inventory fetch** (inside the per-farm loop, alongside the existing bulk queries):
```typescript
const invRes = await supabase
  .from('feed_inventory')
  .select('id, feed_type, category, quantity_kg, cost_per_unit')
  .eq('farm_id', farm.id)
  .gt('quantity_kg', 0)
  .order('created_at', { ascending: true });
```

2. **Replace the feeding insert logic** (lines 273-291):
   - If inventory exists: pick from available items (prefer roughage), track remaining quantity in a local map, include `feed_inventory_id` and `cost_per_kg_at_time`
   - If no inventory: use "Fresh Cut & Carry" with `cost_per_kg_at_time: 0`

3. **Add inventory deduction batch** after feeding inserts:
   - For each inventory item that was consumed, issue a single UPDATE to reduce `quantity_kg`
   - No `feed_stock_transactions` needed for demo data (keeps it simple)

4. **Remove hardcoded `feedTypes` from `SPECIES_CONFIG`** -- these are no longer used since we source from actual inventory or fallback

## Inventory Selection Logic (Detail)

```text
For each animal + day:
  1. Filter farm inventory items with remaining qty > 0
  2. Prefer roughage items (category = 'roughage') -- animals survive on roughage
  3. Use seeded random to pick among available roughage items
  4. If no roughage left, pick from any remaining inventory
  5. If all inventory exhausted, fall back to "Fresh Cut & Carry" at zero cost
  6. Deduct kg from local tracking map (not DB yet)

After all animals processed:
  Batch UPDATE feed_inventory SET quantity_kg = newBalance for each changed item
```

## Summary Output Enhancement

Add `inventory_linked` and `zero_cost_fallback` counts to the per-farm summary so we can verify the linkage worked.

## Governance

- Update `docs/data-relationships-map.md` to document that demo feeding records now link to inventory
- Update `changelog.md`
