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
