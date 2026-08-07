# Error Monitoring & One-Tap Error Tickets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture every client, crash, silent, and server error into a `client_error_logs` table; let farmers file a pre-filled support ticket with one tap on the error toast; give admins an Error Monitoring tab to triage and convert errors into tickets.

**Architecture:** A new `src/lib/errorMonitor.ts` module owns fingerprinting, dedup, an IndexedDB offline queue, and flushing to a `log_client_error` SECURITY DEFINER RPC. `translateError()` reports every toast automatically; a root `AppErrorBoundary` + global listeners catch crashes. One-tap reporting goes through a `submit_error_report` RPC that creates the pre-filled `support_tickets` row (bypassing super-admin-only ticket RLS deliberately). Admins read grouped errors via `get_error_monitoring_summary` in a new subtab under Operations.

**Tech Stack:** React 18 + TypeScript, TanStack Query, sonner toasts, idb (IndexedDB), Vitest + fake-indexeddb, Supabase (Postgres RPCs, RLS, Edge Functions on Deno).

**Spec:** `docs/superpowers/specs/2026-08-07-error-monitoring-design.md`

**Deviations from spec (decided during planning):**
1. The spec said "extend `get_system_health_metrics`". That RPC has been redefined in 12 migrations already — redefining it again from a possibly-stale copy risks drift. Instead, `get_error_monitoring_summary` returns a `counts` object and `SystemOverview` consumes it via the same `useErrorLogs` hook (same query cache, admin-only). Same outcome, no drift risk.
2. Admin writes (status change, ticket linking) also go through small RPCs (`update_error_log_status`, `set_error_log_ticket`) rather than direct table updates — `types.ts` is Lovable-generated and stale until regeneration, and RPC-only writes keep one consistent write path.
3. `showErrorToastLegacy` (shadcn hook toast) call sites get error *capture* (via `translateError`) but no Report button — the legacy toast API can't take a simple action config. Sonner call sites (the majority and the standard going forward) get the button.
4. The spec's "queue cap" unit test is omitted: the queue cap (50) can never be reached within one session because the session send cap (20) is lower; the cap only matters as cross-session accumulation while offline, which a unit test can't meaningfully exercise. The cap logic is 5 lines in `enqueue()` and is verified by review.
5. The spec's component tests for `ErrorMonitoringTab` are replaced by compile/build checks plus mandatory browser verification (Tasks 9 and 12) — consistent with the repo's existing test coverage for admin components (none have component tests today; the 10% CI gate is met by lib tests).

**Deployment constraint (read before starting):** Claude Code cannot run migrations or deploy Edge Functions. The migration SQL is written to `supabase/migrations/` and the user runs it in the Supabase Dashboard SQL Editor. Edge Function changes deploy via Lovable relay. Frontend work is verified with `npm run test` / `npm run build` locally; RPC round-trips are verified after the user runs the SQL.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260807000000_error_monitoring.sql` | Create | Table, enums, RLS, all 5 RPCs |
| `src/lib/errorMonitor.ts` | Create | Capture, fingerprint, dedup, offline queue, flush, one-tap report |
| `src/lib/__tests__/errorMonitor.test.ts` | Create | Unit tests for the above |
| `src/hooks/useOnlineStatus.ts` | Modify | Add non-React `subscribeOnlineStatus()` export |
| `src/lib/errorHandling.ts` | Modify | `translateError` reports every error; `showErrorToast` gains Report action |
| `src/lib/__tests__/errorHandling.test.ts` | Create | Regression + capture-called-once tests |
| `src/components/AppErrorBoundary.tsx` | Create | Root crash boundary with Taglish recovery screen + Report |
| `src/main.tsx` | Modify | Wrap `<App />` in boundary; `initErrorMonitor()` |
| `src/lib/syncTelemetry.ts` | Modify | `recordSyncError` also reports silently |
| `src/hooks/useErrorLogs.ts` | Create | Admin query + mutations over the RPCs |
| `src/components/admin/ErrorMonitoringTab.tsx` | Create | Grouped error list with filters |
| `src/components/admin/ErrorDetailPanel.tsx` | Create | Detail sheet: triage status, Create Ticket |
| `src/components/admin/tabs/OperationsTab.tsx` | Modify | New "Errors" subtab |
| `src/components/admin/CreateTicketDialog.tsx` | Modify | Optional prefill props + `onCreated` |
| `src/components/admin/SystemOverview.tsx` | Modify | Error counts in "Requires Attention" card |
| `supabase/functions/_shared/errorLogger.ts` | Create | `logServerError()` fire-and-forget helper |
| `supabase/functions/doc-aga/index.ts` | Modify | Log top-level failures |
| `supabase/functions/calculate-daily-stats/index.ts` | Modify | Log top-level failures |
| `docs/data-relationships-map.md`, `docs/ssot-architecture.md`, `changelog.md` | Modify | Governance |

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260807000000_error_monitoring.sql`

No local test runner exists for SQL. Verification happens in Task 12 via the SQL Editor. Write the file exactly as below.

- [ ] **Step 1: Write the migration**

