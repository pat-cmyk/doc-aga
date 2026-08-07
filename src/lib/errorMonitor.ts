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
  const hash = hashString(`${errorName}|${normalizeMessage(message)}|${route}`);
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

    const enqueued = enqueueChain.then(() => enqueue(report));
    enqueueChain = enqueued;
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
    // Wait for any in-flight captureError() writes so we don't miss entries
    // that were queued microtasks ago but haven't hit IndexedDB yet.
    await enqueueChain;
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
    // Ensure the capture that produced this handle has finished writing to
    // IndexedDB before we look for it (captureError() returns synchronously).
    await enqueueChain;
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
  // Drain whatever the previous test's captureError() calls scheduled in the
  // background — otherwise a stray flush can resolve mid-way through the
  // next test and race its assertions.
  await enqueueChain.catch(() => undefined);
  await pendingAutoFlush.catch(() => undefined);
  sessionSendCount = 0;
  flushing = false;
  lastHandle = null;
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
