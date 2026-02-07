

# Fix: Missing `pending_record_changes` Table Error

## Problem Analysis

The Admin Dashboard is showing the error:
> "Failed to load system metrics - relation 'pending_record_changes' does not exist"

This is because the `get_system_health_metrics` RPC function incorrectly references a table called `pending_record_changes`, when the actual table is `pending_activities`.

## Root Cause

In the current RPC function (lines 108-111), the approvals section queries:
```sql
'approvals', jsonb_build_object(
  'pending', (SELECT COUNT(*) FROM pending_record_changes WHERE status = 'pending'),
  ...
)
```

But the correct table is `pending_activities` with these status values: `pending`, `approved`, `rejected`.

| Wrong Reference | Correct Reference |
|-----------------|-------------------|
| `pending_record_changes` | `pending_activities` |
| `status = 'auto_approved'` | Not needed (doesn't exist) |

## Solution

Create a new migration to fix the RPC function by replacing `pending_record_changes` with `pending_activities` and removing the reference to `auto_approved` status.

---

## Changes Required

### Database Migration

Update the `get_system_health_metrics` function approvals section:

```sql
'approvals', jsonb_build_object(
  'pending', (SELECT COUNT(*) FROM pending_activities WHERE status = 'pending'),
  'approved_7d', (SELECT COUNT(*) FROM pending_activities WHERE status = 'approved' AND reviewed_at > now() - interval '7 days'),
  'rejected_7d', (SELECT COUNT(*) FROM pending_activities WHERE status = 'rejected' AND reviewed_at > now() - interval '7 days'),
  'auto_approved_7d', 0  -- Not used in current schema
)
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/xxx.sql` | Create | Fix `get_system_health_metrics` to use `pending_activities` table |

---

## Data Flow Verification

**Modified**: `get_system_health_metrics` RPC function  
**Data Flow**: `pending_activities` table -> RPC -> `useSystemHealth` hook -> `SystemOverview` component  
**Consumers Verified**: `useSystemHealth.ts`, `SystemOverview.tsx`  
**Breaking Changes**: None - fixes existing broken functionality  
**Testing Points**: Admin Dashboard > Dashboard tab should load without errors

---

## Testing Points

1. Navigate to Admin Dashboard - verify the error is gone
2. Dashboard tab should display system health metrics
3. Approvals metrics section should show correct counts from `pending_activities`
4. Switch between Live/Demo/All data - verify dashboard loads correctly for each

