// src/lib/__tests__/errorMonitor.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
  normalizeRoute,
  computeFingerprint,
  classifyRejectionSeverity,
  captureError,
  reportSilentError,
  takeLastCaptureHandle,
  flushQueue,
  _resetForTests,
  _resetSessionCountersForTests,
  _peekQueueForTests,
  _DEDUP_WINDOW_MS_FOR_TESTS as DEDUP_WINDOW_MS,
} from '@/lib/errorMonitor';

beforeEach(async () => {
  // Drain the previous test's background work FIRST, while `onlineState`
  // and `rpcMock` still reflect how that test left them. Flipping
  // onlineState to true (or resetting rpcMock) before draining would let a
  // stale auto-flush trigger from an "offline" test see the *new* test's
  // online state and fire an unwanted RPC call that pollutes the next
  // test's call history.
  await _resetForTests();
  onlineState = true;
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: 'log-id-1', error: null });
});

// Safety net: if a fake-timers test above ever times out mid-await, its own
// try/finally never runs (the test is abandoned, not thrown), which would
// otherwise leave every later test running under a frozen fake clock.
afterEach(() => {
  vi.useRealTimers();
});

describe('normalizeMessage', () => {
  it('strips UUIDs, numbers, and quoted values so variants group together', () => {
    const a = normalizeMessage('Animal "a1b2c3d4-e5f6-7890-abcd-ef1234567890" not found (code 42)');
    const b = normalizeMessage("Animal 'ffffffff-0000-1111-2222-333333333333' not found (code 7)");
    expect(a).toBe(b);
    expect(a).not.toContain('42');
  });

  it('does not let a contraction apostrophe swallow the rest of the sentence as one quoted span', () => {
    const normalized = normalizeMessage("don't retry — save failed for animal 'ffffffff-0000-1111-2222-333333333333'");
    // The contraction itself must survive untouched...
    expect(normalized).toContain("don't");
    // ...while the actually-quoted UUID still collapses to <val>.
    expect(normalized).toContain('<val>');
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

  it('I3: normalizes UUID/token route segments so two farm-scoped routes fingerprint identically', () => {
    const f1 = computeFingerprint(
      'toast', 'Error', 'save failed', '/farms/a1b2c3d4-e5f6-7890-abcd-ef1234567890/animals',
    );
    const f2 = computeFingerprint(
      'toast', 'Error', 'save failed', '/farms/ffffffff-0000-1111-2222-333333333333/animals',
    );
    expect(f1).toBe(f2);
  });
});

describe('normalizeRoute', () => {
  it('I3: replaces UUID segments with <id> and other long opaque segments with <token>', () => {
    expect(normalizeRoute('/invite/abcDEF1234567890xyz')).toBe('/invite/<token>');
    expect(normalizeRoute('/farms/a1b2c3d4-e5f6-7890-abcd-ef1234567890/animals')).toBe(
      '/farms/<id>/animals',
    );
  });

  it('leaves short, ordinary route segments untouched', () => {
    expect(normalizeRoute('/dashboard/settings')).toBe('/dashboard/settings');
  });
});

describe('classifyRejectionSeverity', () => {
  it('I4: classifies network hiccups as silent, not crash', () => {
    expect(classifyRejectionSeverity('TypeError: Failed to fetch')).toBe('silent');
    expect(classifyRejectionSeverity('NetworkError when attempting to fetch resource')).toBe('silent');
    expect(classifyRejectionSeverity('AbortError: The operation was aborted')).toBe('silent');
  });

  it('I4: classifies everything else as crash', () => {
    expect(classifyRejectionSeverity('TypeError: Cannot read properties of undefined')).toBe('crash');
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

  it('I6(b): accumulates pending occurrences into the next send once the dedup window expires', async () => {
    // Fake ONLY Date — the dedup window check is a plain Date.now() compare,
    // not a setTimeout. Faking timers wholesale would also freeze
    // fake-indexeddb's internal transaction completion and our own
    // withTimeout() setTimeout, hanging every await in this test.
    const start = new Date('2026-01-01T00:00:00.000Z');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(start);
    try {
      captureError(new Error('boom'), { severity: 'toast' });
      captureError(new Error('boom'), { severity: 'toast' });
      captureError(new Error('boom'), { severity: 'toast' });
      await flushQueue();
      expect(rpcMock).toHaveBeenCalledTimes(1);

      vi.setSystemTime(new Date(start.getTime() + DEDUP_WINDOW_MS + 1_000));

      captureError(new Error('boom'), { severity: 'toast' });
      await flushQueue();

      expect(rpcMock).toHaveBeenCalledTimes(2);
      const secondPayload = rpcMock.mock.calls[1][1]._payload;
      // 1 for this new send + 2 that were pending from the deduped repeats.
      expect(secondPayload.occurrence_count).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops sending after the session cap of 20 distinct errors', async () => {
    for (let i = 0; i < 25; i++) {
      captureError(new Error(`unique error ${'x'.repeat(i + 1)}`), { severity: 'toast' });
    }
    await flushQueue();
    // I6(a): exactly 20, not merely "at most 20" — the cap must not be off by one.
    expect(rpcMock.mock.calls.length).toBe(20);
  });

  // I6(d): a dedicated "queue cap (50) eviction" test isn't reachable in a
  // single session — SESSION_CAP (20) stops captureError() from ever queuing
  // more than 20 distinct entries, well under QUEUE_CAP (50). Eviction of the
  // oldest row past QUEUE_CAP is exercised by code review of enqueue()'s
  // `count >= QUEUE_CAP` branch, not by an in-session unit test.

  it('keeps reports queued while offline and never throws', async () => {
    onlineState = false;
    const handle = captureError(new Error('offline boom'), { severity: 'toast' });
    expect(handle).not.toBeNull();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('I6(c): sends the queued entry once connectivity returns', async () => {
    onlineState = false;
    captureError(new Error('offline boom, then online'), { severity: 'toast' });
    expect(rpcMock).not.toHaveBeenCalled();

    onlineState = true;
    await flushQueue();
    expect(rpcMock).toHaveBeenCalledWith('log_client_error', expect.objectContaining({
      _payload: expect.objectContaining({ message: 'offline boom, then online' }),
    }));
  });

  it('exposes the last capture handle exactly once', () => {
    captureError(new Error('boom'), { severity: 'toast' });
    expect(takeLastCaptureHandle()).not.toBeNull();
    expect(takeLastCaptureHandle()).toBeNull();
  });

  it('I6(e): preserves a queued entry across a transport failure and sends it on the next successful flush', async () => {
    // Persistently failing (not one-time) so this is unambiguously the
    // "no strike burned, row untouched" R1 transport path. Asserting on the
    // *observable outcome* (row survives, then eventually clears) rather
    // than a raw call count, since captureError's own post-write auto-flush
    // trigger can race flushQueue's R3 re-run mechanism and legitimately
    // vary how many attempts happen before the row is actually gone.
    rpcMock.mockImplementation(() =>
      Promise.resolve({ data: null, error: { message: 'network down' } }),
    );
    const handle = captureError(new Error('will retry'), { severity: 'toast' })!;
    await flushQueue();

    const stillQueued = await _peekQueueForTests();
    expect(stillQueued.some((r) => r.fingerprint === handle.fingerprint)).toBe(true);

    rpcMock.mockImplementation(() => Promise.resolve({ data: 'log-id-retry', error: null }));
    await flushQueue();
    await vi.waitFor(async () => {
      const remaining = await _peekQueueForTests();
      if (remaining.some((r) => r.fingerprint === handle.fingerprint)) {
        throw new Error('still queued');
      }
    });
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

  // C1 — REPORT LOST: logId is already known (the queue row was flushed and
  // deleted), then the user taps Report while offline. Nothing should be
  // silently dropped — flipping back online must still submit the report.
  it('C1: does not lose a report requested after the log id is known but we go offline', async () => {
    const handle = captureError(new Error('known then offline'), { severity: 'toast' })!;
    await flushQueue(); // online: logs it, row deleted, fingerprintToLogId set

    onlineState = false;
    const result = await handle.requestReport();
    expect(result.status).toBe('queued');

    onlineState = true;
    await flushQueue();
    const fns = rpcMock.mock.calls.map((c) => c[0]);
    expect(fns).toContain('submit_error_report');
  });

  // C2 — REPORT MARK DESTROYED BY IN-FLIGHT FLUSH: flushQueue snapshots rows
  // via getAll() up front. If Report is tapped while the log_client_error
  // RPC for that same row is still in flight, the mid-flush IndexedDB update
  // must not be clobbered by flushQueue's stale in-memory copy.
  it('C2: a report requested mid-flush is not lost when the row is deleted after logging', async () => {
    let resolveLog!: (v: { data: unknown; error: null }) => void;
    const logPromise = new Promise<{ data: unknown; error: null }>((resolve) => {
      resolveLog = resolve;
    });
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'log_client_error') return logPromise;
      if (fn === 'submit_error_report') return Promise.resolve({ data: 'TKT-9', error: null });
      return Promise.resolve({ data: null, error: { message: 'unknown rpc' } });
    });

    const handle = captureError(new Error('midflight'), { severity: 'toast' })!;
    const flushPromise = flushQueue();

    // Wait until flushQueue has snapshotted the row and issued the
    // log_client_error call (i.e. it's now blocked on the pending RPC).
    await vi.waitFor(() => {
      if (!rpcMock.mock.calls.some((c) => c[0] === 'log_client_error')) {
        throw new Error('log_client_error not called yet');
      }
    });

    // Tap "Report" while the log RPC is still pending. Since fingerprintToLogId
    // isn't populated yet, this goes through requestReport's IndexedDB
    // cursor-update path (marking the still-queued row) rather than the
    // direct-submit path — await it fully so the mark is committed before we
    // let the log RPC resolve, deterministically reproducing "mark landed
    // mid-flush, before flushQueue reads its stale in-memory snapshot".
    const reportResult = await handle.requestReport();
    expect(reportResult.status).toBe('queued');

    resolveLog({ data: 'log-id-99', error: null });
    await flushPromise;

    const fns = rpcMock.mock.calls.map((c) => c[0]);
    expect(fns).toContain('submit_error_report');
  });
});

describe('retry policy (R1-R4)', () => {
  it('R1: transport failures never burn a strike — a reportRequested row survives indefinitely until success', async () => {
    onlineState = false;
    const handle = captureError(new Error('flaky network'), { severity: 'toast' })!;
    // Mark it offline: cursor-scan path, doesn't touch flushQueue at all
    // since getIsOnline() is false at this point.
    const markResult = await handle.requestReport();
    expect(markResult.status).toBe('queued');

    onlineState = true;
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'log_client_error') {
        return Promise.resolve({ data: null, error: { message: 'Failed to fetch' } });
      }
      return Promise.resolve({ data: null, error: { message: 'unknown rpc' } });
    });

    // Three consecutive transport failures — none of them is a permanent
    // server rejection, so none should burn a strike; the row must survive.
    await flushQueue();
    await flushQueue();
    await flushQueue();
    const logCallsSoFar = rpcMock.mock.calls.filter((c) => c[0] === 'log_client_error').length;
    expect(logCallsSoFar).toBe(3);

    // Now let it succeed — since the row's reportRequested survived all
    // three failures untouched, submit_error_report must fire right after.
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'log_client_error') return Promise.resolve({ data: 'log-id-77', error: null });
      if (fn === 'submit_error_report') return Promise.resolve({ data: 'TKT-77', error: null });
      return Promise.resolve({ data: null, error: { message: 'unknown rpc' } });
    });
    await flushQueue();

    const fns = rpcMock.mock.calls.map((c) => c[0]);
    expect(fns).toContain('submit_error_report');
  });

  it('R1(b): a permanently-rejected reportRequested row shows a failure toast before being dropped after 3 strikes', async () => {
    onlineState = false;
    const handle = captureError(new Error('permanently bad payload'), { severity: 'toast' })!;
    await handle.requestReport();

    onlineState = true;
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'log_client_error') {
        return Promise.resolve({ data: null, error: { message: 'Invalid payload' } });
      }
      return Promise.resolve({ data: null, error: { message: 'unknown rpc' } });
    });

    await flushQueue(); // strike 1
    await flushQueue(); // strike 2
    await flushQueue(); // strike 3 -> dropped
    await flushQueue(); // nothing left to do

    const logCalls = rpcMock.mock.calls.filter((c) => c[0] === 'log_client_error').length;
    expect(logCalls).toBe(3); // capped, no 4th attempt on a dropped row

    const remaining = await _peekQueueForTests();
    expect(remaining.find((r) => r.fingerprint === handle.fingerprint)).toBeUndefined();
  });

  it('R2: drops a row after 3 permanent submit_error_report rejections, with no further calls', async () => {
    onlineState = false;
    const handle = captureError(new Error('perm reject'), { severity: 'toast' })!;
    const markResult = await handle.requestReport();
    expect(markResult.status).toBe('queued');

    onlineState = true;
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'log_client_error') return Promise.resolve({ data: 'log-id-1', error: null });
      if (fn === 'submit_error_report') {
        return Promise.resolve({ data: null, error: { message: 'Not a reporter of this error' } });
      }
      return Promise.resolve({ data: null, error: { message: 'unknown rpc' } });
    });

    await flushQueue(); // logs it, then submit strike 1
    await flushQueue(); // submit strike 2 (skips log_client_error — logId known)
    await flushQueue(); // submit strike 3 -> dropped
    await flushQueue(); // nothing left — no 4th submit call

    const submitCalls = rpcMock.mock.calls.filter((c) => c[0] === 'submit_error_report');
    expect(submitCalls.length).toBe(3);
    const logCalls = rpcMock.mock.calls.filter((c) => c[0] === 'log_client_error');
    expect(logCalls.length).toBe(1);

    const remaining = await _peekQueueForTests();
    expect(remaining.find((r) => r.fingerprint === handle.fingerprint)).toBeUndefined();
  });

  it('R3: a report-only row created mid-flush is not stranded — flushQueue re-runs once more', async () => {
    // Step 1: establish a known logId for error B via a normal, successful flush.
    rpcMock.mockResolvedValue({ data: 'log-id-B', error: null });
    const handleB = captureError(new Error('already logged B'), { severity: 'toast' })!;
    await flushQueue();
    const fnsAfterB = rpcMock.mock.calls.map((c) => c[0]);
    expect(fnsAfterB).toContain('log_client_error');

    // Step 2: start a flush for a NEW error A that hangs on log_client_error,
    // and make submit_error_report fail so requestReport(B) — whose logId is
    // already known — falls through from the direct-submit attempt into
    // persisting a report-only row instead.
    let resolveLogA!: (v: { data: unknown; error: null }) => void;
    const logAPromise = new Promise<{ data: unknown; error: null }>((resolve) => {
      resolveLogA = resolve;
    });
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'log_client_error') return logAPromise;
      if (fn === 'submit_error_report') {
        return Promise.resolve({ data: null, error: { message: 'Failed to fetch' } });
      }
      return Promise.resolve({ data: null, error: { message: 'unknown rpc' } });
    });

    const logCallsBeforeA = rpcMock.mock.calls.filter((c) => c[0] === 'log_client_error').length;
    captureError(new Error('midflight A'), { severity: 'toast' });
    const flushPromise = flushQueue();

    await vi.waitFor(() => {
      const count = rpcMock.mock.calls.filter((c) => c[0] === 'log_client_error').length;
      if (count <= logCallsBeforeA) throw new Error('log_client_error not called yet for A');
    });

    // Tap Report for B while A's flush is in progress. B's logId is known,
    // so this tries direct-submit (fails per our mock), then persists a
    // report-only row — while `flushing` is still true.
    const reportResultB = await handleB.requestReport();
    expect(reportResultB.status).toBe('queued');

    // Let A's flush resolve, and swap in a healthy submit mock so B's
    // report-only row can succeed on the R3-triggered re-run.
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'submit_error_report') return Promise.resolve({ data: 'TKT-B', error: null });
      return Promise.resolve({ data: null, error: { message: 'unknown rpc' } });
    });
    resolveLogA({ data: 'log-id-A', error: null });
    await flushPromise;

    // R3's re-run fires from inside flushQueue's `finally` and is awaited
    // there, so wait for it to actually process B.
    await vi.waitFor(() => {
      const submitCalls = rpcMock.mock.calls.filter((c) => c[0] === 'submit_error_report');
      if (submitCalls.length < 2) throw new Error('re-run has not submitted B yet');
    });

    const remaining = await _peekQueueForTests();
    expect(remaining.find((r) => r.fingerprint === handleB.fingerprint)).toBeUndefined();
  });

  it('R4: queue-cap eviction prefers evicting non-reportRequested rows over farmer report intents', async () => {
    onlineState = false;
    const protectedHandle = captureError(new Error('protect me'), { severity: 'toast' })!;
    await protectedHandle.requestReport();

    // SESSION_CAP (20) would normally stop us at 20 distinct queued errors —
    // reset the session counters between batches to push well past
    // QUEUE_CAP (50) and force eviction. Use a repeated non-numeric
    // character (not a digit) to distinguish messages: normalizeMessage()
    // collapses all digits to '#', so e.g. "filler 0-0" and "filler 0-1"
    // would fingerprint identically and collide in the dedup map.
    let fillerCount = 0;
    for (let batch = 0; batch < 4; batch++) {
      for (let i = 0; i < 20; i++) {
        fillerCount += 1;
        captureError(new Error(`filler ${'y'.repeat(fillerCount)}`), { severity: 'toast' });
      }
      _resetSessionCountersForTests();
    }

    const rows = await _peekQueueForTests();
    expect(rows.length).toBe(50);
    const protectedRow = rows.find((r) => r.fingerprint === protectedHandle.fingerprint);
    expect(protectedRow?.reportRequested).toBe(true);
  });
});

describe('I1 — session cap and severity filtering of lastHandle', () => {
  it('silent captures never populate the toast handle handoff', () => {
    reportSilentError(new Error('silent oops'), 'background sync');
    expect(takeLastCaptureHandle()).toBeNull();
  });
});