```sql
-- Error Monitoring & One-Tap Error Tickets
-- Spec: docs/superpowers/specs/2026-08-07-error-monitoring-design.md
-- Run this file in the Supabase Dashboard SQL Editor (Lovable Cloud — no CLI access).

-- ─── Enums ────────────────────────────────────────────────────────────
CREATE TYPE error_severity AS ENUM ('toast', 'crash', 'silent', 'server');
CREATE TYPE error_log_status AS ENUM ('new', 'investigating', 'resolved', 'ignored');

-- ─── Tables ───────────────────────────────────────────────────────────
-- One row per fingerprint. Upserts increment occurrence_count.
CREATE TABLE public.client_error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,
  severity error_severity NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  translated_title TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES public.profiles(id),
  farm_id UUID REFERENCES public.farms(id),
  seen_user_ids UUID[] NOT NULL DEFAULT '{}',
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status error_log_status NOT NULL DEFAULT 'new',
  linked_ticket_id UUID REFERENCES public.support_tickets(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_error_logs_status ON public.client_error_logs(status);
CREATE INDEX idx_client_error_logs_last_seen ON public.client_error_logs(last_seen_at DESC);

-- Per-user hourly rate limiting for log_client_error.
CREATE TABLE public.error_report_rate (
  user_id UUID NOT NULL,
  hour_bucket TIMESTAMPTZ NOT NULL,
  report_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, hour_bucket)
);

-- ─── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_report_rate ENABLE ROW LEVEL SECURITY;

-- Super admins read/triage. NO INSERT policy: all client writes go through
-- SECURITY DEFINER RPCs; Edge Functions insert via service role (bypasses RLS).
CREATE POLICY "Super admins can view error logs"
  ON public.client_error_logs FOR SELECT
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update error logs"
  ON public.client_error_logs FOR UPDATE
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete error logs"
  ON public.client_error_logs FOR DELETE
  USING (is_super_admin(auth.uid()));

-- error_report_rate: intentionally no policies — RPC-internal only.

-- ─── RPC: log_client_error ────────────────────────────────────────────
-- Any authenticated user may log. Validates + clamps payload, rate-limits
-- (30/user/hour), upserts by fingerprint. Returns error log id (NULL if
-- rate-limited).
CREATE OR REPLACE FUNCTION public.log_client_error(_payload JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _fingerprint TEXT := LEFT(_payload->>'fingerprint', 128);
  _severity error_severity;
  _message TEXT := LEFT(COALESCE(_payload->>'message', ''), 2000);
  _stack TEXT := LEFT(_payload->>'stack', 8000);
  _title TEXT := LEFT(_payload->>'translated_title', 300);
  _context JSONB := COALESCE(_payload->'context', '{}'::jsonb);
  _farm UUID := NULLIF(_payload->>'farm_id', '')::uuid;
  _count INTEGER := LEAST(GREATEST(COALESCE((_payload->>'occurrence_count')::int, 1), 1), 100);
  _bucket TIMESTAMPTZ := date_trunc('hour', now());
  _rate INTEGER;
  _log_id UUID;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _fingerprint IS NULL OR _fingerprint = '' OR _message = '' THEN
    RAISE EXCEPTION 'Invalid payload';
  END IF;

  BEGIN
    _severity := (_payload->>'severity')::error_severity;
  EXCEPTION WHEN OTHERS THEN
    _severity := 'toast';
  END;
  -- 'server' severity is reserved for Edge Functions (service role inserts)
  IF _severity = 'server' THEN
    _severity := 'silent';
  END IF;

  -- Opportunistic cleanup of old rate buckets (cheap at current scale)
  DELETE FROM error_report_rate WHERE hour_bucket < now() - interval '24 hours';

  INSERT INTO error_report_rate (user_id, hour_bucket, report_count)
  VALUES (_uid, _bucket, 1)
  ON CONFLICT (user_id, hour_bucket)
  DO UPDATE SET report_count = error_report_rate.report_count + 1
  RETURNING report_count INTO _rate;

  IF _rate > 30 THEN
    RETURN NULL;
  END IF;

  -- context is client-supplied; drop it if oversized
  IF pg_column_size(_context) > 4096 THEN
    _context := '{}'::jsonb;
  END IF;

  INSERT INTO client_error_logs AS cel
    (fingerprint, severity, message, stack, translated_title, context,
     user_id, farm_id, seen_user_ids, occurrence_count)
  VALUES
    (_fingerprint, _severity, _message, _stack, _title, _context,
     _uid, _farm, ARRAY[_uid], _count)
  ON CONFLICT (fingerprint) DO UPDATE SET
    message = EXCLUDED.message,
    stack = COALESCE(EXCLUDED.stack, cel.stack),
    translated_title = COALESCE(EXCLUDED.translated_title, cel.translated_title),
    context = EXCLUDED.context,
    user_id = EXCLUDED.user_id,
    farm_id = COALESCE(EXCLUDED.farm_id, cel.farm_id),
    -- distinct reporters, capped at 50
    seen_user_ids = CASE
      WHEN cel.seen_user_ids @> ARRAY[_uid] OR cardinality(cel.seen_user_ids) >= 50
        THEN cel.seen_user_ids
      ELSE cel.seen_user_ids || _uid
    END,
    occurrence_count = cel.occurrence_count + EXCLUDED.occurrence_count,
    last_seen_at = now(),
    updated_at = now(),
    -- regression detection: a resolved error that recurs goes back to 'new'
    status = CASE
      WHEN cel.status = 'resolved' THEN 'new'::error_log_status
      ELSE cel.status
    END
  RETURNING id INTO _log_id;

  RETURN _log_id;
END;
$$;

-- ─── RPC: submit_error_report ─────────────────────────────────────────
-- One-tap farmer report. Creates the pre-filled support ticket on behalf of
-- the caller (support_tickets RLS is super-admin-only by design — this
-- SECURITY DEFINER function is the sanctioned bypass). Idempotent: a second
-- report on the same error adds an internal comment instead of a new ticket.
-- Returns the ticket_number.
CREATE OR REPLACE FUNCTION public.submit_error_report(
  _error_log_id UUID,
  _user_note TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _log client_error_logs%ROWTYPE;
  _ticket support_tickets%ROWTYPE;
  _description TEXT;
  _priority ticket_priority;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _log FROM client_error_logs WHERE id = _error_log_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Error log not found';
  END IF;

  -- Only a user who actually hit this error may report it
  IF NOT (_log.seen_user_ids @> ARRAY[_uid]) THEN
    RAISE EXCEPTION 'Not a reporter of this error';
  END IF;

  IF _log.linked_ticket_id IS NOT NULL THEN
    SELECT * INTO _ticket FROM support_tickets WHERE id = _log.linked_ticket_id;
    IF FOUND THEN
      INSERT INTO ticket_comments (ticket_id, author_id, content, is_internal)
      VALUES (
        _log.linked_ticket_id, _uid,
        'Also reported via one-tap error report.' ||
        COALESCE(' Note: ' || LEFT(_user_note, 500), ''),
        true
      );
      RETURN _ticket.ticket_number;
    END IF;
  END IF;

  _priority := CASE WHEN _log.severity = 'crash'
    THEN 'high'::ticket_priority ELSE 'medium'::ticket_priority END;

  _description :=
    'Auto-generated from a one-tap error report.' || E'\n\n' ||
    'Error: ' || _log.message || E'\n' ||
    'Shown to user as: ' || COALESCE(_log.translated_title, '—') || E'\n' ||
    'Severity: ' || _log.severity || E'\n' ||
    'Route: ' || COALESCE(_log.context->>'route', '—') || E'\n' ||
    'Device: ' || COALESCE(_log.context->>'user_agent', '—') || E'\n' ||
    'Online at time of error: ' || COALESCE(_log.context->>'online', '—') || E'\n' ||
    'Occurrences so far: ' || _log.occurrence_count ||
    COALESCE(E'\n\nUser note: ' || LEFT(_user_note, 1000), '');

  INSERT INTO support_tickets
    (subject, description, priority, created_by, linked_farm_id, linked_user_id, tags)
  VALUES (
    COALESCE(_log.translated_title, 'App error report'),
    _description, _priority, _uid, _log.farm_id, _uid,
    ARRAY['auto-error']
  )
  RETURNING * INTO _ticket;

  UPDATE client_error_logs
  SET linked_ticket_id = _ticket.id, updated_at = now()
  WHERE id = _error_log_id;

  RETURN _ticket.ticket_number;
END;
$$;

-- ─── RPC: get_error_monitoring_summary ────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_error_monitoring_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'counts', jsonb_build_object(
      'new', (SELECT COUNT(*) FROM client_error_logs WHERE status = 'new'),
      'investigating', (SELECT COUNT(*) FROM client_error_logs WHERE status = 'investigating'),
      'crashes_24h', (SELECT COUNT(*) FROM client_error_logs
                      WHERE severity = 'crash' AND last_seen_at > now() - interval '24 hours'),
      'total_24h', (SELECT COUNT(*) FROM client_error_logs
                    WHERE last_seen_at > now() - interval '24 hours')
    ),
    'groups', COALESCE((
      SELECT jsonb_agg(g)
      FROM (
        SELECT jsonb_build_object(
          'id', cel.id,
          'fingerprint', cel.fingerprint,
          'severity', cel.severity,
          'message', cel.message,
          'stack', cel.stack,
          'translated_title', cel.translated_title,
          'context', cel.context,
          'user_id', cel.user_id,
          'farm_id', cel.farm_id,
          'farm_name', f.name,
          'affected_user_count', cardinality(cel.seen_user_ids),
          'occurrence_count', cel.occurrence_count,
          'first_seen_at', cel.first_seen_at,
          'last_seen_at', cel.last_seen_at,
          'status', cel.status,
          'linked_ticket_id', cel.linked_ticket_id,
          'linked_ticket_number', st.ticket_number
        ) AS g
        FROM client_error_logs cel
        LEFT JOIN farms f ON f.id = cel.farm_id
        LEFT JOIN support_tickets st ON st.id = cel.linked_ticket_id
        ORDER BY cel.last_seen_at DESC
        LIMIT 200
      ) sub
    ), '[]'::jsonb),
    'last_updated', now()
  ) INTO result;

  RETURN result;
END;
$$;

-- ─── RPC: update_error_log_status ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_error_log_status(
  _id UUID,
  _status error_log_status
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  UPDATE client_error_logs SET status = _status, updated_at = now() WHERE id = _id;
END;
$$;

-- ─── RPC: set_error_log_ticket ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_error_log_ticket(
  _id UUID,
  _ticket_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  UPDATE client_error_logs
  SET linked_ticket_id = _ticket_id, updated_at = now()
  WHERE id = _id;
END;
$$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260807000000_error_monitoring.sql
git commit -m "feat: error monitoring schema + RPCs (migration)"
git push
```

