import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppErrorBoundary } from '../AppErrorBoundary';
import { captureError, submitOneTapReport, type CaptureHandle } from '@/lib/errorMonitor';

vi.mock('@/lib/errorMonitor', () => ({
  captureError: vi.fn(),
  submitOneTapReport: vi.fn(),
}));

const fakeHandle: CaptureHandle = {
  fingerprint: 'crash|/|abc123',
  requestReport: vi.fn().mockResolvedValue({ status: 'submitted', ticketNumber: 'T-1' }),
};

function Bomb(): JSX.Element {
  throw new Error('kaboom');
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(captureError).mockReturnValue(fakeHandle);
    vi.mocked(submitOneTapReport).mockResolvedValue(undefined);
  });

  it('renders children when there is no error', () => {
    render(
      <AppErrorBoundary>
        <div>All good</div>
      </AppErrorBoundary>,
    );

    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('shows the Taglish recovery screen and reports a crash when a child throws', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    );

    expect(screen.getByText('May nangyaring problema')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /i-report/i })).toBeInTheDocument();
    expect(captureError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ severity: 'crash', context: 'render' }),
    );

    consoleErrorSpy.mockRestore();
  });

  it('calls submitOneTapReport with the capture handle and flips to reported state on click', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    );

    const reportButton = screen.getByRole('button', { name: /i-report/i });
    fireEvent.click(reportButton);

    await waitFor(() => {
      expect(submitOneTapReport).toHaveBeenCalledWith(fakeHandle);
    });

    expect(await screen.findByText('Nai-report na')).toBeInTheDocument();
  });
});
