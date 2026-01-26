import { useState, useEffect, useCallback } from 'react';
import { getAll, getAllFailed, getPendingCount, getQueueCount, type QueueItem } from '@/lib/offlineQueue';

/**
 * Queue status counts for UI display
 */
export interface QueueCounts {
  pending: number;
  processing: number;
  failed: number;
  awaiting: number;
  completed: number;
  total: number;
}

/**
 * Hook to monitor offline queue status for UI indicators
 * 
 * Provides real-time counts of queue items by status for badges, alerts, etc.
 * Refreshes on interval and exposes manual refresh.
 */
export function useQueueStatus(refreshInterval = 3000) {
  const [counts, setCounts] = useState<QueueCounts>({
    pending: 0,
    processing: 0,
    failed: 0,
    awaiting: 0,
    completed: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const items = await getAll();
      setCounts({
        pending: items.filter(i => i.status === 'pending').length,
        processing: items.filter(i => i.status === 'processing').length,
        failed: items.filter(i => i.status === 'failed').length,
        awaiting: items.filter(i => i.status === 'awaiting_confirmation').length,
        completed: items.filter(i => i.status === 'completed').length,
        total: items.length,
      });
    } catch (error) {
      console.error('[useQueueStatus] Failed to fetch queue status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [refresh, refreshInterval]);

  const hasIssues = counts.failed > 0 || counts.awaiting > 0;
  const actionableCount = counts.pending + counts.processing + counts.failed + counts.awaiting;

  return {
    counts,
    isLoading,
    refresh,
    hasIssues,
    actionableCount,
  };
}