---

### Task 2: `subscribeOnlineStatus` export

**Files:**
- Modify: `src/hooks/useOnlineStatus.ts`

The error monitor is non-React and needs to flush its queue on reconnect. The module already keeps a `_listeners` set used by the `useOnlineStatus` hook (around line 42: `const _listeners = new Set<(online: boolean) => void>();`). Add a plain-function subscription API next to `getIsOnline()` (~line 155).

- [ ] **Step 1: Add the export**

Add after the `getIsOnline()` function:

```ts
/**
 * Subscribe to connectivity changes outside React (SSOT: same probe as
 * useOnlineStatus). Returns an unsubscribe function.
 */
export function subscribeOnlineStatus(listener: (online: boolean) => void): () => void {
  ensureProbeStarted();
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}
```

(`ensureProbeStarted` is a module-level function already defined in this file — same one the hook calls.)

- [ ] **Step 2: Verify compile + existing tests**

Run: `npx tsc --noEmit && npm run test -- --run src/lib/__tests__`
Expected: no type errors; existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useOnlineStatus.ts
git commit -m "feat: add subscribeOnlineStatus for non-React consumers"
git push
```

---

### Task 3: `errorMonitor.ts` core (TDD)

**Files:**
- Create: `src/lib/errorMonitor.ts`
- Test: `src/lib/__tests__/errorMonitor.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/__tests__/errorMonitor.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase client BEFORE importing the module under test
const rpcMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

// Control connectivity
let onlineState = true;
vi.mock('@/hooks/useOnlineStatus', () => ({
  getIsOnline: () => onlineState,
  subscribeOnlineStatus: vi.fn(() => () => {}),
}));

// errorMonitor toasts success/failure feedback directly via sonner
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import {
  normalizeMessage,
  computeFingerprint,
  captureError,
  takeLastCaptureHandle,
  flushQueue,
  _resetForTests,
} from '@/lib/errorMonitor';

beforeEach(async () => {
  onlineState = true;
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: 'log-id-1', error: null });
  await _resetForTests();
});

describe('normalizeMessage', () => {
  it('strips UUIDs, numbers, and quoted values so variants group together', () => {
    const a = normalizeMessage('Animal "a1b2c3d4-e5f6-7890-abcd-ef1234567890" not found (code 42)');
    const b = normalizeMessage("Animal 'ffffffff-0000-1111-2222-333333333333' not found (code 7)");
    expect(a).toBe(b);
    expect(a).not.toContain('42');
  });
});

describe('computeFingerprint', () => {
  it('is stable for the same inputs and differs across severities', () => {
    const f1 = computeFingerprint('toast', 'Error', 'save failed', '/dashboard');
    const f2 = computeFingerprint('toast', 'Error', 'save failed', '/dashboard');
    const f3 = computeFingerprint('crash', 'Error', 'save failed', '/dashboard');
    expect(f1).toBe(f2);
    expect(f1).not.toBe(f3);
    expect(f1.length).toBeLessThanOrEqual(128);
  });
});

describe('captureError', () => {
  it('queues and flushes a report via log_client_error when online', async () => {
    captureError(new Error('boom'), { severity: 'toast', context: 'saving milk record' });
    await flushQueue();
    expect(rpcMock).toHaveBeenCalledWith('log_client_error', expect.objectContaining({
      _payload: expect.objectContaining({
        severity: 'toast',
        message: 'boom',
      }),
    }));
  });

  it('dedups same fingerprint within the window (one RPC, accumulated count later)', async () => {
    captureError(new Error('boom'), { severity: 'toast' });
    captureError(new Error('boom'), { severity: 'toast' });
    captureError(new Error('boom'), { severity: 'toast' });
    await flushQueue();
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it('stops sending after the session cap of 20 distinct errors', async () => {
    for (let i = 0; i < 25; i++) {
      captureError(new Error(`unique error ${'x'.repeat(i + 1)}`), { severity: 'toast' });
    }
    await flushQueue();
    expect(rpcMock.mock.calls.length).toBeLessThanOrEqual(20);
  });

  it('keeps reports queued while offline and never throws', async () => {
    onlineState = false;
    const handle = captureError(new Error('offline boom'), { severity: 'toast' });
    expect(handle).not.toBeNull();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('exposes the last capture handle exactly once', () => {
    captureError(new Error('boom'), { severity: 'toast' });
    expect(takeLastCaptureHandle()).not.toBeNull();
    expect(takeLastCaptureHandle()).toBeNull();
  });
});

describe('one-tap report', () => {
  it('submits via submit_error_report once the log id is known', async () => {
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === 'log_client_error') return { data: 'log-id-9', error: null };
      if (fn === 'submit_error_report') return { data: 'TKT-202608-0001', error: null };
      return { data: null, error: { message: 'unknown rpc' } };
    });
    const handle = captureError(new Error('reportable'), { severity: 'toast' })!;
    await flushQueue();
    const result = await handle.requestReport();
    expect(result.status).toBe('submitted');
    if (result.status === 'submitted') {
      expect(result.ticketNumber).toBe('TKT-202608-0001');
    }
  });

  it('queues the report intent when offline, then submits on flush', async () => {
    onlineState = false;
    const handle = captureError(new Error('offline report'), { severity: 'toast' })!;
    const result = await handle.requestReport();
    expect(result.status).toBe('queued');

    onlineState = true;
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === 'log_client_error') return { data: 'log-id-2', error: null };
      if (fn === 'submit_error_report') return { data: 'TKT-202608-0002', error: null };
      return { data: null, error: { message: 'unknown rpc' } };
    });
    await flushQueue();
    const fns = rpcMock.mock.calls.map((c) => c[0]);
    expect(fns).toContain('log_client_error');
    expect(fns).toContain('submit_error_report');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --run src/lib/__tests__/errorMonitor.test.ts`
Expected: FAIL — `Cannot find module '@/lib/errorMonitor'`

- [ ] **Step 3: Implement `src/lib/errorMonitor.ts`**

```ts
/**
 * Error Monitor — SSOT for client-side error capture.
 *
 * Captures toast/crash/silent errors, fingerprints them so repeats group
 * server-side, queues reports in IndexedDB while offline, and flushes to the
 * log_client_error RPC. Also owns the one-tap "Report" flow that files a
 * pre-filled support ticket via submit_error_report.
 *
 * HARD RULES:
 * - Nothing in this module may throw into app code — every entry point is
 *   wrapped, failure degrades to console.error.
 * - Never call showErrorToast/translateError from here (recursion).
 */
import { openDB, IDBPDatabase } from 'idb';
import { toast as sonnerToast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getIsOnline, subscribeOnlineStatus } from '@/hooks/useOnlineStatus';

export type ClientErrorSeverity = 'toast' | 'crash' | 'silent';

export type ReportResult =
  | { status: 'submitted'; ticketNumber: string }
  | { status: 'queued' }
  | { status: 'failed' };

export interface CaptureHandle {
  fingerprint: string;
  requestReport(note?: string): Promise<ReportResult>;
}

interface QueuedReport {
  id?: number;
  fingerprint: string;
  severity: ClientErrorSeverity;
  message: string;
  stack?: string;
  translated_title?: string;
  context: Record<string, unknown>;
  farm_id?: string;
  occurrence_count: number;
  reportRequested: boolean;
  userNote?: string;
}

const DEDUP_WINDOW_MS = 5 * 60 * 1000;
const SESSION_CAP = 20;
const QUEUE_CAP = 50;
const DB_NAME = 'errorMonitorDB';
const STORE = 'reportQueue';

// The auto-generated Supabase types (types.ts) are Lovable-managed and do not
// yet include the error-monitoring RPCs from migration
// 20260807000000_error_monitoring.sql. Narrow, documented cast at this call
// site only (per CLAUDE.md — no `as any`).
type ErrorMonitorRpc = (
  fn: 'log_client_error' | 'submit_error_report',
  params: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: ErrorMonitorRpc = (fn, params) =>
  (supabase.rpc as unknown as ErrorMonitorRpc)(fn, params);

// ─── Module state ─────────────────────────────────────────────────────
let dbPromise: Promise<IDBPDatabase> | null = null;
let sessionSendCount = 0;
let flushing = false;
let lastHandle: CaptureHandle | null = null;
const dedup = new Map<string, { lastQueuedAt: number; pendingCount: number }>();
const handles = new Map<string, CaptureHandle>();
const fingerprintToLogId = new Map<string, string>();

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      },
    });
  }
  return dbPromise;
}

