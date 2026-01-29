

# Plan: Fix Feed Stock Audit Tab - Unlinked Records and Currency Display

## Problem Summary
The Feed Stock Audit tab has two issues:
1. **Currency Display**: Shows "KES" (Kenyan Shilling) instead of Philippine Peso (₱)
2. **453 Records Need Fixing**:
   - 21 records missing `feed_inventory_id` (can be matched by feed_type)
   - 432 records missing `cost_per_kg_at_time` (need cost backfill from inventory)

---

## Part 1: Fix Currency Display

### File: `src/components/feed-inventory/InventoryAuditReport.tsx`

**Change 1: Import Currency Utility**
- Location: Top of file (after existing imports)
- Add: `import { formatPHP } from "@/lib/currency";`

**Change 2: Fix Summary Card Currency**
- Location: Line 208
- Before: `KES {Math.round(summary.totalCostTracked).toLocaleString()}`
- After: `{formatPHP(summary.totalCostTracked)}`

**Change 3: Fix Table Cell Currency**
- Location: Line 310
- Before: `KES {record.cost_per_kg_at_time.toFixed(2)}`
- After: `{formatPHP(record.cost_per_kg_at_time, true)}`
- Note: Using `true` for decimals parameter to show cost per kg with 2 decimal places

---

## Part 2: Fix Database Records

### Step 1: Link Unlinked Records by Feed Type
Run SQL to update 21 records that have matching inventory items:

```text
UPDATE feeding_records fr
SET feed_inventory_id = fi.id
FROM animals a, feed_inventory fi
WHERE fr.animal_id = a.id
  AND a.farm_id = '0ffc89c8-152d-42a3-a0f5-67cf772860cc'
  AND fi.farm_id = a.farm_id
  AND fi.feed_type = fr.feed_type
  AND fr.feed_inventory_id IS NULL
  AND fr.feed_type != 'Fresh Cut and Carry';
```

### Step 2: Backfill Cost Data from Inventory
Run SQL to populate `cost_per_kg_at_time` for all linked records:

```text
UPDATE feeding_records fr
SET cost_per_kg_at_time = fi.cost_per_unit
FROM feed_inventory fi
WHERE fr.feed_inventory_id = fi.id
  AND fr.cost_per_kg_at_time IS NULL;
```

---

## Expected Results

### After Currency Fix
| Location | Before | After |
|----------|--------|-------|
| Summary Card | KES 2,500 | ₱2,500 |
| Table Cost/kg | KES 6.00 | ₱6.00 |

### After Database Fix
| Metric | Before | After |
|--------|--------|-------|
| Untracked Records | 21 | 0 |
| Missing Cost Records | 432 | 0 |
| Issues Found | ~119 (in 200-limit view) | 0 |
| Properly Linked | ~60% | 100% |

---

## Technical Details

### Records Being Fixed

| Feed Type | Unlinked | Missing Cost | Inventory Cost |
|-----------|----------|--------------|----------------|
| Bag Corn Silage | 8 | 432 | ₱6/kg |
| Rice Bran | 3 | 0 | ₱25/kg |
| Rumsol Feeds Cattle Grower | 8 | 0 | ₱30/kg |
| Soya | 1 | 0 | ₱30/kg |
| Baled Corn Silage | 1 | 0 | ₱8/kg |

### Files Modified
- `src/components/feed-inventory/InventoryAuditReport.tsx` - Currency formatting

### Database Updates
- `feeding_records` table - Link inventory and backfill costs for 453 records

---

## Testing Checklist
1. Navigate to Feed Inventory tab and select "Audit" sub-tab
2. Verify "Cost Tracked" summary shows ₱ symbol
3. Verify table "Cost/kg" column shows ₱ values
4. Confirm "Issues Found" shows 0
5. Confirm "Properly Linked" shows 100%

