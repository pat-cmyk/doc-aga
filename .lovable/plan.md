
## What’s happening (root cause)

The current Admin “System metrics” backend function `public.get_system_health_metrics(text)` is still querying the **farmer feedback** table (`farmer_feedback`) using an invalid enum value:

- Column: `farmer_feedback.status` is type `public.feedback_status` (ENUM)
- Valid values (confirmed from DB):  
  `submitted, acknowledged, under_review, action_taken, resolved, closed`
- The function currently does: `WHERE status = 'pending'`  
  Postgres tries to cast `'pending'` to the enum type and throws:  
  **invalid input value for enum feedback_status: "pending"**

This is why you’re seeing “Failed to load system metrics” when on `/admin?tab=dashboard&data_source=demo`.

---

## Thorough check (to stop these recurring “relation/enum does not exist” errors)

### A) Audit `get_system_health_metrics` for hardcoded table/enum literals
We’ll review every section in the function for:
1. **Table existence** (no more `stt_requests`, `pending_record_changes`, etc.)
2. **Enum literals** (no more `'pending'` on `feedback_status`, etc.)
3. **Column names** (`sync_logs.status`, `stt_analytics.latency_ms`, etc.)
4. **Data-category filtering** stays consistent (demo/live/all via `filtered_farm_ids`)

Current findings from the DB + latest migration:
- `stt`: now correctly uses `stt_analytics` and valid fields.
- `approvals`: now correctly uses `pending_activities` and valid statuses.
- `support`: uses `support_tickets` with `ticket_status/ticket_priority` enums; the values referenced are valid.
- `feedback`: **still wrong** → uses `status = 'pending'` (must be `submitted`).

### B) Add a “schema compatibility” checklist for future edits to this RPC
When we update this function again, we will:
- Validate enums via `pg_enum` (as done here)
- Validate table/columns via `information_schema.columns`
- Avoid introducing new literals unless verified

This prevents the repeated cycle you’re experiencing.

---

## Fix to implement (DB migration)

### 1) Create a new migration that updates ONLY the `feedback` section
Update the `feedback` JSON block from:

- `pending` → **`submitted`** (correct enum value)

Proposed revised block (also expands coverage so the dashboard is more accurate and less likely to need future edits):

```sql
'feedback', jsonb_build_object(
  'submitted', (SELECT COUNT(*) FROM farmer_feedback WHERE status = 'submitted' AND farm_id = ANY(filtered_farm_ids)),
  'acknowledged', (SELECT COUNT(*) FROM farmer_feedback WHERE status = 'acknowledged' AND farm_id = ANY(filtered_farm_ids)),
  'under_review', (SELECT COUNT(*) FROM farmer_feedback WHERE status = 'under_review' AND farm_id = ANY(filtered_farm_ids)),
  'action_taken', (SELECT COUNT(*) FROM farmer_feedback WHERE status = 'action_taken' AND farm_id = ANY(filtered_farm_ids)),
  'resolved', (SELECT COUNT(*) FROM farmer_feedback WHERE status = 'resolved' AND farm_id = ANY(filtered_farm_ids)),
  'closed', (SELECT COUNT(*) FROM farmer_feedback WHERE status = 'closed' AND farm_id = ANY(filtered_farm_ids)),
  'total', (SELECT COUNT(*) FROM farmer_feedback WHERE farm_id = ANY(filtered_farm_ids))
)
```

Notes:
- We do not compare to any invalid enum value.
- We keep the `filtered_farm_ids` approach, so the demo/live/all toggle continues to work.

### 2) Confirm the function signature remains unchanged
DB confirms the currently deployed function signature is:
- `get_system_health_metrics(text) -> jsonb`

We will keep this stable to avoid breaking frontend calls.

---

## Verification / QA steps (end-to-end)

1. Open Admin Dashboard on:
   - `/admin?tab=dashboard&data_source=demo`
2. Confirm the dashboard loads (no “Failed to load system metrics”)
3. Switch header toggle:
   - Demo → Live → All
   - Confirm metrics still load for each
4. Sanity-check “Feedback” numbers:
   - Submitted count should appear instead of “pending”
5. Quick regression scan:
   - No new “relation does not exist”
   - No new “invalid input value for enum …”

---

## Change Impact Summary

**Modified (planned)**: one new SQL migration that recreates `public.get_system_health_metrics(text)` with corrected feedback-status filters.

**Data Flow**: `farmer_feedback` (enum `feedback_status`) → `get_system_health_metrics` → `useSystemHealth` → Admin Dashboard “System Overview”

**Breaking Changes**: None (same RPC name + same argument type)

**Primary testing point**: Admin Dashboard > Dashboard tab, especially in `data_source=demo` mode where you encountered the error.