// ─── Fingerprinting ───────────────────────────────────────────────────
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(UUID_RE, '<id>')
    .replace(/"[^"]*"|'[^']*'/g, '<val>')
    .replace(/\d+/g, '#')
    .slice(0, 300);
}

function hashString(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

export function computeFingerprint(
  severity: ClientErrorSeverity,
  errorName: string,
  message: string,
  route: string,
): string {
  const hash = hashString(`${errorName}|${normalizeMessage(message)}`);
  return `${severity}|${route}|${hash}`.slice(0, 128);
}

// ─── Capture ──────────────────────────────────────────────────────────
export function captureError(
  error: unknown,
  opts: {
    severity: ClientErrorSeverity;
    context?: string;
    translatedTitle?: string;
    stack?: string;
  },
): CaptureHandle | null {
  try {
    const message =
      error instanceof Error ? error.message
      : typeof error === 'string' ? error
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
      : String(error);
    if (!message) return null;

    const errorName = error instanceof Error ? error.name : 'Error';
    const route = typeof window !== 'undefined' ? window.location.pathname : '';
    const fingerprint = computeFingerprint(opts.severity, errorName, message, route);

    const existingHandle = handles.get(fingerprint) ?? null;
    const entry = dedup.get(fingerprint);
    const now = Date.now();

    if (entry && now - entry.lastQueuedAt < DEDUP_WINDOW_MS) {
      // Within dedup window: count locally, flush with the next send
      entry.pendingCount += 1;
      lastHandle = existingHandle;
      return existingHandle;
    }

    if (sessionSendCount >= SESSION_CAP) {
      console.error('[errorMonitor] session cap reached, dropping:', message);
      return existingHandle;
    }
    sessionSendCount += 1;

    const pending = entry?.pendingCount ?? 0;
    dedup.set(fingerprint, { lastQueuedAt: now, pendingCount: 0 });

    const report: QueuedReport = {
      fingerprint,
      severity: opts.severity,
      message: message.slice(0, 2000),
      stack: (opts.stack ?? (error instanceof Error ? error.stack : undefined))?.slice(0, 8000),
      translated_title: opts.translatedTitle,
      context: {
        route,
        context: opts.context,
        online: getIsOnline(),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : '',
        mode: import.meta.env.MODE,
      },
      farm_id:
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('currentFarmId') ?? undefined
          : undefined,
      occurrence_count: 1 + pending,
      reportRequested: false,
    };

    const handle: CaptureHandle =
      existingHandle ?? {
        fingerprint,
        requestReport: (note?: string) => requestReport(fingerprint, note),
      };
    handles.set(fingerprint, handle);
    lastHandle = handle;

    void enqueue(report).then(() => {
      if (getIsOnline()) void flushQueue();
    });

    return handle;
  } catch (monitorError) {
    console.error('[errorMonitor] capture failed:', monitorError);
    return null;
  }
}

/** Convenience wrapper for caught-but-not-shown errors. */
export function reportSilentError(error: unknown, context: string): void {
  captureError(error, { severity: 'silent', context });
}

/** The toast layer reads the handle produced by the most recent capture. */
export function takeLastCaptureHandle(): CaptureHandle | null {
  const h = lastHandle;
  lastHandle = null;
  return h;
}

// ─── Queue ────────────────────────────────────────────────────────────
async function enqueue(report: QueuedReport): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE, 'readwrite');
    const count = await tx.store.count();
    if (count >= QUEUE_CAP) {
      const oldestCursor = await tx.store.openCursor();
      if (oldestCursor) await oldestCursor.delete();
    }
    await tx.store.add(report);
    await tx.done;
  } catch (queueError) {
    console.error('[errorMonitor] enqueue failed:', queueError);
  }
}

export async function flushQueue(): Promise<void> {
  if (flushing || !getIsOnline()) return;
  flushing = true;
  try {
    const db = await getDb();
    const entries = (await db.getAll(STORE)) as QueuedReport[];
    for (const entry of entries) {
      const { data, error } = await rpc('log_client_error', {
        _payload: {
          fingerprint: entry.fingerprint,
          severity: entry.severity,
          message: entry.message,
          stack: entry.stack,
          translated_title: entry.translated_title,
          context: entry.context,
          farm_id: entry.farm_id,
          occurrence_count: entry.occurrence_count,
        },
      });
      if (error) {
        // Network/auth failure — keep remaining entries for a later flush
        console.error('[errorMonitor] flush stopped:', error.message);
        return;
      }
      const logId = typeof data === 'string' ? data : null;
      if (logId) {
        fingerprintToLogId.set(entry.fingerprint, logId);
        if (entry.reportRequested) {
          const { data: ticket } = await rpc('submit_error_report', {
            _error_log_id: logId,
            _user_note: entry.userNote ?? null,
          });
          if (typeof ticket === 'string') {
            sonnerToast.success('Salamat!', {
              description: `Naipadala ang report (${ticket}). Aayusin namin ito.`,
            });
          }
        }
      }
      // logId === null means server-side rate limit — drop the entry
      if (entry.id !== undefined) await db.delete(STORE, entry.id);
    }
  } catch (flushError) {
    console.error('[errorMonitor] flush failed:', flushError);
  } finally {
    flushing = false;
  }
}

// ─── One-tap report ───────────────────────────────────────────────────
async function requestReport(fingerprint: string, note?: string): Promise<ReportResult> {
  try {
    const logId = fingerprintToLogId.get(fingerprint);
    if (logId && getIsOnline()) {
      const { data, error } = await rpc('submit_error_report', {
        _error_log_id: logId,
        _user_note: note ?? null,
      });
      if (!error && typeof data === 'string') {
        return { status: 'submitted', ticketNumber: data };
      }
      return { status: 'failed' };
    }

    // Log not yet flushed (or offline): mark queued entries so the flush
    // submits the report right after logging.
    const db = await getDb();
    const tx = db.transaction(STORE, 'readwrite');
    let marked = false;
    let cursor = await tx.store.openCursor();
    while (cursor) {
      const value = cursor.value as QueuedReport;
      if (value.fingerprint === fingerprint) {
        await cursor.update({ ...value, reportRequested: true, userNote: note });
        marked = true;
      }
      cursor = await cursor.continue();
    }
    await tx.done;
    if (!marked && !logId) return { status: 'failed' };
    if (getIsOnline()) void flushQueue();
    return { status: 'queued' };
  } catch (reportError) {
    console.error('[errorMonitor] requestReport failed:', reportError);
    return { status: 'failed' };
  }
}

