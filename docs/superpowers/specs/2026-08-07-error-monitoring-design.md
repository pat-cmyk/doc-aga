# Error Monitoring & One-Tap Error Tickets — Design

**Date:** 2026-08-07
**Status:** Approved approach (Option A — in-house, Supabase-native)

## Goal

Admins know about every error before (or whether or not) a user reports it. When an
error message pops up for a farmer, they can report it with a single tap on a
pre-filled ticket — no typing required. Admins triage all captured errors in a new
Admin Dashboard tab and can convert any error group into a support ticket.

## Decisions Made

| Question | Decision |
|---|---|
| Capture scope | All error toasts, app crashes/white screens, Edge Function failures, and silent background errors |
| Farmer report UX | Action button on the error toast — one tap submits the pre-filled ticket |
| Admin ↔ ticket relationship | Triage in a new Error Monitoring tab; admins one-click convert error groups into tickets. No auto-ticketing. |
| Build vs buy | In-house on Supabase (Option A). No third-party APM — preserves offline-first, no new vendor, single admin dashboard. |

## Architecture

```
Client errors                          Server errors
─────────────                          ─────────────
translateError() ─┐                    Edge Functions ─→ logServerError()
ErrorBoundary ────┤                                        (shared helper)
window.onerror ───┼─→ errorMonitor.ts                            │
unhandledrejection┤     (fingerprint,                            │
caught-silent ────┘      dedup, queue)                           │
                            │ online? flush                      │
                            ▼                                    ▼
                    log_client_error RPC ──────→ client_error_logs table
                                                        │
              ┌─────────────────────────────────────────┤
              ▼                                         ▼
   Farmer taps "I-report" on toast          Admin Error Monitoring tab
   → submit_error_report RPC                → grouped list, triage status,
   → support_tickets row (pre-filled,         "Create Ticket" → existing
     linked to error log)                     CreateTicketDialog pre-filled
```

## Components

### 1. Client capture — `src/lib/errorMonitor.ts` (new)

Single module owning capture, fingerprinting, dedup, offline queue, and flush.

**Capture points:**
- `translateError()` in `src/lib/errorHandling.ts` gains one call:
  `reportError(error, context, translated)` — instantly covers every existing
  error toast in the app with zero per-call-site changes.
- New root `<AppErrorBoundary>` (modeled on `SyncErrorBoundary`) wraps the app in
  `App.tsx`. On crash: logs with severity `crash`, renders a friendly Taglish
  recovery screen ("May nangyaring problema...") with a Reload button and the
  same one-tap Report button.
- `window.onerror` + `window.onunhandledrejection` listeners registered once at
  app boot for errors outside React's render tree.
- `reportSilentError(error, context)` export for caught-but-not-shown errors
  (cache update failures, background sync retries). Call sites added
  incrementally, starting with `cacheManager.ts` and the sync queue.

**Fingerprinting:** `hash(severity + error name + normalized message + route)`.
Message normalization strips UUIDs, numbers, and quoted values so "Animal
`a1b2…` not found" and "Animal `c3d4…` not found" group together.

**Payload:** fingerprint, raw message, stack (crashes only), translated title,
context string, route, app version, user id, farm id, online status, user agent,
occurred_at (client clock, via `toTimestamptz`).

**Noise control:**
- Same fingerprint within 5 minutes → increment a local counter, don't re-send;
  counter flushes as `occurrence_count` on next send.
- Hard cap: max 20 error reports sent per session. Beyond that, drop (log to
  console only). Prevents an error loop from flooding the table.

**Offline behavior:** reports queue in IndexedDB (new `error_report_queue` store
following existing `dataCache.ts` patterns) and flush when `getIsOnline()` is
true — piggybacking on the existing connectivity-restored path. Never uses
`navigator.onLine` directly. Queue capped at 50 entries (oldest dropped).

### 2. Backend — one migration + one shared Edge helper

**Table `client_error_logs`:**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| fingerprint | text NOT NULL | dedup/group key; unique per row-group via upsert |
| severity | enum `error_severity`: `toast`, `crash`, `silent`, `server` | |
| message | text NOT NULL | raw error message (latest occurrence) |
| stack | text | crashes/server only |
| translated_title | text | what the farmer saw |
| context | jsonb | route, app version, user agent, online status, function name (server), etc. |
| user_id / farm_id | uuid nullable | latest occurrence's reporter |
| occurrence_count | int DEFAULT 1 | incremented by upsert |
| affected_user_count | int DEFAULT 1 | maintained by RPC (distinct users seen) |
| first_seen_at / last_seen_at | timestamptz | |
| status | enum `error_log_status`: `new`, `investigating`, `resolved`, `ignored` | admin triage state |
| linked_ticket_id | uuid REFERENCES support_tickets | set by convert-to-ticket or farmer report |
| created_at / updated_at | timestamptz | |

One row per fingerprint (upsert increments `occurrence_count`, updates
`last_seen_at`). A companion `error_log_occurrences` table is **not** built now
(YAGNI) — the latest occurrence's details on the group row are enough for triage.
If an error recurs after being `resolved`, the RPC flips status back to `new`
(regression detection).

**RLS:** `client_error_logs` is super-admin only for SELECT/UPDATE/DELETE (same
`is_super_admin()` pattern as `support_tickets`). No direct INSERT policy — all
writes go through RPCs.

