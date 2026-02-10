
# Fix: Delete Duplicate Revenue Entries and Add Prevention Constraint

## Problem Identified

The Finance tab is inflated by **₱11,324.40** due to 4 duplicate `farm_revenues` entries. Each duplicate pair has:
- **Entry A (correct)**: Amount matches `milking_records.sale_amount`, correct transaction date
- **Entry B (inflated)**: Much larger amount, often a different date

| Milk Log ID | Correct Amount | Duplicate Amount | Inflation |
|-------------|---------------|-----------------|-----------|
| `1b1e4c3b...` | 166.38 | 1,274.40 | +1,108.02 |
| `4dbde4db...` | 27.60 | 1,880.00 | +1,852.40 |
| `d30db7e1...` | 771.60 | 4,970.00 | +4,198.40 |
| `f7ff1067...` | 620.80 | 3,200.00 | +2,579.20 |
| **Totals** | **1,586.38** | **11,324.40** | **+9,738.02** |

**Current total Milk Sales revenue**: 190,499.88 (inflated)
**Corrected total after fix**: ~179,175.48

## Root Cause

The `RecordMilkSaleDialog` creates a revenue entry on every sale submission but does not check whether one already exists for the same `linked_milk_log_id`. There is no database constraint preventing this.

## Plan

### Step 1: Delete 4 Duplicate Revenue Entries (SQL)

Delete only the second (inflated) entry in each pair, identified by their specific IDs:

| ID to Delete | Inflated Amount | linked_milk_log_id |
|---|---|---|
| `76d98e90...` | 1,274.40 | `1b1e4c3b...` |
| `f8928c9c...` | 1,880.00 | `4dbde4db...` |
| `76bdbddc...` | 4,970.00 | `d30db7e1...` |
| `c44e259a...` | 3,200.00 | `f7ff1067...` |

### Step 2: Add Unique Partial Index (Migration)

Create a partial unique index on `farm_revenues` to prevent future duplicates:

```text
CREATE UNIQUE INDEX idx_farm_revenues_unique_milk_log 
ON farm_revenues (linked_milk_log_id) 
WHERE linked_milk_log_id IS NOT NULL AND is_deleted = false;
```

This uses a partial index (not a full unique constraint) so that:
- NULL values for `linked_milk_log_id` are still allowed (non-milk revenues)
- Soft-deleted entries don't block new entries

### Step 3: Add Defensive Check in Code

Update `RecordMilkSaleDialog.tsx` to check for existing revenue before inserting, as a belt-and-suspenders approach alongside the DB constraint.

### Step 4: Update DRM

Add Entry 5 to `docs/data-relationships-map.md` documenting the duplicate cleanup, new constraint, and code fix.

### Step 5: Verify

- Query to confirm only 4 correct entries remain (one per milk log)
- Confirm total Milk Sales revenue decreased by ~₱11,324
- Confirm the Finance tab reflects accurate totals

## Files Affected

- **SQL**: DELETE 4 rows from `farm_revenues` + CREATE UNIQUE INDEX migration
- **`src/components/milk-inventory/RecordMilkSaleDialog.tsx`**: Add duplicate-prevention check before insert
- **`docs/data-relationships-map.md`**: New changelog Entry 5
