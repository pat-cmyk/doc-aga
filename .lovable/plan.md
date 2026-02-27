

# Fix: Rejected Milk Not Showing Due to Trigger `liters_remaining` Bug

## Root Cause

The `sync_milk_inventory_on_update` trigger has a logic error in its quality-change branch. When milk changes from `good` to `rejected`:

```text
liters_remaining = CASE
  WHEN NEW.milk_quality = 'good' THEN NEW.liters
  ELSE liters_remaining   -- BUG: keeps old value (could be 0 from prior sales)
END
```

If the good milk had been partially or fully sold/fed before the quality change, `liters_remaining` is already 0. The rejected record inherits 0, and the rejected query filters `.gte("liters_remaining", 0.05)` -- so it never appears.

**Database evidence:**
- Bessie: `liters_original = 18.20`, `liters_remaining = 0.00`, `milk_quality = 'rejected'`, `is_available = true`
- Tita Barbecue: `liters_original = 8.30`, `liters_remaining = 0.00`, same situation

Both are invisible because of the 0.05L filter.

## SSOT + Offline-First Compliance

The frontend code is already correct (SSOT-compliant):
- `EditMilkRecordDialog` only updates `milking_records` (source of truth)
- DB trigger handles `milk_inventory` propagation (derived table)
- Both `milk-inventory` and `milk-inventory-rejected` queries are refetched after edit
- CacheManager invalidation is in place

The only fix needed is in the trigger logic.

## Fix

### Step 1: Fix trigger -- restore liters when quality changes to rejected

When milk is marked rejected, it means the milk was bad. Any prior sales/deductions from it were from "bad" milk. The full original amount should be available for feeding (the primary use of rejected milk). Update the trigger:

```sql
liters_remaining = CASE
  WHEN NEW.milk_quality = 'good' THEN NEW.liters
  ELSE NEW.liters   -- Restore full amount for rejected milk (feedable)
END
```

This makes both branches set `liters_remaining = NEW.liters`, which simplifies to just `liters_remaining = NEW.liters` unconditionally in the quality-change branch.

### Step 2: Backfill existing broken records

Fix the existing rejected records that have `liters_remaining = 0` but `is_available = true`:

```sql
UPDATE milk_inventory
SET liters_remaining = liters_original
WHERE milk_quality = 'rejected'
  AND is_available = true
  AND liters_remaining < 0.05;
```

## Files Modified

| File | Change |
|------|--------|
| New migration SQL | Fix trigger quality-change branch + backfill |

## Why This Is Correct

| Scenario | Behavior |
|----------|----------|
| Good milk, no prior sales, changed to rejected | `liters_remaining = NEW.liters` (full amount, feedable) |
| Good milk, partially sold, changed to rejected | `liters_remaining = NEW.liters` (restored -- prior sales were from bad milk) |
| Rejected milk, changed back to good | `liters_remaining = NEW.liters` (full amount, sellable) |
| Good milk with liters edit only (no quality change) | Handled by separate liters-change block (unchanged) |

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Restoring liters that were legitimately fed as rejected | Feeding deductions happen on `milk_inventory` directly, not through `milking_records` trigger. Feeding records remain valid. The backfill only affects records with `liters_remaining < 0.05`. |
| Existing feeding deductions on rejected milk | Feeding writes to `milk_inventory.liters_remaining` directly, not through this trigger path. Those deductions are preserved for future rejected-to-rejected edits (no quality change = trigger doesn't fire quality branch). |