**RPCs (all SECURITY DEFINER):**
- `log_client_error(payload jsonb)` — validates auth (any authenticated user),
  validates/clamps payload fields (message length, jsonb keys), rate-limits
  (max 30 rows touched per user per hour, checked in-function), upserts by
  fingerprint. Returns the error log id so the client can reference it when the
  farmer taps Report.
- `submit_error_report(error_log_id uuid, user_note text DEFAULT NULL)` —
  creates the pre-filled `support_tickets` row on behalf of the farmer
  (bypasses super-admin-only RLS deliberately): subject = translated title,
  description = auto-formatted details block (error message, route, farm, device,
  time, occurrence count) + optional note, priority = `high` for crashes else
  `medium`, tags = `['auto-error']`, `created_by` = caller, `linked_farm_id` /
  `linked_user_id` from the error log; sets `linked_ticket_id` on the error log.
  Idempotent: if the error log already has a ticket, adds a comment
  ("Also reported by …") instead of a duplicate ticket, and returns the existing
  ticket number.
- `get_error_monitoring_summary()` — super-admin only; grouped list with filters
  handled client-side (small volumes at current scale).
- Extend the existing admin system-overview RPC with `errors` counts
  (`new`, `crashes_24h`, `total_24h`) for the System Overview cards.

**Edge Functions — `supabase/functions/_shared/errorLogger.ts` (new):**
`logServerError(supabaseAdmin, fnName, error, context)` — writes severity
`server` rows (service role client, direct insert). Wired into the two
highest-traffic functions first: `doc-aga` and `calculate-daily-stats`.
Fire-and-forget with try/catch — logging failure must never break the function.
Other functions adopt it incrementally.

### 3. Farmer one-tap report

- `showErrorToast()` renders the sonner toast with an action button
  **"I-report / Report"** whenever the error was successfully captured (has an
  error log id or a queued entry).
- Tap → calls `submit_error_report` (or queues it offline alongside the error
  report) → toast updates to "Salamat! Naipadala ang report. (TKT-…)" —
  no dialog, no typing, one tap total.
- Crash recovery screen (`AppErrorBoundary` fallback) shows the same Report
  button plus Reload.
- Duplicate taps / already-reported errors resolve to the existing ticket
  (idempotent RPC) — farmer still sees a thank-you.

### 4. Admin — Error Monitoring tab

New tab in the Admin Dashboard beside Support Tickets:

- **`ErrorMonitoringTab.tsx`** — table of error groups: severity badge, message,
  translated title, count, affected users, first/last seen, status. Filters:
  status, severity, time range. Default view: `new` + `investigating`.
- **`ErrorDetailPanel.tsx`** — side panel (mirrors `TicketDetailPanel` layout):
  full message, stack, context (route, version, device, online state), status
  select (`new/investigating/resolved/ignored`), link to the connected ticket if
  one exists, and **"Create Ticket"** which opens the existing
  `CreateTicketDialog` pre-filled (subject, description, priority, linked farm/
  user, tag `auto-error`) — on create, `linked_ticket_id` is set.
- **`useErrorLogs.ts`** hook — TanStack Query over `get_error_monitoring_summary`
  + status-update mutation. **Read Path Category B/C style: online-only, no
  IndexedDB cache** (admin-only data; not farm-level).
- `SystemOverview` cards show new-error and 24h-crash counts via the extended
  overview RPC.

## Data Flow (SSOT trace)

`client_error_logs` (table) → `log_client_error` / `submit_error_report` /
`get_error_monitoring_summary` (RPCs) → `errorMonitor.ts` + `useErrorLogs` (hooks/lib)
→ error toast button, `AppErrorBoundary`, `ErrorMonitoringTab` (components).
Ticket side reuses the existing `support_tickets` SSOT unchanged (one new tag
value and RPC writer).

## Error Handling of the Error Handler

- `errorMonitor.ts` never throws into app code — every entry point is wrapped;
  failure degrades to `console.error`.
- Reporting an error must never trigger `translateError` recursively (monitor
  uses raw fetch/RPC with its own silent catch, not `showErrorToast`).
- Edge logger is fire-and-forget.

## Testing

- Unit: fingerprint normalization (UUID/number stripping), dedup window,
  session cap, queue cap, offline queue flush (Vitest, existing patterns with
  `renderWithProviders`).
- Unit: `translateError` still returns identical messages (regression) and
  calls `reportError` exactly once per invocation.
- Component: toast shows Report button; tap fires RPC once; duplicate tap safe.
- Component: `ErrorMonitoringTab` renders groups, status change fires mutation.
- SQL (manual, via SQL Editor per deployment constraints): upsert increments
  count, regression flips `resolved` → `new`, rate limit enforced,
  `submit_error_report` idempotency.

## Deployment Notes (Lovable Cloud constraints)

- Migration SQL written to `supabase/migrations/`; user runs it in the Supabase
  Dashboard SQL Editor.
- `_shared/errorLogger.ts` + edited Edge Functions deploy via Lovable relay.
- `types.ts` will be stale until Lovable regenerates — call sites use narrow
  typed interfaces (no `as any`) per CLAUDE.md.

## Explicitly Out of Scope (YAGNI)

- Per-occurrence history table
- Source-map stack decoding
- Email/push alerting to admins (System Overview counts cover awareness for now)
- Auto-ticket creation without a human in the loop
- Screenshot capture on error

## Governance Updates on Completion

- `docs/data-relationships-map.md` — new table + RPCs
- `docs/ssot-architecture.md` — error monitoring data flow
- `changelog.md` — feature entry
