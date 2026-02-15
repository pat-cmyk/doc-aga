

# Fix: Double-Entry Feed Purchase Expenses

## Root Cause Found

There are **two code paths** creating a `farm_expenses` entry for every feed purchase:

1. **Database Trigger** (`trigger_feed_purchase_expense`): Fires `AFTER INSERT ON feed_inventory`, creates an expense with format "Feed Purchase: Drum Silage - 400 kg", `allocation_type: Operational`.
2. **Application Code** (`AddFeedStockDialog.tsx` lines 280-291): Creates an expense with format "Feed purchase: Drum Silage", `allocation_type: Capital`.

Both point to the same `linked_feed_inventory_id`, producing identical ₱2,400 entries ~0.9 seconds apart.

Additionally, the previous fix missed two more feeding-expense creators:
- `RecordSingleFeedDialog.tsx` (lines 292-305): Still creates `farm_expenses` for per-animal feeding events
- `EditFeedingRecordDialog.tsx` (lines 375-418): Creates/updates `farm_expenses` for edited feeding events

---

## Fix Plan

### Step 1: Drop the Database Trigger (Primary Fix)

Remove `trigger_feed_purchase_expense` and its function `create_feed_purchase_expense`. The application code in `AddFeedStockDialog.tsx` is the correct path -- it has better formatting, correct `allocation_type: Capital`, and includes batch number support.

**SQL Migration:**
```sql
DROP TRIGGER IF EXISTS trigger_feed_purchase_expense ON public.feed_inventory;
DROP FUNCTION IF EXISTS create_feed_purchase_expense();
```

### Step 2: Clean Duplicate Data

Soft-delete the trigger-generated entries (format: "Feed Purchase: X - Y kg/bags", allocation_type: Operational) across ALL farms, keeping only the application-generated ones (format: "Feed purchase: X", allocation_type: Capital).

```sql
UPDATE farm_expenses 
SET is_deleted = true 
WHERE description LIKE 'Feed Purchase:%-%'
  AND allocation_type = 'Operational'
  AND linked_feed_inventory_id IS NOT NULL
  AND is_deleted = false;
```

### Step 3: Remove Remaining Feeding-Expense Code (Missed in Previous Fix)

**File: `src/components/feed-recording/RecordSingleFeedDialog.tsx`**
- Remove lines 292-310 that create `farm_expenses` for per-animal feeding events
- This was missed in the previous double-booking fix (only syncService and RecordBulkFeedDialog were cleaned)

**File: `src/components/feed-recording/EditFeedingRecordDialog.tsx`**
- Remove lines 375-418 that find/create/update `farm_expenses` for edited feeding records
- Per-animal feed costs are tracked in `feeding_records.cost_per_kg_at_time` (SSOT)

### Step 4: Governance

- Update `docs/data-relationships-map.md` to document trigger removal
- Update `changelog.md`

---

## Verification Plan

1. Query `farm_expenses` for Estehanon Drum Silage: expect exactly 1 entry (₱2,400, Capital)
2. Query all farms for "Feed Purchase:" pattern with Operational allocation: expect 0 rows
3. Confirm trigger no longer exists in `pg_trigger`
