

# Fix: Auto-Approval Not Triggering

## Problem

The pending milking entry you see was submitted by **Este Farmer** (a farmhand) on Jan 30. This is correct behavior -- farmhand submissions require manager approval. The `auto_approve_at` was set to Feb 1, but **the auto-approval never fired** because there is no scheduled job calling the `process-auto-approvals` function.

The function exists and works correctly, but nothing triggers it on a schedule.

## Solution

Add a **pg_cron job** (same pattern used for daily stats) that runs every 15 minutes to invoke the `process-auto-approvals` edge function. This uses the existing `pg_cron` and `pg_net` extensions already enabled in the database.

## What Changes

### 1. Database Migration (new)

Create a cron job that calls the `process-auto-approvals` edge function every 15 minutes:

```sql
SELECT cron.schedule(
  'process-auto-approvals',
  '*/15 * * * *',   -- Every 15 minutes
  $$
  SELECT net.http_post(
    url := '<supabase-url>/functions/v1/process-auto-approvals',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <service-role-key>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

This will:
- Check every 15 minutes for pending activities past their `auto_approve_at` time
- Auto-approve them (including feed inventory deduction for feeding activities)
- Log results for debugging

### 2. Immediate Fix for the Stuck Entry

After the cron job is deployed, the existing stuck entry (11 days old, auto-approve overdue by 9 days) will be picked up and auto-approved on the next 15-minute cycle.

Alternatively, you can manually trigger it right now by calling the function once.

## Technical Notes

- The `process-auto-approvals` function already handles all the logic correctly (checks farm settings, calls `approve_pending_activity` RPC, deducts feed inventory)
- The `requires_approval` SQL function correctly exempts owners/managers -- only farmhand submissions enter the queue
- The 15-minute interval balances responsiveness with resource usage
- No frontend changes needed

## Files Affected

- **New migration**: Adds the cron schedule
- No other files modified

