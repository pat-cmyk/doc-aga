
# Fix: Stop Double-Booking Feed Expenses in Finance

## Problem Confirmed

The system creates TWO expense entries for the same feed:
1. **Purchase** (cash out): ₱2,400 for 400kg Drum Silage -- correct for Finance P&L
2. **Per-animal feeding** (cost allocation): ₱256.80 for 42.80 kg to Animal X -- should NOT be in Finance P&L

This inflates the Estehanon farm's feed expenses from ₱9,100 (actual cash spent) to ₱26,130 (cash + allocations).

## Root Cause

`syncService.ts` inserts a `farm_expenses` row for every feeding event (lines 646-662 for bulk, lines 735-748 for single). These are meant for per-animal cost tracking but land in the same `farm_expenses` table that the Finance tab reads.

## Solution: Stop Creating farm_expenses for Feeding Events

The per-animal cost data is ALREADY stored in `feeding_records` via `cost_per_kg_at_time`. The Animal Cost Analysis and Herd Investment views already read from `feeding_records` directly. The `farm_expenses` feeding entries are redundant.

### Changes

**File 1: `src/lib/syncService.ts`**
- Remove the expense creation block in `syncBulkFeeding()` (lines 645-662) that inserts per-animal feeding expenses
- Remove the expense creation block in `syncSingleFeed()` (lines 735-748) that inserts single-animal feeding expenses
- Keep the feeding_records insert and inventory deduction logic untouched

**File 2: `src/components/feed-recording/RecordBulkFeedDialog.tsx`**
- Check if this component also creates farm_expenses for feeding events (it invalidates expense queries, suggesting it might). Remove if so.

**File 3: Data Cleanup (SQL)**
- Delete the 251 feeding allocation entries from Estehanon farm:
```sql
UPDATE farm_expenses 
SET is_deleted = true 
WHERE farm_id = '0ffc89c8-152d-42a3-a0f5-67cf772860cc'
  AND category = 'Feed & Supplements'
  AND description LIKE '%feeding:%'
  AND is_deleted = false;
```
- Also clean ALL farms (not just Estehanon) since this is a systemic bug.

### What Stays the Same
- Feed **purchase** expenses (from `AddFeedStockDialog.tsx`) -- these are real cash outflows, correctly recorded
- `feeding_records.cost_per_kg_at_time` -- this is the SSOT for per-animal feed cost, used by Animal Cost Analysis and Herd Investment
- The `linked_feed_inventory_id` column on farm_expenses stays for purchase tracking

### SSOT Data Flow After Fix

```text
Money-In/Money-Out (Finance Tab):
  feed_inventory purchase --> farm_expenses (category: Feed & Supplements, allocation: Capital)

Per-Animal Cost Tracking (Herd Investment):
  feeding_records.cost_per_kg_at_time --> useAnimalExpenses --> AnimalCostAnalysis
```

These two paths no longer overlap in the `farm_expenses` table.

### Verification
1. Query farm_expenses for Estehanon: only purchase entries remain (4 entries, ₱9,100)
2. Finance tab P&L: feed expenses drop from ₱26K to ₱9.1K
3. Animal Cost Analysis: unchanged (reads from feeding_records, not farm_expenses)
4. Herd Investment: unchanged (same data source)

### Governance
- Update `docs/data-relationships-map.md` to document that feeding_records is the sole source for per-animal feed costs, and farm_expenses only tracks cash purchases
- Update `changelog.md`