/** UI entry point for the toast/crash-screen Report button. Owns feedback toasts. */
export async function submitOneTapReport(handle: CaptureHandle): Promise<void> {
  const result = await handle.requestReport();
  if (result.status === 'submitted') {
    sonnerToast.success('Salamat!', {
      description: `Naipadala ang report (${result.ticketNumber}). Aayusin namin ito.`,
    });
  } else if (result.status === 'queued') {
    sonnerToast.success('Salamat!', {
      description: 'Ipapadala ang report kapag may internet na. (Will send when back online.)',
    });
  } else {
    sonnerToast('Hindi naipadala ang report. Subukan ulit mamaya. (Could not send report.)');
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────
let initialized = false;

export function initErrorMonitor(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('error', (event) => {
    // Stale-chunk errors trigger a reload in main.tsx — don't log them
    if (event.message?.includes('Failed to fetch dynamically imported module')) return;
    captureError(event.error ?? event.message, { severity: 'crash', context: 'window.onerror' });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason;
    const msg =
      reason instanceof Error ? reason.message : String(reason ?? '');
    if (msg.includes('Failed to fetch dynamically imported module')) return;
    captureError(reason, { severity: 'crash', context: 'unhandledrejection' });
  });

  subscribeOnlineStatus((online) => {
    if (online) void flushQueue();
  });
  void flushQueue();
}

// ─── Test helpers ─────────────────────────────────────────────────────
export async function _resetForTests(): Promise<void> {
  sessionSendCount = 0;
  flushing = false;
  lastHandle = null;
  dedup.clear();
  handles.clear();
  fingerprintToLogId.clear();
  try {
    const db = await getDb();
    await db.clear(STORE);
  } catch {
    // ignore
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- --run src/lib/__tests__/errorMonitor.test.ts`
Expected: PASS (all 9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/errorMonitor.ts src/lib/__tests__/errorMonitor.test.ts
git commit -m "feat: client error monitor with fingerprinting, offline queue, one-tap report"
git push
```

---

### Task 4: Hook capture into `translateError` + Report button on toasts (TDD)

**Files:**
- Modify: `src/lib/errorHandling.ts`
- Test: `src/lib/__tests__/errorHandling.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/__tests__/errorHandling.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const captureErrorMock = vi.fn(() => null);
vi.mock('@/lib/errorMonitor', () => ({
  captureError: (...args: unknown[]) => captureErrorMock(...args),
  takeLastCaptureHandle: () => null,
  submitOneTapReport: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { translateError, ERROR_MESSAGES } from '@/lib/errorHandling';

beforeEach(() => {
  captureErrorMock.mockClear();
});

describe('translateError (regression)', () => {
  it('still maps duplicate key errors', () => {
    expect(translateError(new Error('duplicate key value violates unique constraint')))
      .toEqual(ERROR_MESSAGES.DUPLICATE);
  });

  it('still maps RLS errors', () => {
    expect(translateError(new Error('new row violates row-level security policy')))
      .toEqual(ERROR_MESSAGES.PERMISSION_DENIED);
  });

  it('still falls back with context', () => {
    const result = translateError(new Error('some unknown thing'), 'saving milk record');
    expect(result.title).toBe(ERROR_MESSAGES.FALLBACK.title);
    expect(result.description).toContain('saving milk record');
  });
});

describe('translateError capture integration', () => {
  it('reports each translated error exactly once with the translated title', () => {
    translateError(new Error('duplicate key value'), 'adding animal');
    expect(captureErrorMock).toHaveBeenCalledTimes(1);
    expect(captureErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        severity: 'toast',
        context: 'adding animal',
        translatedTitle: ERROR_MESSAGES.DUPLICATE.title,
      }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify capture test fails**

Run: `npm run test -- --run src/lib/__tests__/errorHandling.test.ts`
Expected: regression tests PASS, capture test FAILS (`captureErrorMock` not called)

- [ ] **Step 3: Modify `errorHandling.ts`**

3a. Add the import at the top (after the sonner import):

```ts
import { captureError, takeLastCaptureHandle, submitOneTapReport } from "@/lib/errorMonitor";
```

3b. Rename the existing `translateError` function to `matchError` (keep the body identical but **remove** the `console.error` line from it), then add a new `translateError` wrapper directly above `matchError`:

```ts
/**
 * Core translation engine.
 * Pattern-matches raw error strings to farmer-friendly bilingual messages,
 * and reports every error to the error monitor (SSOT capture point — every
 * user-facing error message in the app flows through here).
 */
export function translateError(error: unknown, context?: string): TranslatedError {
  // Always log raw error for debugging
  console.error("[translateError]", context || "", error);
  const translated = matchError(error, context);
  captureError(error, {
    severity: "toast",
    context,
    translatedTitle: translated.title,
  });
  return translated;
}

function matchError(error: unknown, context?: string): TranslatedError {
  // ...existing body of the old translateError, minus the console.error line...
}
```

3c. Replace `showErrorToast` with:

```ts
/**
 * Show error toast using sonner (preferred).
 * One-liner for any file — no hook needed.
 * When the error was captured by the monitor, the toast carries a one-tap
 * "I-report" action that files a pre-filled support ticket.
 */
export function showErrorToast(error: unknown, context?: string): void {
  const { title, description } = translateError(error, context);
  const handle = takeLastCaptureHandle();
  if (handle) {
    sonnerToast.error(title, {
      description,
      action: {
        label: "I-report",
        onClick: () => {
          void submitOneTapReport(handle);
        },
      },
    });
  } else {
    sonnerToast.error(title, { description });
  }
}
```

(`showErrorToastLegacy` is unchanged — legacy call sites still get capture via `translateError`, just no button.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- --run src/lib/__tests__/errorHandling.test.ts src/lib/__tests__/errorMonitor.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full test suite (this file is imported everywhere)**

Run: `npm run test -- --run`
Expected: PASS (no regressions)

- [ ] **Step 6: Commit**

```bash
git add src/lib/errorHandling.ts src/lib/__tests__/errorHandling.test.ts
git commit -m "feat: capture every translated error + one-tap report action on error toasts"
git push
```

---

### Task 5: `AppErrorBoundary` + boot wiring

**Files:**
- Create: `src/components/AppErrorBoundary.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create `src/components/AppErrorBoundary.tsx`**

```tsx
import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { captureError, submitOneTapReport, CaptureHandle } from "@/lib/errorMonitor";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  handle: CaptureHandle | null;
  reported: boolean;
}

/**
 * Root error boundary. Catches render crashes anywhere in the app, reports
 * them to the error monitor (severity: crash), and shows a Taglish recovery
 * screen with one-tap Report + Reload.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, handle: null, reported: false };
  }

  static getDerivedStateFromError(): Partial<AppErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[AppErrorBoundary] Caught crash:", error, errorInfo);
    const handle = captureError(error, {
      severity: "crash",
      context: "render",
      stack: `${error.stack ?? ""}\n${errorInfo.componentStack ?? ""}`,
    });
    this.setState({ handle });
  }

  handleReport = async () => {
    const { handle } = this.state;
    if (!handle) return;
    await submitOneTapReport(handle);
    this.setState({ reported: true });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-xl font-semibold mb-2">May nangyaring problema</h1>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          Nagka-error ang app. Paki-reload, o i-report para maayos namin agad.
          (Something went wrong. Please reload, or report it so we can fix it.)
        </p>
        <div className="flex gap-3">
          {this.state.reported ? (
            <Button variant="outline" disabled>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Nai-report na
            </Button>
          ) : (
            <Button variant="outline" onClick={this.handleReport} disabled={!this.state.handle}>
              <Send className="h-4 w-4 mr-2" />
              I-report
            </Button>
          )}
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            I-reload
          </Button>
        </div>
      </div>
    );
  }
}
```

- [ ] **Step 2: Wire into `src/main.tsx`**

2a. Add imports after the existing `import App from "./App.tsx";` line:

```ts
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { initErrorMonitor } from "./lib/errorMonitor";
```

2b. Add the init call directly before `createRoot(...)`:

```ts
// Global error capture (window.onerror, unhandledrejection, queue flush)
initErrorMonitor();
```

2c. Change the render block to wrap `<App />`:

```tsx
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelmetProvider>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </HelmetProvider>
  </StrictMode>
);
```

- [ ] **Step 3: Verify build + tests**

Run: `npx tsc --noEmit && npm run build`
Expected: clean build.

- [ ] **Step 4: Browser verify (CLAUDE.md UI rule)**

Start the dev server (preview tools, port 8080). In the browser console run:
`window.dispatchEvent(new ErrorEvent('error', { message: 'test error monitor', error: new Error('test error monitor') }))`
Expected: no visible change (captured silently — check console for absence of `[errorMonitor] capture failed`). Crash-screen rendering is verified in Task 12 end-to-end.

- [ ] **Step 5: Commit**

```bash
git add src/components/AppErrorBoundary.tsx src/main.tsx
git commit -m "feat: root crash boundary with Taglish recovery screen + global error listeners"
git push
```

---

### Task 6: Silent error reporting from sync failures

**Files:**
- Modify: `src/lib/syncTelemetry.ts:111-127` (`recordSyncError`)

- [ ] **Step 1: Add the import** at the top of `syncTelemetry.ts`:

```ts
import { reportSilentError } from '@/lib/errorMonitor';
```

- [ ] **Step 2: Report inside `recordSyncError`**

Add one line at the start of the function body, before the existing `const errorMessage` line:

```ts
export async function recordSyncError(
  sessionId: string,
  error: Error | string
): Promise<void> {
  reportSilentError(error, 'sync');
  const errorMessage = typeof error === 'string' ? error : error.message;
  // ...rest unchanged
```

- [ ] **Step 3: Run affected tests**

Run: `npm run test -- --run src/lib/__tests__/syncTelemetry.test.ts`
Expected: PASS. If the test file mocks the supabase client only, the new import may need a mock — add to the top of the test file if it fails with a resolution error:

```ts
vi.mock('@/lib/errorMonitor', () => ({ reportSilentError: vi.fn() }));
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/syncTelemetry.ts src/lib/__tests__/syncTelemetry.test.ts
git commit -m "feat: report sync failures to error monitor (silent severity)"
git push
```

---

### Task 7: `useErrorLogs` admin hook

**Files:**
- Create: `src/hooks/useErrorLogs.ts`

- [ ] **Step 1: Create the hook**

```ts
/**
 * @online-only — Admin-level error monitoring (cross-farm, super-admin RPCs).
 * Must NOT cache locally (RLS boundary) — same rule as useSystemHealth.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { showErrorToastLegacy } from "@/lib/errorHandling";

export type ErrorLogStatus = "new" | "investigating" | "resolved" | "ignored";
export type ErrorLogSeverity = "toast" | "crash" | "silent" | "server";

export interface ErrorLogGroup {
  id: string;
  fingerprint: string;
  severity: ErrorLogSeverity;
  message: string;
  stack: string | null;
  translated_title: string | null;
  context: Record<string, unknown>;
  user_id: string | null;
  farm_id: string | null;
  farm_name: string | null;
  affected_user_count: number;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  status: ErrorLogStatus;
  linked_ticket_id: string | null;
  linked_ticket_number: string | null;
}

export interface ErrorMonitoringSummary {
  counts: {
    new: number;
    investigating: number;
    crashes_24h: number;
    total_24h: number;
  };
  groups: ErrorLogGroup[];
  last_updated: string;
}

// types.ts is Lovable-generated and stale until regeneration; narrow typed
// cast for the new error-monitoring RPCs only (per CLAUDE.md — no `as any`).
type ErrorAdminRpc = (
  fn: "get_error_monitoring_summary" | "update_error_log_status" | "set_error_log_ticket",
  params?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: ErrorAdminRpc = (fn, params) =>
  (supabase.rpc as unknown as ErrorAdminRpc)(fn, params);

export function useErrorLogs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: summary, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-error-logs"],
    queryFn: async () => {
      const { data, error } = await rpc("get_error_monitoring_summary");
      if (error) throw new Error(error.message);
      return data as unknown as ErrorMonitoringSummary;
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ErrorLogStatus }) => {
      const { error } = await rpc("update_error_log_status", { _id: id, _status: status });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-error-logs"] });
    },
    onError: (err: Error) => {
      showErrorToastLegacy(toast, err, "updating error status");
    },
  });

  const linkTicket = useMutation({
    mutationFn: async ({ id, ticketId }: { id: string; ticketId: string }) => {
      const { error } = await rpc("set_error_log_ticket", { _id: id, _ticket_id: ticketId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-error-logs"] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: (err: Error) => {
      showErrorToastLegacy(toast, err, "linking ticket");
    },
  });

  return {
    summary,
    groups: summary?.groups ?? [],
    counts: summary?.counts,
    isLoading,
    error,
    refetch,
    updateStatus,
    linkTicket,
  };
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useErrorLogs.ts
git commit -m "feat: useErrorLogs admin hook (online-only, RPC-backed)"
git push
```

---

### Task 8: `CreateTicketDialog` prefill support

**Files:**
- Modify: `src/components/admin/CreateTicketDialog.tsx`

- [ ] **Step 1: Extend props and seed state**

1a. Replace the props interface (lines 28–33) with:

```ts
interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkedFarmId?: string;
  linkedUserId?: string;
  initialSubject?: string;
  initialDescription?: string;
  initialPriority?: TicketPriority;
  initialTags?: string[];
  onCreated?: (ticketId: string) => void;
}
```

1b. Update the component signature and add a `useEffect` that seeds state when the dialog opens (add `useEffect` to the react import on line 1):

```ts
export const CreateTicketDialog = ({
  open,
  onOpenChange,
  linkedFarmId,
  linkedUserId,
  initialSubject,
  initialDescription,
  initialPriority,
  initialTags,
  onCreated,
}: CreateTicketDialogProps) => {
  const { createTicket } = useSupportTickets();
  const isOnline = useOnlineStatus();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [selectedFarmId, setSelectedFarmId] = useState(linkedFarmId || "");
  const [selectedUserId, setSelectedUserId] = useState(linkedUserId || "");

  // Seed prefill values each time the dialog opens
  useEffect(() => {
    if (open) {
      setSubject(initialSubject ?? "");
      setDescription(initialDescription ?? "");
      setPriority(initialPriority ?? "medium");
      setSelectedFarmId(linkedFarmId ?? "");
      setSelectedUserId(linkedUserId ?? "");
    }
  }, [open, initialSubject, initialDescription, initialPriority, linkedFarmId, linkedUserId]);
```

1c. In `handleSubmit`, pass tags and surface the created ticket (replace the `await createTicket.mutateAsync({...});` call):

```ts
    const created = await createTicket.mutateAsync({
      subject,
      description,
      priority,
      linked_farm_id: selectedFarmId || undefined,
      linked_user_id: selectedUserId || undefined,
      tags: initialTags,
    });
    onCreated?.(created.id);
```

- [ ] **Step 2: Verify compile + build**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/CreateTicketDialog.tsx
git commit -m "feat: CreateTicketDialog prefill props + onCreated callback"
git push
```

---

### Task 9: Error Monitoring tab + detail panel

**Files:**
- Create: `src/components/admin/ErrorMonitoringTab.tsx`
- Create: `src/components/admin/ErrorDetailPanel.tsx`
- Modify: `src/components/admin/tabs/OperationsTab.tsx`

- [ ] **Step 1: Create `src/components/admin/ErrorDetailPanel.tsx`**

```tsx
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Ticket, ExternalLink } from "lucide-react";
import { formatPHDateAndTime } from "@/lib/dateUtils";
import { ErrorLogGroup, ErrorLogStatus, useErrorLogs } from "@/hooks/useErrorLogs";
import { CreateTicketDialog } from "./CreateTicketDialog";
import { severityBadgeVariant } from "./ErrorMonitoringTab";

interface ErrorDetailPanelProps {
  errorLog: ErrorLogGroup | null;
  onClose: () => void;
}

export const ErrorDetailPanel = ({ errorLog, onClose }: ErrorDetailPanelProps) => {
  const { updateStatus, linkTicket } = useErrorLogs();
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);

  if (!errorLog) return null;

  const contextRoute = typeof errorLog.context?.route === "string" ? errorLog.context.route : "—";
  const contextDevice = typeof errorLog.context?.user_agent === "string" ? errorLog.context.user_agent : "—";

  return (
    <Sheet open={!!errorLog} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Badge variant={severityBadgeVariant(errorLog.severity)}>{errorLog.severity}</Badge>
            <Badge variant="outline">×{errorLog.occurrence_count}</Badge>
          </div>
          <SheetTitle className="text-left break-words">
            {errorLog.translated_title || errorLog.message.slice(0, 80)}
          </SheetTitle>
          <SheetDescription className="text-left">
            First seen {formatPHDateAndTime(errorLog.first_seen_at)} · Last seen{" "}
            {formatPHDateAndTime(errorLog.last_seen_at)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          <div className="space-y-1">
            <Label>Raw message</Label>
            <pre className="p-2 bg-muted rounded text-xs overflow-x-auto whitespace-pre-wrap break-words">
              {errorLog.message}
            </pre>
          </div>

          {errorLog.stack && (
            <div className="space-y-1">
              <Label>Stack trace</Label>
              <pre className="p-2 bg-muted rounded text-xs overflow-auto max-h-48">
                {errorLog.stack}
              </pre>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <Label>Route</Label>
              <p className="text-muted-foreground break-words">{contextRoute}</p>
            </div>
            <div>
              <Label>Farm</Label>
              <p className="text-muted-foreground">{errorLog.farm_name || "—"}</p>
            </div>
            <div>
              <Label>Affected users</Label>
              <p className="text-muted-foreground">{errorLog.affected_user_count}</p>
            </div>
            <div>
              <Label>Device</Label>
              <p className="text-muted-foreground text-xs break-words">{contextDevice}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={errorLog.status}
              onValueChange={(v) =>
                updateStatus.mutate({ id: errorLog.id, status: v as ErrorLogStatus })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {errorLog.linked_ticket_number ? (
            <div className="flex items-center gap-2 text-sm">
              <Ticket className="h-4 w-4" />
              Linked ticket: <Badge variant="secondary">{errorLog.linked_ticket_number}</Badge>
            </div>
          ) : (
            <Button onClick={() => setTicketDialogOpen(true)}>
              <Ticket className="h-4 w-4 mr-2" />
              Create Ticket
            </Button>
          )}
        </div>

        <CreateTicketDialog
          open={ticketDialogOpen}
          onOpenChange={setTicketDialogOpen}
          linkedFarmId={errorLog.farm_id ?? undefined}
          linkedUserId={errorLog.user_id ?? undefined}
          initialSubject={errorLog.translated_title || `App error: ${errorLog.message.slice(0, 60)}`}
          initialDescription={`Created from Error Monitoring.\n\nError: ${errorLog.message}\nSeverity: ${errorLog.severity}\nRoute: ${contextRoute}\nOccurrences: ${errorLog.occurrence_count}\nAffected users: ${errorLog.affected_user_count}\nFirst seen: ${errorLog.first_seen_at}`}
          initialPriority={errorLog.severity === "crash" ? "high" : "medium"}
          initialTags={["auto-error"]}
          onCreated={(ticketId) => linkTicket.mutate({ id: errorLog.id, ticketId })}
        />
      </SheetContent>
    </Sheet>
  );
};
```

- [ ] **Step 2: Create `src/components/admin/ErrorMonitoringTab.tsx`**

```tsx
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Bug, RefreshCw, Users, Ticket } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useErrorLogs, ErrorLogGroup, ErrorLogSeverity } from "@/hooks/useErrorLogs";
import { ErrorDetailPanel } from "./ErrorDetailPanel";
import { translateError } from "@/lib/errorHandling";

export function severityBadgeVariant(
  severity: ErrorLogSeverity,
): "default" | "secondary" | "destructive" | "outline" {
  switch (severity) {
    case "crash":
      return "destructive";
    case "server":
      return "default";
    case "toast":
      return "secondary";
    case "silent":
      return "outline";
  }
}

type StatusFilter = "active" | "all" | "new" | "investigating" | "resolved" | "ignored";

export const ErrorMonitoringTab = () => {
  const { groups, counts, isLoading, error, refetch } = useErrorLogs();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [severityFilter, setSeverityFilter] = useState<"all" | ErrorLogSeverity>("all");
  const [selected, setSelected] = useState<ErrorLogGroup | null>(null);

  if (error) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <Bug className="h-10 w-10 text-destructive mb-3" />
        <p className="text-sm text-muted-foreground mb-4">{translateError(error).description}</p>
        <Button onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const filtered = groups.filter((g) => {
    const statusOk =
      statusFilter === "all" ? true
      : statusFilter === "active" ? g.status === "new" || g.status === "investigating"
      : g.status === statusFilter;
    const severityOk = severityFilter === "all" || g.severity === severityFilter;
    return statusOk && severityOk;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 mr-auto">
          <Bug className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Error Monitoring</h2>
          {counts && (
            <Badge variant={counts.new > 0 ? "destructive" : "secondary"}>
              {counts.new} new
            </Badge>
          )}
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active (new + investigating)</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="ignored">Ignored</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={severityFilter}
          onValueChange={(v) => setSeverityFilter(v as "all" | ErrorLogSeverity)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="crash">Crash</SelectItem>
            <SelectItem value="server">Server</SelectItem>
            <SelectItem value="toast">Toast</SelectItem>
            <SelectItem value="silent">Silent</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No errors match the current filters. 🎉
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((g) => (
            <Card
              key={g.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelected(g)}
            >
              <CardContent className="py-3 flex items-center gap-3">
                <Badge variant={severityBadgeVariant(g.severity)}>{g.severity}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {g.translated_title || g.message}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {g.message} · last seen{" "}
                    {formatDistanceToNow(new Date(g.last_seen_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                  {g.linked_ticket_number && (
                    <Badge variant="secondary" className="gap-1">
                      <Ticket className="h-3 w-3" />
                      {g.linked_ticket_number}
                    </Badge>
                  )}
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {g.affected_user_count}
                  </span>
                  <Badge variant="outline">×{g.occurrence_count}</Badge>
                  <Badge variant={g.status === "new" ? "destructive" : "outline"}>{g.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ErrorDetailPanel errorLog={selected} onClose={() => setSelected(null)} />
    </div>
  );
};
```

- [ ] **Step 3: Add the subtab in `OperationsTab.tsx`**

3a. Update the icon import (line 2):

```ts
import { Building2, Store, Ticket, BarChart3, Bug } from "lucide-react";
```

3b. Add the import below the `SupportTicketsTab` import:

```ts
import { ErrorMonitoringTab } from "../ErrorMonitoringTab";
```

3c. Add a trigger after the "tickets" `TabsTrigger`:

```tsx
          <TabsTrigger value="errors" className="flex items-center gap-2">
            <Bug className="h-4 w-4" />
            Errors
          </TabsTrigger>
```

3d. Add content after the "tickets" `TabsContent`:

```tsx
        <TabsContent value="errors" className="mt-6">
          <ErrorMonitoringTab />
        </TabsContent>
```

- [ ] **Step 4: Verify compile + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 5: Browser verify at desktop viewport**

Start the dev server, log in as super admin, open Admin Dashboard → Operations → Errors. Expected: tab renders (empty state until the migration runs — the RPC error state with Retry is acceptable pre-migration). Screenshot for the record.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/ErrorMonitoringTab.tsx src/components/admin/ErrorDetailPanel.tsx src/components/admin/tabs/OperationsTab.tsx
git commit -m "feat: admin Error Monitoring tab with triage + convert-to-ticket"
git push
```

---

### Task 10: SystemOverview error counts

**Files:**
- Modify: `src/components/admin/SystemOverview.tsx`

- [ ] **Step 1: Add hook + icon**

1a. Add `Bug` to the lucide import list (lines 7–11).
1b. Add below the `useSystemHealth` import:

```ts
import { useErrorLogs } from "@/hooks/useErrorLogs";
```

1c. Inside the component, after the `useSystemHealth` line:

```ts
  const { counts: errorCounts } = useErrorLogs();
```

- [ ] **Step 2: Extend the "Requires Attention" card**

2a. Extend the gating condition (line ~84) — replace:

```tsx
      {metrics && (metrics.support.urgent > 0 || metrics.feedback.pending > 20 || metrics.approvals.pending > 10 || metrics.stt.failed_24h > 0) && (
```

with:

```tsx
      {((metrics && (metrics.support.urgent > 0 || metrics.feedback.pending > 20 || metrics.approvals.pending > 10 || metrics.stt.failed_24h > 0)) || (errorCounts && errorCounts.new > 0)) && (
```

2b. This makes the JSX inside reference `metrics.*` while `metrics` may be undefined — guard each existing item block by prefixing with `metrics &&` if not already inside `metrics && ...` (the four existing item blocks each start with `{metrics.support.urgent > 0 && (` etc.; change each to `{metrics && metrics.support.urgent > 0 && (` — four edits).

2c. Add a new item button inside the `flex flex-wrap gap-3` div, after the STT failures block:

```tsx
              {errorCounts && errorCounts.new > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/50 text-destructive hover:bg-destructive/10"
                  onClick={() => navigateToTab("operations", "errors")}
                >
                  <Bug className="h-4 w-4 mr-2" />
                  {errorCounts.new} New Error{errorCounts.new > 1 ? "s" : ""}
                  {errorCounts.crashes_24h > 0 ? ` (${errorCounts.crashes_24h} crash${errorCounts.crashes_24h > 1 ? "es" : ""} 24h)` : ""}
                </Button>
              )}
```

- [ ] **Step 3: Verify compile + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/SystemOverview.tsx
git commit -m "feat: surface new-error and crash counts on admin System Overview"
git push
```

---

### Task 11: Edge Function server-side logging

**Files:**
- Create: `supabase/functions/_shared/errorLogger.ts`
- Modify: `supabase/functions/doc-aga/index.ts` (top-level catch, ~line 780)
- Modify: `supabase/functions/calculate-daily-stats/index.ts` (top-level catch, ~line 576)

- [ ] **Step 1: Create `supabase/functions/_shared/errorLogger.ts`**

```ts
/**
 * Shared server-side error logger for Edge Functions.
 * Writes severity 'server' rows to client_error_logs via the service role
 * (bypasses RLS — the table has no INSERT policy by design).
 * Fire-and-forget: never throws, never breaks the calling function.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export async function logServerError(
  fnName: string,
  error: unknown,
  context: Record<string, unknown> = {},
): Promise<void> {
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return;
    const admin = createClient(url, key);

    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? (error.stack ?? null) : null;
    const normalized = message
      .toLowerCase()
      .replace(UUID_RE, '<id>')
      .replace(/\d+/g, '#')
      .slice(0, 80);
    const fingerprint = `server|${fnName}|${normalized}`.slice(0, 128);
    const nowIso = new Date().toISOString();

    const { data: existing } = await admin
      .from('client_error_logs')
      .select('id, occurrence_count, status')
      .eq('fingerprint', fingerprint)
      .maybeSingle();

    if (existing) {
      await admin
        .from('client_error_logs')
        .update({
          message: message.slice(0, 2000),
          stack,
          context: { function: fnName, ...context },
          occurrence_count: existing.occurrence_count + 1,
          last_seen_at: nowIso,
          updated_at: nowIso,
          status: existing.status === 'resolved' ? 'new' : existing.status,
        })
        .eq('id', existing.id);
    } else {
      await admin.from('client_error_logs').insert({
        fingerprint,
        severity: 'server',
        message: message.slice(0, 2000),
        stack,
        context: { function: fnName, ...context },
      });
    }
  } catch (logErr) {
    console.error('[errorLogger] failed to log server error:', logErr);
  }
}
```

- [ ] **Step 2: Wire into `doc-aga/index.ts`**

2a. Add the import next to the other `_shared` imports at the top:

```ts
import { logServerError } from "../_shared/errorLogger.ts";
```

2b. In the top-level catch (~line 780), add the log call after the existing `console.error`:

```ts
  } catch (error: any) {
    console.error("doc-aga error:", error);
    await logServerError("doc-aga", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
```

- [ ] **Step 3: Wire into `calculate-daily-stats/index.ts`**

3a. Add the import at the top (next to the existing `createClient` import):

```ts
import { logServerError } from '../_shared/errorLogger.ts';
```

3b. In the top-level catch (~line 576), after the existing `console.error`:

```ts
  } catch (error) {
    console.error('Error in calculate-daily-stats:', error);
    await logServerError('calculate-daily-stats', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    // ...rest unchanged
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/errorLogger.ts supabase/functions/doc-aga/index.ts supabase/functions/calculate-daily-stats/index.ts
git commit -m "feat: server-side error logging for doc-aga and calculate-daily-stats"
git push
```

(No local Deno test runner is configured for Edge Functions — verification is the Lovable deploy + Task 12 smoke test.)

---

### Task 12: Deployment, end-to-end verification, governance

**Files:**
- Modify: `docs/data-relationships-map.md`
- Modify: `docs/ssot-architecture.md`
- Modify: `changelog.md`

- [ ] **Step 1: Full local verification**

Run: `npm run lint && npm run test -- --run && npm run build`
Expected: lint clean (or pre-existing warnings only), all tests pass, build succeeds.

- [ ] **Step 2: Instruct the user to deploy (message to send)**

> Two deployment actions needed:
> 1. **Run the migration:** open the [Supabase SQL Editor](https://supabase.com/dashboard/project/sxorybjlxyquxteptdyk/sql) and run the full contents of `supabase/migrations/20260807000000_error_monitoring.sql`.
> 2. **Deploy Edge Functions:** ask Lovable to redeploy `doc-aga` and `calculate-daily-stats` (they now import `_shared/errorLogger.ts`).

- [ ] **Step 3: Verify data flow (after user confirms migration ran)**

Baseline → Execute → Verify, per CLAUDE.md:
1. **Baseline:** In SQL Editor: `SELECT COUNT(*) FROM client_error_logs;` → expect 0.
2. **Execute:** In the preview app (logged in as a farmer), trigger a known error toast (e.g., submit a duplicate record). Tap **I-report** on the toast.
3. **Verify:**
   - `SELECT fingerprint, severity, message, occurrence_count, status, linked_ticket_id FROM client_error_logs ORDER BY last_seen_at DESC LIMIT 5;` → the error row exists with `occurrence_count ≥ 1` and `linked_ticket_id` set.
   - `SELECT ticket_number, subject, tags, priority FROM support_tickets WHERE 'auto-error' = ANY(tags) ORDER BY created_at DESC LIMIT 3;` → pre-filled ticket exists.
   - Admin Dashboard → Operations → Errors shows the group; status change and Create Ticket both work.
   - Offline check: DevTools → Network offline → trigger an error → tap I-report → go online → row + ticket appear after flush.
   If any check fails → report **FIX FAILED**, diagnose, iterate.

- [ ] **Step 4: Governance docs**

- `docs/data-relationships-map.md`: add `client_error_logs` + `error_report_rate` tables, the 5 RPCs, and the FK to `support_tickets`.
- `docs/ssot-architecture.md`: add the Error Monitoring data flow: `client_error_logs → log_client_error / submit_error_report / get_error_monitoring_summary → errorMonitor.ts + useErrorLogs → error toast Report button, AppErrorBoundary, ErrorMonitoringTab`.
- `changelog.md`: entry — "Error monitoring: all client/crash/silent/server errors now captured and grouped; farmers can file a pre-filled support ticket with one tap on any error toast; admins triage in the new Operations → Errors tab."

- [ ] **Step 5: Final commit**

```bash
git add docs/data-relationships-map.md docs/ssot-architecture.md changelog.md
git commit -m "docs: governance updates for error monitoring"
git push
```

---

## Task Order & Dependencies

1 (migration) → independent; 2 → 3 → 4 → 5 → 6 (client capture chain); 7 → 8 → 9 → 10 (admin chain, needs 4's exports only at 9); 11 independent of client chain; 12 last. Tasks 1, 11 can run in parallel with 2–6.
