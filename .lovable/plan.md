

# Comprehensive Fix: All Remaining `get_system_health_metrics` Errors

## Complete Problem Audit

After thorough database schema verification, here are ALL remaining issues in the `get_system_health_metrics` function:

| Section | Line | Issue | Correct Schema |
|---------|------|-------|----------------|
| **stt** | 53, 55 | Uses `success` column (boolean) | Column is `status` (text: 'success', 'error') |
| **support** | 64-67 | Uses `farm_id` column | Column is `linked_farm_id` |
| **sync** | 76-79 | References `sync_logs` table | Table doesn't exist - use `sync_queue` |

---

## Root Cause Analysis

The current migration incorrectly references:

```sql
-- Line 53: WRONG - 'success' column doesn't exist
'success_rate', COALESCE((SELECT ROUND(AVG(CASE WHEN success THEN 100 ELSE 0 END)::numeric, 1)...

-- Line 55: WRONG - 'success' column doesn't exist  
'failed_24h', (SELECT COUNT(*) FROM stt_analytics WHERE success = false...

-- Lines 64-67: WRONG - 'farm_id' doesn't exist in support_tickets
WHERE ... AND farm_id = ANY(filtered_farm_ids)

-- Lines 76-79: WRONG - 'sync_logs' table doesn't exist
(SELECT COUNT(*) FROM sync_logs WHERE...
```

---

## Verified Database Schema

### stt_analytics table
| Column | Type | Note |
|--------|------|------|
| status | text | Values: 'success', 'error' |
| latency_ms | integer | ✓ Correct |
| farm_id | uuid | ✓ Correct |

### support_tickets table
| Column | Type | Note |
|--------|------|------|
| linked_farm_id | uuid | NOT farm_id |
| status | ticket_status enum | Values: 'open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed' |
| priority | ticket_priority enum | ✓ Correct |

### sync_queue table (replaces non-existent sync_logs)
| Column | Type | Note |
|--------|------|------|
| sync_status | sync_status enum | Values: 'pending', 'syncing', 'synced', 'conflict', 'error' |
| farm_id | uuid | ✓ Correct |
| processed_at | timestamptz | Use for duration calculation |
| created_at | timestamptz | ✓ Correct |

---

## Solution: Single Comprehensive Migration

Create ONE migration that fixes ALL three sections:

### 1. STT Section Fix
```sql
'stt', jsonb_build_object(
  'total_requests', (SELECT COUNT(*) FROM stt_analytics WHERE farm_id = ANY(filtered_farm_ids)),
  'requests_24h', (SELECT COUNT(*) FROM stt_analytics WHERE created_at > now() - interval '24 hours' AND farm_id = ANY(filtered_farm_ids)),
  'success_rate', COALESCE((
    SELECT ROUND(AVG(CASE WHEN status = 'success' THEN 100 ELSE 0 END)::numeric, 1) 
    FROM stt_analytics WHERE farm_id = ANY(filtered_farm_ids)
  ), 0),
  'avg_latency_ms', COALESCE((
    SELECT ROUND(AVG(latency_ms)::numeric, 0) 
    FROM stt_analytics WHERE status = 'success' AND farm_id = ANY(filtered_farm_ids)
  ), 0),
  'failed_24h', (
    SELECT COUNT(*) FROM stt_analytics 
    WHERE status = 'error' AND created_at > now() - interval '24 hours' AND farm_id = ANY(filtered_farm_ids)
  )
)
```

### 2. Support Section Fix
```sql
'support', jsonb_build_object(
  'open', (SELECT COUNT(*) FROM support_tickets WHERE status = 'open' AND linked_farm_id = ANY(filtered_farm_ids)),
  'in_progress', (SELECT COUNT(*) FROM support_tickets WHERE status = 'in_progress' AND linked_farm_id = ANY(filtered_farm_ids)),
  'urgent', (SELECT COUNT(*) FROM support_tickets WHERE priority = 'urgent' AND status NOT IN ('resolved', 'closed') AND linked_farm_id = ANY(filtered_farm_ids)),
  'resolved_7d', (SELECT COUNT(*) FROM support_tickets WHERE status = 'resolved' AND updated_at > now() - interval '7 days' AND linked_farm_id = ANY(filtered_farm_ids))
)
```

### 3. Sync Section Fix
```sql
'sync', jsonb_build_object(
  'total_syncs_24h', (SELECT COUNT(*) FROM sync_queue WHERE created_at > now() - interval '24 hours' AND farm_id = ANY(filtered_farm_ids)),
  'success_rate', COALESCE((
    SELECT ROUND(AVG(CASE WHEN sync_status = 'synced' THEN 100 ELSE 0 END)::numeric, 1) 
    FROM sync_queue WHERE farm_id = ANY(filtered_farm_ids)
  ), 100),
  'avg_duration_ms', COALESCE((
    SELECT ROUND(AVG(EXTRACT(EPOCH FROM (processed_at - created_at)) * 1000)::numeric, 0) 
    FROM sync_queue WHERE sync_status = 'synced' AND processed_at IS NOT NULL AND farm_id = ANY(filtered_farm_ids)
  ), 0),
  'failed_24h', (
    SELECT COUNT(*) FROM sync_queue 
    WHERE sync_status = 'error' AND created_at > now() - interval '24 hours' AND farm_id = ANY(filtered_farm_ids)
  )
)
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/xxx.sql` | Create | Complete rewrite of `get_system_health_metrics` with all fixes |

---

## Data Flow Verification

**Modified**: `get_system_health_metrics` RPC function  
**Data Flow**: 
- `stt_analytics` → RPC → `useSystemHealth` → Dashboard STT metrics
- `support_tickets` → RPC → `useSystemHealth` → Dashboard Support metrics  
- `sync_queue` → RPC → `useSystemHealth` → Dashboard Sync metrics

**Consumers Verified**: `useSystemHealth.ts`, `SystemOverview.tsx`  
**Breaking Changes**: None - same return interface  

---

## Testing Points

1. Navigate to `/admin?tab=dashboard&data_source=demo` - verify no errors
2. Switch data source toggle: Demo → Live → All - all should load
3. Verify STT metrics section displays correct data
4. Verify Support section shows ticket counts
5. Verify Sync section shows queue statistics
6. Confirm System Health Score calculates without errors

