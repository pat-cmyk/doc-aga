/**
 * usePendingAudioCount Hook
 * 
 * Provides real-time count of pending offline audio recordings.
 * Updates periodically and on online status changes.
 */

import { useState, useEffect, useCallback } from 'react';
import { getPendingAudioCount, getAudioStorageStats } from '@/lib/offlineAudioQueue';
import { useOnlineStatus } from './useOnlineStatus';

export interface PendingAudioStats {
  /** Number of pending audio recordings */
  pendingCount: number;
  /** Number of failed audio recordings */
  failedCount: number;
  /** Total storage used in KB */
  totalSizeKB: number;
}

/**
 * Hook to track pending offline audio count
 * 
 * @param refreshIntervalMs - How often to refresh count (default: 5000ms)
 * @returns Object with pendingCount and refresh function
 */
export function usePendingAudioCount(refreshIntervalMs: number = 5000): {
  stats: PendingAudioStats;
  refresh: () => Promise<void>;
  isLoading: boolean;
} {
  const isOnline = useOnlineStatus();
  const [stats, setStats] = useState<PendingAudioStats>({
    pendingCount: 0,
    failedCount: 0,
    totalSizeKB: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  
  const refresh = useCallback(async () => {
    try {
      const storageStats = await getAudioStorageStats();
      setStats({
        pendingCount: storageStats.pendingCount,
        failedCount: storageStats.failedCount,
        totalSizeKB: storageStats.totalSizeKB,
      });
    } catch (error) {
      console.warn('[usePendingAudioCount] Failed to fetch stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);
  
  // Refresh on online status change
  useEffect(() => {
    refresh();
  }, [isOnline, refresh]);
  
  // Periodic refresh
  useEffect(() => {
    const interval = setInterval(refresh, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [refresh, refreshIntervalMs]);
  
  return { stats, refresh, isLoading };
}

export default usePendingAudioCount;
