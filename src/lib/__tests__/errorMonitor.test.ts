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
