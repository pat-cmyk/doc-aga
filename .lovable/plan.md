

# Fix: Complete Data Repair and DRM Update

## Problem

Two issues remain from the previous fix:

1. **Data repair incomplete**: The 5 incorrect milking records (50L each, dated Feb 10) were never deleted. Only 2 of 5 corrected records were inserted for Jan 30. The chart still shows 250L on Feb 10.

2. **DRM not updated**: The `approve_pending_activity` RPC changes (date fallback, bulk milking distribution) were not documented in the Data Relationships Map changelog, violating project governance rules.

## Current State in Database

**Feb 10 (should NOT exist):**
| Animal | Liters | Status |
|--------|--------|--------|
| Tag 2722 | 50L | Bad - should be 0L on Jan 30 |
| Tita Barbecue | 50L | Bad - should be 24.14L on Jan 30 |
| Bessie | 50L | Bad - should be 25.86L on Jan 30 |
| Tsibato | 50L | Bad - already corrected on Jan 30 |
| Tag G002 | 50L | Bad - already corrected on Jan 30 |

**Jan 30 (corrected, partially done):**
| Animal | Liters | Status |
|--------|--------|--------|
| Tag G002 | 32.54L | Inserted correctly |
| Tsibato | 17.46L | Inserted correctly |
| Tita Barbecue | 24.14L | MISSING |
| Bessie | 25.86L | MISSING |
| Tag 2722 | 0L | MISSING (0L per distribution, no record needed) |

## Plan

### Step 1: Data Repair (SQL via insert tool)

Delete the 5 bad records from Feb 10:

```text
DELETE FROM milking_records 
WHERE record_date = '2026-02-10' 
AND animal_id IN (5 specific UUIDs)
AND liters = 50.00
AND created_at = '2026-02-10 01:53:02.379633+00'
```

Insert the 2 missing corrected records for Jan 30:

```text
INSERT INTO milking_records (animal_id, record_date, liters)
VALUES 
  ('61eefe8a-...', '2026-01-30', 24.14),  -- Tita Barbecue
  ('d8a96511-...', '2026-01-30', 25.86);  -- Bessie
```

Note: Tag 2722 had 0L in the distribution, so no record is needed.

### Step 2: Update DRM Changelog

Add a new entry (Entry 4) to `docs/data-relationships-map.md` documenting:

- The `approve_pending_activity` RPC changes:
  - Date fallback changed from `CURRENT_DATE` to `created_at::DATE`
  - Bulk milking now reads `distributions_by_type` for per-animal liters
- The `process-auto-approvals` cron job addition (every 15 minutes via pg_cron)
- The data repair performed
- Frontend change: `ActivityConfirmation.tsx` now always sends `validated_date`

### Step 3: Verify

- Confirm Feb 10 shows 0L in the chart
- Confirm Jan 30 totals reflect the corrected ~100L (existing records + 24.14 + 25.86 + 32.54 + 17.46)

## Files Affected

- **Data repair**: SQL execution (no file changes)
- **`docs/data-relationships-map.md`**: New changelog entry (Entry 4)
- No other code changes needed

