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
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
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
  /**
   * Set when the server-side error log id is already known (this row was
   * created purely to carry a one-tap report intent — see C1 fix below).
   * When present, flushQueue() skips log_client_error entirely and goes
   * straight to submit_error_report.
   */
  logId?: string;
  /** Consecutive PERMANENT log_client_error rejections for this row (see bumpLogAttemptsOrGiveUp). */
  attempts?: number;
  /** Consecutive PERMANENT submit_error_report rejections for this row (see bumpSubmitAttemptsOrGiveUp). */
  submitAttempts?: number;
}

interface ErrorMonitorDBSchema extends DBSchema {
  reportQueue: {
    key: number;
    value: QueuedReport;
  };
}

const DEDUP_WINDOW_MS = 5 * 60 * 1000;
const SESSION_CAP = 20;
const QUEUE_CAP = 50;
const DB_NAME = 'errorMonitorDB';
const STORE = 'reportQueue' as const;
const RPC_TIMEOUT_MS = 20_000;
const MAX_LOG_ATTEMPTS = 3;

// Exported for tests only — not part of the module's behavioral contract.
export { DEDUP_WINDOW_MS as _DEDUP_WINDOW_MS_FOR_TESTS };

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

/** Rejects after `ms` if `p` hasn't settled — prevents a hung RPC from wedging the flusher forever. */
function withTimeout<T>(p: PromiseLike<T>, ms = RPC_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`errorMonitor: RPC timed out after ${ms}ms`));
    }, ms);
    Promise.resolve(p).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

/** rpc() call wrapped with a timeout, normalized so callers never need a try/catch. */
async function safeRpc(
  fn: 'log_client_error' | 'submit_error_report',
  params: Record<string, unknown>,
): Promise<{ data: unknown; error: { message: string } | null }> {
  try {
    return await withTimeout(rpc(fn, params));
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}

// ─── Module state ─────────────────────────────────────────────────────
let dbPromise: Promise<IDBPDatabase<ErrorMonitorDBSchema>> | null = null;
let sessionSendCount = 0;
let flushing = false;
// R3: set when flushQueue() is called while a flush is already in progress.
// A row can land in IndexedDB *after* the running flush's getAll() snapshot
// (e.g. requestReport() persisting a report-only row) — without this, that
// row would be stranded until some unrelated future trigger. The in-progress
// flush re-runs itself once more after finishing, exactly once, to pick it up.
let flushAgain = false;
// Chains pending enqueue() calls so flushQueue() can await "everything
// captured so far has been written" without a caller having to await
// captureError() itself (it must stay synchronous for callers).
let enqueueChain: Promise<void> = Promise.resolve();
// Tracks the auto-flush each captureError() schedules after its write lands,
// so _resetForTests() (and anything else that needs a clean slate) can wait
// for that background work to fully settle instead of letting it leak into
// whatever runs next.
let pendingAutoFlush: Promise<void> = Promise.resolve();
const dedup = new Map<string, { lastQueuedAt: number; pendingCount: number }>();
const handles = new Map<string, CaptureHandle>();
const fingerprintToLogId = new Map<string, string>();

function getDb(): Promise<IDBPDatabase<ErrorMonitorDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<ErrorMonitorDBSchema>(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      },
    });
  }
  return dbPromise;
}

function showReportSuccessToast(ticketNumber: string): void {
  sonnerToast.success('Salamat!', {
    description: `Naipadala ang report (${ticketNumber}). Aayusin namin ito.`,
  });
}

// ─── Fingerprinting ───────────────────────────────────────────────────
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const UUID_SEGMENT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_SEGMENT_RE = /^[A-Za-z0-9_-]+$/;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/g;

export function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(UUID_RE, '<id>')
    // Quoted values group variants; use `[^'\s]*` (not `[^']*`) so an
    // apostrophe in a contraction ("don't") doesn't swallow the rest of the
    // sentence as one giant "quoted" span.
    .replace(/"[^"]*"|'[^'\s]*'/g, '<val>')
    .replace(/\d+/g, '#')
    .slice(0, 300);
}

