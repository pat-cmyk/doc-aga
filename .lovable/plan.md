

# Fix: Milking Approval - Wrong Date and Inflated Liters

## Problem Summary

Two bugs in the `approve_pending_activity` database function caused a 250L milking record on the wrong date:

1. **Wrong date**: When `validated_date` is missing from the farmhand's submission, it falls back to `CURRENT_DATE` (the approval date) instead of the original submission date. The entry submitted Jan 30 was recorded as Feb 10.

2. **Inflated liters (250L instead of 50L)**: For bulk milking submissions, the function ignores the per-animal distribution data (`distributions_by_type`) and instead inserts the **total** quantity (50L) for **each** of the 5 animals, producing 5 x 50 = 250L.

### Chart vs Popup Discrepancy
The chart uses `daily_farm_stats` (pre-aggregated, not yet calculated for today), while the popup queries `milking_records` directly. Both will show 250L once stats refresh -- the real fix is correcting the data at the source.

## Solution

### 1. Fix the `approve_pending_activity` RPC (Database Migration)

Update the milking case to:

- **Date fallback**: Use the `created_at` timestamp of the pending activity (the original submission time) instead of `CURRENT_DATE` when `validated_date` is missing
- **Bulk milking support**: When `distributions_by_type` exists in `activity_data`, extract individual liters per animal from the distribution data instead of using the flat `quantity` field

```text
Date logic (before):
  _record_date := COALESCE(validated_date, CURRENT_DATE)

Date logic (after):
  _record_date := COALESCE(validated_date, _pending.created_at::DATE)

Milking logic (before):
  FOREACH animal_id IN animal_ids LOOP
    INSERT ... VALUES (animal_id, record_date, quantity, ...)  -- 50L per animal!
  END LOOP

Milking logic (after):
  IF distributions_by_type exists THEN
    -- Extract per-animal liters from distribution data
    INSERT ... SELECT animal_id, milk_liters FROM distributions
  ELSE
    -- Single animal: use quantity directly (existing behavior)
    INSERT ... VALUES (animal_id, record_date, quantity, ...)
  END IF
```

### 2. Data Repair Query

Fix the 5 incorrect milking records created today:

- Delete the 5 records with 50L each on Feb 10 (created by this auto-approval)
- Re-insert with correct per-animal liters from the original distribution data, dated Jan 30

### 3. Submission Validation (Frontend)

Update the farmhand milking submission flow to always include `validated_date` in `activity_data`, defaulting to the current date at submission time. This prevents reliance on the fallback logic entirely.

## Files Affected

- **New migration**: Updates `approve_pending_activity` RPC
- **New migration**: Data repair for the 5 incorrect records  
- **Frontend**: Farmhand milking submission component (to always include `validated_date`)

## Data Flow

```text
pending_activities.activity_data --> approve_pending_activity RPC --> milking_records
                                                                  --> daily_farm_stats (via cron)
                                                                  --> MilkDayDetailDialog (popup)
                                                                  --> useMilkData (chart)
```

## Testing Points

- Submit a bulk milking as farmhand, wait for auto-approval, verify correct date and per-animal liters
- Verify the popup and chart show matching totals after the fix
- Check that single-animal milking submissions still work correctly

