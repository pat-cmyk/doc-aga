// src/lib/__tests__/errorHandling.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CaptureHandle } from '@/lib/errorMonitor';

const captureErrorMock = vi.fn<[unknown, Record<string, unknown>], CaptureHandle | null>(() => null);
const submitOneTapReportMock = vi.fn();
vi.mock('@/lib/errorMonitor', () => ({
  captureError: (...args: unknown[]) => captureErrorMock(...(args as [unknown, Record<string, unknown>])),
  submitOneTapReport: (...args: unknown[]) => submitOneTapReportMock(...args),
}));

const sonnerErrorMock = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => sonnerErrorMock(...args) } }));

import {
  translateError,
  describeError,
  showErrorToast,
  showErrorToastLegacy,
  ERROR_MESSAGES,
} from '@/lib/errorHandling';

function makeHandle(fingerprint: string): CaptureHandle {
  return { fingerprint, requestReport: vi.fn() };
}

beforeEach(() => {
  captureErrorMock.mockReset();
  captureErrorMock.mockReturnValue(null);
  submitOneTapReportMock.mockReset();
  sonnerErrorMock.mockReset();
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

describe('describeError', () => {
  it('translates without any capture/logging side effect (render-path display only)', () => {
    const result = describeError(new Error('duplicate key value'));
    expect(result).toEqual(ERROR_MESSAGES.DUPLICATE);
    expect(captureErrorMock).not.toHaveBeenCalled();
  });
});

describe('showErrorToast handle attribution (regression — no global handle channel)', () => {
  it('never attaches a stale handle from an earlier legacy toast to a later sonner toast', () => {
    const handleA = makeHandle('a');
    const handleB = makeHandle('b');

    // Error A goes through the legacy (shadcn) path. captureError still
    // returns a handle for it, but showErrorToastLegacy has no mechanism to
    // surface a Report button — with the old lastHandle global, that handle
    // would linger and get incorrectly attached to the NEXT sonner toast.
    captureErrorMock.mockReturnValueOnce(handleA);
    showErrorToastLegacy(vi.fn(), new Error('some unknown thing A'));

    // Error B goes through the sonner path with its own, distinct handle.
    captureErrorMock.mockReturnValueOnce(handleB);
    showErrorToast(new Error('some unknown thing B'));

    expect(sonnerErrorMock).toHaveBeenCalledTimes(1);
    const [, opts] = sonnerErrorMock.mock.calls[0];
    opts.action.onClick();
    expect(submitOneTapReportMock).toHaveBeenCalledWith(handleB);
    expect(submitOneTapReportMock).not.toHaveBeenCalledWith(handleA);
  });

  it('early-return captures (dedup/session-cap) never leak a previous toast handle either', () => {
    const handleA = makeHandle('a');
    // First call "arms" handleA via a normal capture.
    captureErrorMock.mockReturnValueOnce(handleA);
    showErrorToast(new Error('first error'));

    // Second call: captureError returns null (e.g. session cap reached with
    // no existing handle for that fingerprint) — the toast must show no
    // action, never fall back to handleA.
    captureErrorMock.mockReturnValueOnce(null);
    showErrorToast(new Error('second error'));

    const [, secondOpts] = sonnerErrorMock.mock.calls[1];
    expect(secondOpts.action).toBeUndefined();
  });
});

describe('showErrorToast action branches', () => {
  it('includes a farmer-facing action with the correct label and duration when a handle exists', () => {
    const handle = makeHandle('x');
    captureErrorMock.mockReturnValueOnce(handle);
    showErrorToast(new Error('some unknown thing'));
    const [, opts] = sonnerErrorMock.mock.calls[0];
    expect(opts.action.label).toBe('I-report ito');
    expect(opts.duration).toBe(10000);
  });

  it('omits the action entirely when captureError returns no handle', () => {
    captureErrorMock.mockReturnValueOnce(null);
    showErrorToast(new Error('some unknown thing'));
    const [, opts] = sonnerErrorMock.mock.calls[0];
    expect(opts.action).toBeUndefined();
    expect(opts.duration).toBeUndefined();
  });

  it('invoking the action calls submitOneTapReport with that exact handle', () => {
    const handle = makeHandle('y');
    captureErrorMock.mockReturnValueOnce(handle);
    showErrorToast(new Error('some unknown thing'));
    const [, opts] = sonnerErrorMock.mock.calls[0];
    opts.action.onClick();
    expect(submitOneTapReportMock).toHaveBeenCalledWith(handle);
  });
});

describe('showErrorToast benign-category suppression', () => {
  it('suppresses the Report action for duplicate-entry errors even when a handle exists (still captured)', () => {
    const handle = makeHandle('z');
    captureErrorMock.mockReturnValueOnce(handle);
    showErrorToast(new Error('duplicate key value violates unique constraint'));
    expect(captureErrorMock).toHaveBeenCalledTimes(1);
    const [, opts] = sonnerErrorMock.mock.calls[0];
    expect(opts.action).toBeUndefined();
  });

  it('suppresses the Report action for network errors even when a handle exists (still captured)', () => {
    const handle = makeHandle('w');
    captureErrorMock.mockReturnValueOnce(handle);
    showErrorToast(new Error('failed to fetch'));
    expect(captureErrorMock).toHaveBeenCalledTimes(1);
    const [, opts] = sonnerErrorMock.mock.calls[0];
    expect(opts.action).toBeUndefined();
  });
});
