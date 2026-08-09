import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppErrorBoundary } from '../AppErrorBoundary';
import { captureError, type CaptureHandle, type ReportResult } from '@/lib/errorMonitor';

vi.mock('@/lib/errorMonitor', () => ({
  captureError: vi.fn(),
}));

const requestReportMock = vi.fn<() => Promise<ReportResult>>();

const fakeHandle: CaptureHandle = {
  fingerprint: 'crash|/|abc123',
  requestReport: requestReportMock,
};

function Bomb(): JSX.Element {
  throw new Error('kaboom');
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(captureError).mockReturnValue(fakeHandle);
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

  it('FIX4: calls handle.requestReport() directly (not submitOneTapReport) and shows "Nai-report na" only once it resolves submitted', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    requestReportMock.mockResolvedValue({ status: 'submitted', ticketNumber: 'T-1' });

    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    );

    const reportButton = screen.getByRole('button', { name: /i-report/i });
    fireEvent.click(reportButton);

    await waitFor(() => {
      expect(requestReportMock).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('Nai-report na')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nai-report na/i })).toBeDisabled();
  });

  it('FIX4: shows a disabled "queued" state and never claims success when the report is only queued', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    requestReportMock.mockResolvedValue({ status: 'queued' });

    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: /i-report/i }));

    const queuedButton = await screen.findByRole('button', {
      name: /naitala.*ipapadala kapag online/i,
    });
    expect(queuedButton).toBeDisabled();
    expect(screen.queryByText('Nai-report na')).not.toBeInTheDocument();
  });

  it('FIX4: on failure, keeps the button enabled with a retry label and shows an inline (non-toast) failure line', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    requestReportMock.mockResolvedValue({ status: 'failed' });

    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: /i-report/i }));

    const retryButton = await screen.findByRole('button', { name: /subukan ulit i-report/i });
    expect(retryButton).not.toBeDisabled();
    expect(screen.getByText(/hindi naipadala/i)).toBeInTheDocument();

    // Retrying re-invokes requestReport rather than getting stuck.
    requestReportMock.mockResolvedValue({ status: 'submitted', ticketNumber: 'T-2' });
    fireEvent.click(retryButton);
    await waitFor(() => {
      expect(requestReportMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('Nai-report na')).toBeInTheDocument();
  });
});