/**
 * Normalizes a route for fingerprinting and storage: UUID segments become
 * `<id>`, and any other long opaque-looking segment (invite tokens, session
 * ids, etc.) becomes `<token>`. The RAW route must never be stored — routes
 * like `/invite/:token` carry a live capability.
 */
export function normalizeRoute(path: string): string {
  return path
    .split('/')
    .map((segment) => {
      if (!segment) return segment;
      if (UUID_SEGMENT_RE.test(segment)) return '<id>';
      if (segment.length > 16 && TOKEN_SEGMENT_RE.test(segment)) return '<token>';
      return segment;
    })
    .join('/');
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
  const normalizedRoute = normalizeRoute(route);
  const hash = hashString(`${errorName}|${normalizeMessage(message)}|${normalizedRoute}`);
  return `${severity}|${normalizedRoute}|${hash}`.slice(0, 128);
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
    const rawMessage =
      error instanceof Error ? error.message
      : typeof error === 'string' ? error
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
      : String(error);
    if (!rawMessage) return null;
    // Never persist a raw email address — redact before anything else touches it.
    const message = rawMessage.replace(EMAIL_RE, '<email>');

    const errorName = error instanceof Error ? error.name : 'Error';
    const rawRoute = typeof window !== 'undefined' ? window.location.pathname : '';
    const route = normalizeRoute(rawRoute);
    const fingerprint = computeFingerprint(opts.severity, errorName, message, route);

    const existingHandle = handles.get(fingerprint) ?? null;
    const entry = dedup.get(fingerprint);
    const now = Date.now();

    if (entry && now - entry.lastQueuedAt < DEDUP_WINDOW_MS) {
      // Within dedup window: count locally, flush with the next send
      entry.pendingCount += 1;
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
      // Stack traces are only meaningful (and only collected) for crashes —
      // toast/silent captures are expected user-facing errors, not bugs to
      // stack-trace, and skipping this for them matches the design spec
      // ("stack: crashes only").
      stack:
        opts.severity === 'crash'
          ? (opts.stack ?? (error instanceof Error ? error.stack : undefined))?.slice(0, 8000)
          : undefined,
      translated_title: opts.translatedTitle,
      context: {
        route,
        context: opts.context,
        online: getIsOnline(),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : '',
        mode: import.meta.env.MODE,
        occurred_at: new Date().toISOString(),
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

    const enqueued = enqueueChain.then(() => enqueue(report));
    enqueueChain = enqueued.catch(() => undefined);
    pendingAutoFlush = enqueued.then(() => {
      if (getIsOnline()) return flushQueue();
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

/** window.onerror/unhandledrejection classification: pure network hiccups are
 * noise, not crashes — log them without inflating crash counts or
 * triggering high-priority tickets. Exported for direct unit testing. */
const NETWORK_REJECTION_RE = /failed to fetch|networkerror|load failed|abort/i;
export function classifyRejectionSeverity(message: string): ClientErrorSeverity {
  return NETWORK_REJECTION_RE.test(message) ? 'silent' : 'crash';
}

// ─── Queue ────────────────────────────────────────────────────────────
async function enqueue(report: QueuedReport): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE, 'readwrite');
    const count = await tx.store.count();
    if (count >= QUEUE_CAP) {
      // R4: prefer evicting the oldest row that is NOT a farmer's pending
      // report — routine telemetry can be dropped under pressure, a report
      // intent must not be, unless literally every queued row is one (then
      // there's nothing better to evict).
      let evictId: number | undefined;
      let fallbackId: number | undefined;
      let cursor = await tx.store.openCursor();
      while (cursor) {
        if (fallbackId === undefined) fallbackId = cursor.value.id;
        if (!cursor.value.reportRequested) {
          evictId = cursor.value.id;
          break;
        }
        cursor = await cursor.continue();
      }
      const idToEvict = evictId ?? fallbackId;
      if (idToEvict !== undefined) await tx.store.delete(idToEvict);
    }
    await tx.store.add(report);
    await tx.done;
  } catch (queueError) {
    console.error('[errorMonitor] enqueue failed:', queueError);
  }
}

// R1(a): only a server response that explicitly rejects the payload counts
// as a "strike" — transport failures, timeouts, and anything else transient
// are not the farmer's (or the row's) fault and must never burn an attempt,
// or a flaky connection would silently discard queued error reports.
// Note: before migration 20260807000000_error_monitoring.sql is deployed,
// PostgREST returns PGRST202 ("Could not find the function") for these RPCs —
// that message doesn't match this pattern, so it's intentionally treated as
// transient: flushes stop and retry until the SQL runs, no data lost.
const PERMANENT_LOG_ERROR_RE = /invalid payload|not authenticated|access denied/i;
// R2: same idea for submit_error_report's permanent rejections.
const PERMANENT_SUBMIT_ERROR_RE = /not a reporter|error log not found|not authenticated/i;

function showReportFailedToast(): void {
  sonnerToast('Hindi naipadala ang report. Subukan ulit mamaya. (Could not send report.)');
}

/**
 * On a log_client_error failure: only a PERMANENT server rejection burns a
 * strike (persisted so it survives to the next flush); after MAX_LOG_ATTEMPTS
 * permanent strikes, give up and drop the row — but if it's a farmer's
 * pending report, surface a failure toast first so they aren't left with a
 * false promise. Transport failures/timeouts never increment attempts; the
 * row is left completely untouched and the flush just stops for a later retry.
 */
async function bumpLogAttemptsOrGiveUp(
  db: IDBPDatabase<ErrorMonitorDBSchema>,
  entry: QueuedReport,
  errorMessage: string,
): Promise<'stopped' | 'dropped'> {
  if (!PERMANENT_LOG_ERROR_RE.test(errorMessage)) {
    console.error('[errorMonitor] flush stopped (transport, no strike):', errorMessage);
    return 'stopped';
  }

  const attempts = (entry.attempts ?? 0) + 1;
  if (attempts >= MAX_LOG_ATTEMPTS) {
    console.error(`[errorMonitor] giving up on entry after ${attempts} attempts:`, errorMessage);
    // Re-read fresh — a Report tap may have landed on this row since we
    // snapshotted it at the top of the flush loop.
    const fresh = entry.id !== undefined ? await db.get(STORE, entry.id) : undefined;
    if (fresh?.reportRequested ?? entry.reportRequested) showReportFailedToast();
    if (entry.id !== undefined) await db.delete(STORE, entry.id);
    return 'dropped';
  }
  if (entry.id !== undefined) await db.put(STORE, { ...entry, attempts });
  console.error('[errorMonitor] flush stopped:', errorMessage);
  return 'stopped';
}

/**
 * Same strike policy as bumpLogAttemptsOrGiveUp, for submit_error_report.
 * Keeps the row (with its now-known logId) across transport failures so the
 * next flush retries the submit directly; drops it after MAX_LOG_ATTEMPTS
 * permanent rejections, with a failure toast since the row is always a
 * farmer's pending report by construction (wantsReport was true to get here).
 */
async function bumpSubmitAttemptsOrGiveUp(
  db: IDBPDatabase<ErrorMonitorDBSchema>,
  entry: QueuedReport,
  logId: string,
  note: string | undefined,
  errorMessage: string,
): Promise<void> {
  if (entry.id === undefined) return;
  if (!PERMANENT_SUBMIT_ERROR_RE.test(errorMessage)) {
    console.error('[errorMonitor] report submit failed (transport, will retry):', errorMessage);
    await db.put(STORE, { ...entry, logId, reportRequested: true, userNote: note });
    return;
  }

  const submitAttempts = (entry.submitAttempts ?? 0) + 1;
  if (submitAttempts >= MAX_LOG_ATTEMPTS) {
    console.error(
      `[errorMonitor] giving up on report submit after ${submitAttempts} attempts:`,
      errorMessage,
    );
    showReportFailedToast();
    await db.delete(STORE, entry.id);
    return;
  }
  console.error('[errorMonitor] report submit failed, will retry:', errorMessage);
  await db.put(STORE, {
    ...entry,
    logId,
    reportRequested: true,
    userNote: note,
    submitAttempts,
  });
}

export async function flushQueue(): Promise<void> {
  if (flushing) {
    // R3: don't run concurrently — but remember a re-run is owed, since new
    // work (e.g. a report-only row from requestReport()) may land in
    // IndexedDB after this in-progress flush already took its getAll()
    // snapshot, and would otherwise be stranded until some unrelated future
    // trigger fires.
    flushAgain = true;
    return;
  }
  if (!getIsOnline()) return;
  flushing = true;
  try {
    // Wait for any in-flight captureError() writes so we don't miss entries
    // that were queued microtasks ago but haven't hit IndexedDB yet.
    await enqueueChain;
    const db = await getDb();
    const entries = await db.getAll(STORE);
    for (const entry of entries) {
      // C1: a report-only row already knows its server-side log id (created
      // by requestReport() when the original row had already been flushed).
      // Skip log_client_error entirely and go straight to submit.
      let logId: string | null = entry.logId ?? null;

      if (!logId) {
        // R5: if this call times out on the client side AFTER the server
        // already processed it (slow response, not a real failure), the
        // retry below will re-log the same fingerprint with the same
        // occurrence_count on the next flush — occurrence_count is an
        // advisory triage signal, not an exact count, and may double-count
        // in that rare timed-out-but-actually-succeeded case.
        const { data, error } = await safeRpc('log_client_error', {
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
          // R1: only a permanent server rejection burns a strike; transport
          // failures/timeouts stop the flush without touching the row.
          const outcome = await bumpLogAttemptsOrGiveUp(db, entry, error.message);
          if (outcome === 'stopped') return;
          continue; // gave up on this poison row — keep flushing the rest
        }
        logId = typeof data === 'string' ? data : null;
        if (!logId) {
          // Server-side rate limit (hourly window). R1(b): never silently
          // discard a farmer's pending report just because of a rate limit
          // that resets on its own — keep it for a later flush. Plain,
          // non-report rows aren't worth retrying indefinitely for this.
          const fresh = entry.id !== undefined ? await db.get(STORE, entry.id) : undefined;
          if (fresh?.reportRequested ?? entry.reportRequested) continue;
          if (entry.id !== undefined) await db.delete(STORE, entry.id);
          continue;
        }
        fingerprintToLogId.set(entry.fingerprint, logId);
      }

      // C2: re-read the row fresh by id — a Report tap that landed while
      // log_client_error was in flight updates reportRequested/userNote in
      // IndexedDB, but our `entry` here is a stale snapshot from getAll()
      // above. Trust the fresh copy so that update isn't clobbered.
      const freshEntry = entry.id !== undefined ? await db.get(STORE, entry.id) : undefined;
      const wantsReport = freshEntry?.reportRequested ?? entry.reportRequested;
      const note = freshEntry?.userNote ?? entry.userNote;

      if (wantsReport) {
        const { data: ticket, error: submitError } = await safeRpc('submit_error_report', {
          _error_log_id: logId,
          _user_note: note ?? null,
        });
        if (submitError) {
          // R2: same strike policy as the log path — permanent rejections
          // count toward a cap (with a failure toast before dropping),
          // transport failures/timeouts just preserve the row for a retry.
          await bumpSubmitAttemptsOrGiveUp(db, freshEntry ?? entry, logId, note, submitError.message);
          continue;
        }
        if (typeof ticket === 'string') {
          showReportSuccessToast(ticket);
        }
      }

      if (entry.id !== undefined) await db.delete(STORE, entry.id);
    }
  } catch (flushError) {
    console.error('[errorMonitor] flush failed:', flushError);
  } finally {
    flushing = false;
    if (flushAgain) {
      flushAgain = false;
      // AWAITED (not fire-and-forget): a caller's `await flushQueue()` must
      // see the *complete* picture, including anything a concurrent trigger
      // stranded mid-flush. A fire-and-forget re-run here would leave
      // untracked background work that can bleed into a later, unrelated
      // flushQueue() call (or even the next test) with no way to wait for
      // it — exactly the kind of stranding this mechanism exists to prevent.
      await flushQueue();
    }
  }
}

// ─── One-tap report ───────────────────────────────────────────────────
async function requestReport(fingerprint: string, note?: string): Promise<ReportResult> {
  try {
    // Ensure the capture that produced this handle has finished writing to
    // IndexedDB before we look for it (captureError() returns synchronously).
    await enqueueChain;
    const logId = fingerprintToLogId.get(fingerprint);
    if (logId && getIsOnline()) {
      const { data, error } = await safeRpc('submit_error_report', {
        _error_log_id: logId,
        _user_note: note ?? null,
      });
      if (!error && typeof data === 'string') {
        return { status: 'submitted', ticketNumber: data };
      }
      // Direct submit failed (offline mid-call, network hiccup, timeout) —
      // fall through and persist the report intent so a later flush retries.
    }

    // Try to mark an existing, not-yet-flushed queue row for this fingerprint.
    const db = await getDb();
    const tx = db.transaction(STORE, 'readwrite');
    let marked = false;
    let cursor = await tx.store.openCursor();
    while (cursor) {
      const value = cursor.value;
      if (value.fingerprint === fingerprint) {
        await cursor.update({ ...value, reportRequested: true, userNote: note });
        marked = true;
      }
      cursor = await cursor.continue();
    }
    await tx.done;

    if (!marked) {
      if (!logId) return { status: 'failed' };
      // C1: the original row is already gone (it was flushed and logged),
      // but we know the server-side log id — persist a report-only row so
      // flushQueue() can submit_error_report directly, skipping
      // log_client_error, instead of silently losing the report intent.
      const severity = (fingerprint.split('|')[0] as ClientErrorSeverity | undefined) ?? 'silent';
      await enqueue({
        fingerprint,
        logId,
        severity,
        message: '(report-only)',
        context: {},
        occurrence_count: 0,
        reportRequested: true,
        userNote: note,
      });
    }

    if (getIsOnline()) void flushQueue();
    return { status: 'queued' };
  } catch (reportError) {
    console.error('[errorMonitor] requestReport failed:', reportError);
    return { status: 'failed' };
  }
}

/** UI entry point for the toast/crash-screen Report button. Owns feedback toasts. */
export async function submitOneTapReport(handle: CaptureHandle): Promise<void> {
  try {
    const result = await handle.requestReport();
    if (result.status === 'submitted') {
      showReportSuccessToast(result.ticketNumber);
    } else if (result.status === 'queued') {
      sonnerToast.success('Salamat!', {
        description: 'Ipapadala ang report kapag may internet na. (Will send when back online.)',
      });
    } else {
      showReportFailedToast();
    }
  } catch (err) {
    console.error('[errorMonitor] submitOneTapReport failed:', err);
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
    const msg = reason instanceof Error ? reason.message : String(reason ?? '');
    if (msg.includes('Failed to fetch dynamically imported module')) return;
    captureError(reason, { severity: classifyRejectionSeverity(msg), context: 'unhandledrejection' });
  });

  subscribeOnlineStatus((online) => {
    if (online) void flushQueue();
  });
  void flushQueue();
}

// ─── Test helpers ─────────────────────────────────────────────────────
export async function _resetForTests(): Promise<void> {
  // Drain whatever the previous test's captureError() calls scheduled in the
  // background — otherwise a stray flush can resolve mid-way through the
  // next test and race its assertions.
  await enqueueChain.catch(() => undefined);
  await pendingAutoFlush.catch(() => undefined);
  sessionSendCount = 0;
  flushing = false;
  flushAgain = false;
  enqueueChain = Promise.resolve();
  pendingAutoFlush = Promise.resolve();
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

/**
 * R4: resets only the session-scoped capture counters (SESSION_CAP dedup
 * bookkeeping), leaving IndexedDB and fingerprintToLogId untouched. Lets a
 * test push more than SESSION_CAP distinct errors into the queue across
 * several "sessions" to exercise QUEUE_CAP eviction, which SESSION_CAP would
 * otherwise make unreachable in a single test.
 */
export function _resetSessionCountersForTests(): void {
  sessionSendCount = 0;
  dedup.clear();
  handles.clear();
}

/** R4: test-only peek at the raw queue contents, waiting for pending writes first. */
export async function _peekQueueForTests(): Promise<
  Array<{ fingerprint: string; reportRequested: boolean }>
> {
  await enqueueChain.catch(() => undefined);
  const db = await getDb();
  const rows = await db.getAll(STORE);
  return rows.map((r) => ({ fingerprint: r.fingerprint, reportRequested: r.reportRequested }));
}
