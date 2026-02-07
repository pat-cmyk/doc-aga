

# Fix: Missing `stt_requests` Table Error

## Problem Analysis

The Admin Dashboard is showing the error:
> "Failed to load system metrics - relation 'stt_requests' does not exist"

This is because the recently created `get_system_health_metrics` RPC function incorrectly references a table called `stt_requests`, when the actual table is `stt_analytics`.

## Root Cause

In the migration `20260207061943_fdd1c893-199d-4c0a-8e23-09b6bfceae68.sql`, the STT section queries:
```sql
'stt', jsonb_build_object(
  'total_requests', (SELECT COUNT(*) FROM stt_requests),  -- WRONG TABLE
  ...
)
```

But the correct table (created in an earlier migration) is `stt_analytics` with a different schema:

| Wrong Reference | Correct Reference |
|-----------------|-------------------|
| `stt_requests` | `stt_analytics` |
| `success = true` | `status = 'success'` |
| `processing_time_ms` | `latency_ms` |

## Solution

Create a new migration to fix the RPC function by replacing all `stt_requests` references with `stt_analytics` and updating the column names.

---

## Changes Required

### Database Migration

Update the `get_system_health_metrics` function:

```sql
'stt', jsonb_build_object(
  'total_requests', (SELECT COUNT(*) FROM stt_analytics),
  'requests_24h', (SELECT COUNT(*) FROM stt_analytics WHERE created_at > now() - interval '24 hours'),
  'success_rate', (
    SELECT COALESCE(
      ROUND(
        (COUNT(*) FILTER (WHERE status = 'success')::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100,
        1
      ),
      0
    )
    FROM stt_analytics
  ),
  'avg_latency_ms', (
    SELECT COALESCE(ROUND(AVG(latency_ms)::numeric, 0), 0)
    FROM stt_analytics
    WHERE status = 'success'
  ),
  'failed_24h', (
    SELECT COUNT(*) FROM stt_analytics 
    WHERE created_at > now() - interval '24 hours' 
      AND status IN ('error', 'rate_limited')
  )
)
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/xxx.sql` | Create | Fix `get_system_health_metrics` to use `stt_analytics` table |

---

## Data Flow Verification

**Modified**: `get_system_health_metrics` RPC function
**Data Flow**: `stt_analytics` table → RPC → `useSystemHealth` hook → `SystemOverview` component
**Consumers Verified**: `useSystemHealth.ts`, `SystemOverview.tsx`
**Breaking Changes**: None - fixes existing broken functionality
**Testing Points**: Admin Dashboard > Dashboard tab should load without errors

---

## Testing Points

1. Navigate to Admin Dashboard - verify the error is gone
2. Dashboard tab should display system health metrics
3. STT metrics section should show correct counts from `stt_analytics`
4. Switch between Live/Demo/All data - verify dashboard loads correctly for each

