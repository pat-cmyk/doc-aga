/**
 * useOfflineAudioSync Hook
 * 
 * Automatically syncs queued audio recordings when connectivity is restored.
 * Integrates with the service worker bridge for background sync support.
 */

import { useEffect, useRef } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { syncOfflineAudio } from '@/lib/offlineAudioSyncProcessor';
import { getPendingAudioCount, cleanupExpired } from '@/lib/offlineAudioQueue';

/**
 * Hook to automatically sync offline audio when coming online
 * 
 * @param enabled - Whether to enable auto-sync (default: true)
 */
export function useOfflineAudioSync(enabled: boolean = true): void {
  const isOnline = useOnlineStatus();
  const wasOfflineRef = useRef(!navigator.onLine);
  const syncInProgressRef = useRef(false);
  
  useEffect(() => {
    if (!enabled) return;
    
    const triggerSync = async () => {
      // Prevent concurrent sync attempts
      if (syncInProgressRef.current) {
        console.log('[useOfflineAudioSync] Sync already in progress, skipping');
        return;
      }
      
      // Check if there are pending items
      const pendingCount = await getPendingAudioCount();
      if (pendingCount === 0) {
        console.log('[useOfflineAudioSync] No pending audio to sync');
        return;
      }
      
      console.log(`[useOfflineAudioSync] Syncing ${pendingCount} pending audio recordings...`);
      
      syncInProgressRef.current = true;
      try {
        await syncOfflineAudio();
      } finally {
        syncInProgressRef.current = false;
      }
    };
    
    // Sync when coming back online
    if (isOnline && wasOfflineRef.current) {
      console.log('[useOfflineAudioSync] Came back online, triggering audio sync');
      // Small delay to ensure network is stable
      setTimeout(triggerSync, 2000);
    }
    
    wasOfflineRef.current = !isOnline;
  }, [isOnline, enabled]);
  
  // Cleanup expired items on mount
  useEffect(() => {
    if (!enabled) return;
    
    cleanupExpired().catch(err => {
      console.warn('[useOfflineAudioSync] Failed to cleanup expired items:', err);
    });
  }, [enabled]);
}

export default useOfflineAudioSync;
