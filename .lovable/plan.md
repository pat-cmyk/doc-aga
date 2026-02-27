
# Fix: Milk Edit Race Condition + Animal Profile Quality Badge

## Audit Result

The proposed fix **does follow** SSOT and offline-first architecture. Here is the verified analysis:

### SSOT Compliance

The current code **violates** SSOT by updating both `milk_inventory` (derived table) AND `milking_records` (source table) from the client. The fix correctly restores the SSOT chain:

```text
CURRENT (broken):
  Dialog -> UPDATE milk_inventory (manual, lines 51-59)
  Dialog -> UPDATE milking_records (lines 64-72)
         -> Trigger fires -> UPDATE milk_inventory AGAIN (race condition)

FIXED (SSOT-compliant):
  Dialog -> UPDATE milking_records ONLY (source of truth)
         -> Trigger fires -> UPDATE milk_inventory (derived, single path)
         -> Client refetches both good + rejected queries
```

### Trigger Detail: `RETURN NEW` Short-Circuit

The trigger at line 68 does `RETURN NEW` after handling a quality change, which means the liters update block (line 81) **never fires** when quality changes in the same UPDATE. This is actually fine because:
- good-to-rejected: liters stay as `liters_remaining` (kept for feeding)
- rejected-to-good: trigger restores `liters_remaining = NEW.liters` (line 63)
- If both quality AND liters change simultaneously, the liters change is lost

**Mitigation**: The fix will ensure that when quality changes, the liters value is also included in the trigger's quality-change branch. This requires a small trigger update.

### Offline-First Status

Milk inventory editing is currently online-only (direct Supabase calls). This is an **existing** constraint, not introduced by this fix. The fix does not degrade offline capability. Offline editing of milk records would be a separate future enhancement using the existing sync queue.

---

## Implementation Plan

### Step 1: Fix the DB trigger to handle simultaneous quality + liters changes

Update `sync_milk_inventory_on_update()` so the quality-change branch also applies liters updates, preventing data loss when both change at once.

```sql
-- In the quality-change branch, also update liters
IF NEW.milk_quality IS DISTINCT FROM OLD.milk_quality THEN
  UPDATE public.milk_inventory
  SET milk_quality = COALESCE(NEW.milk_quality, 'good'),
      milk_quality_rejection_reason = NEW.milk_quality_rejection_reason,
      is_available = CASE 
        WHEN COALESCE(NEW.is_sold, false) THEN false 
        ELSE true 
      END,
      liters_original = NEW.liters,
      liters_remaining = CASE
        WHEN NEW.milk_quality = 'good' THEN NEW.liters
        ELSE liters_remaining
      END,
      record_date = NEW.record_date,
      updated_at = now()
  WHERE milking_record_id = NEW.id;
  RETURN NEW;
END IF;
```

### Step 2: Fix EditMilkRecordDialog -- remove direct milk_inventory update

File: `src/components/milk-inventory/EditMilkRecordDialog.tsx`

- **Remove** lines 51-61 (direct `milk_inventory` UPDATE)
- **Keep** only the `milking_records` UPDATE (lines 64-72) -- the trigger handles propagation
- **Add** refetch of `['milk-inventory-rejected', farmId]` alongside the existing good-stock refetch
- **Add** `CacheManager` invalidation for milk-related caches

### Step 3: Add milk quality display to animal profile

File: `src/components/MilkingRecords.tsx`

- Extend `MilkRecord` interface with `milk_quality?: string` and `milk_quality_rejection_reason?: string`
- Add a visual badge next to the liters in the record row (lines 340-388):
  - "Rejected" badge with destructive styling when `milk_quality === 'rejected'`
  - Rejection reason shown as secondary text beneath the badge
- The query already uses `select("*")`, so the fields are fetched but currently dropped by the TypeScript interface

---

## Files Modified

| File | Change |
|------|--------|
| New migration SQL | Update `sync_milk_inventory_on_update` trigger |
| `src/components/milk-inventory/EditMilkRecordDialog.tsx` | Remove direct inventory update, add rejected query refetch |
| `src/components/MilkingRecords.tsx` | Add `milk_quality` to interface, render quality badge |

## SSOT Data Flow (After Fix)

| Step | Component | Action |
|------|-----------|--------|
| 1 | EditMilkRecordDialog | UPDATE `milking_records` only |
| 2 | DB Trigger | `sync_milk_inventory_on_update` propagates to `milk_inventory` |
| 3 | Client | Refetch both `milk-inventory` and `milk-inventory-rejected` queries |
| 4 | UI | Good milk appears in sellable inventory, rejected milk in rejected section |
| 5 | Animal Profile | MilkingRecords shows quality badge per record |

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Trigger `RETURN NEW` skips liters block on quality change | Step 1 fixes this by including liters in the quality branch |
| Rejected query never refreshed | Step 2 adds explicit refetch of rejected query key |
| Animal profile shows no quality info | Step 3 adds badge using existing DB fields |
