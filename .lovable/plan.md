
# Fix: Clean Up 261 Historical Untracked Feeding Records in Estehanon Farm

## Problem

The audit shows **162 issues** (out of 200 displayed). The full breakdown across ALL Estehanon feeding records:

| Issue Type | Feed Type | Count | Total kg |
|---|---|---|---|
| Has cost (₱6/kg) but no inventory link | Bag Corn Silage | 231 | 2,212 kg |
| No cost AND no inventory link | Rice Straw | 7 | 75.7 kg |
| No cost AND no inventory link | Concentrate Feed | 5 | 61.1 kg |
| No cost AND no inventory link | Corn Silage | 5 | 50.8 kg |
| No cost AND no inventory link | Fresh Cut and Carry | 5 | 60.0 kg |
| No cost AND no inventory link | Pellets | 4 | 11.2 kg |
| No cost AND no inventory link | Napier Grass | 4 | 46.5 kg |

These are all **historical records** created before the cron job was updated with inventory linkage.

## Cron Job Status (Going Forward)

The `seed-demo-data` edge function is already fixed. It:
- Fetches farm inventory and uses FIFO roughage-first selection via `pickFeedSource()`
- Sets `feed_inventory_id` and `cost_per_kg_at_time` on every new feeding record
- Falls back to "Fresh Cut & Carry" at ₱0 when inventory is empty
- Deducts consumed amounts from `feed_inventory` balances

No changes needed to the cron job -- it will not produce untracked records going forward.

## Data Cleanup Plan

### Group 1: 231 Bag Corn Silage records (have cost, missing inventory link)

These were from the Estehanon normalization seeding. They already have the correct `cost_per_kg_at_time = 6`. We just need to link them to the existing Bag Corn Silage inventory item (`241b6314-03a0-4449-832f-f82a53dc3eb3`).

```sql
UPDATE feeding_records
SET feed_inventory_id = '241b6314-03a0-4449-832f-f82a53dc3eb3'
WHERE animal_id IN (SELECT id FROM animals WHERE farm_id = '0ffc89c8-152d-42a3-a0f5-67cf772860cc')
  AND feed_inventory_id IS NULL
  AND cost_per_kg_at_time IS NOT NULL
  AND feed_type = 'Bag Corn Silage';
```

### Group 2: 30 untracked records (no cost, no link, various feed types)

These use feed types that don't exist in Estehanon's inventory (Napier Grass, Rice Straw, Pellets, Concentrate Feed, Corn Silage). Convert them to "Fresh Cut & Carry" with zero cost (matching the cron job's fallback logic).

The 5 existing "Fresh Cut and Carry" records (note: slightly different name with "and") also get cost set to 0.

```sql
UPDATE feeding_records
SET feed_type = 'Fresh Cut & Carry',
    cost_per_kg_at_time = 0
WHERE animal_id IN (SELECT id FROM animals WHERE farm_id = '0ffc89c8-152d-42a3-a0f5-67cf772860cc')
  AND feed_inventory_id IS NULL
  AND cost_per_kg_at_time IS NULL;
```

## Expected Result After Cleanup

- **0 untracked records** (down from 162 issues)
- **Properly Linked** jumps from 19% to near 100%
- All historical records have either an inventory link or are marked as zero-cost "Fresh Cut & Carry"

## Verification

1. Re-query: confirm zero rows with `feed_inventory_id IS NULL AND cost_per_kg_at_time IS NULL`
2. Confirm audit page shows 0 issues and near-100% linked rate
