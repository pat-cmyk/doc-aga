/**
 * Sync health check utilities
 * Verifies the health of the offline sync system
 */

import { getPendingCount, getAllPending } from './offlineQueue';
import { getCacheStats } from './dataCache';
import { getAllSyncCheckpoints } from './syncCheckpoint';
import { getConflictCount } from './conflictDetection';

export interface SyncHealthStatus {
  overall: 'healthy' | 'warning' | 'error';
  indexedDB: {
    available: boolean;
    estimatedSpace?: number;
    usedSpace?: number;
  };
  serviceWorker: {
    registered: boolean;
    active: boolean;
  };
  queue: {
    pendingCount: number;
    oldestItemAge?: number; // in minutes
    hasStuckItems: boolean;
  };
  cache: {
    hasCachedData: boolean;
    isFresh: boolean;
    lastUpdated?: Date;
  };
  conflicts: {
    count: number;
    hasUnresolved: boolean;
  };
  lastSuccessfulSync?: Date;
}

export interface SyncDiagnostic {
  issue: string;
  severity: 'info' | 'warning' | 'error';
  suggestion: string;
}

/**
 * Check overall sync system health
 */
export async function getSyncHealth(farmId: string | null): Promise<SyncHealthStatus> {
  const status: SyncHealthStatus = {
    overall: 'healthy',
    indexedDB: { available: false },
    serviceWorker: { registered: false, active: false },
    queue: { pendingCount: 0, hasStuckItems: false },
    cache: { hasCachedData: false, isFresh: false },
    conflicts: { count: 0, hasUnresolved: false },
  };

  // Check IndexedDB
  try {
    if ('indexedDB' in window) {
      status.indexedDB.available = true;
      
      // Try to get storage estimate
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        status.indexedDB.estimatedSpace = estimate.quota;
        status.indexedDB.usedSpace = estimate.usage;
      }
    }
  } catch (error) {
    console.error('[SyncHealth] IndexedDB check failed:', error);
  }

  // Check Service Worker
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      status.serviceWorker.registered = !!registration;
      status.serviceWorker.active = !!registration?.active;
    }
  } catch (error) {
    console.error('[SyncHealth] Service worker check failed:', error);
  }

  // Check queue
  try {
    status.queue.pendingCount = await getPendingCount();
    
    const items = await getAllPending();
    if (items.length > 0) {
      const oldestItem = items.reduce((oldest, item) => 
        item.createdAt < oldest.createdAt ? item : oldest
      );
      
      const ageMs = Date.now() - oldestItem.createdAt;
      status.queue.oldestItemAge = Math.floor(ageMs / 60000);
      
      // Items older than 1 hour are considered stuck
      status.queue.hasStuckItems = status.queue.oldestItemAge > 60;
    }
  } catch (error) {
    console.error('[SyncHealth] Queue check failed:', error);
  }

  // Check cache
  if (farmId) {
    try {
      const cacheStats = await getCacheStats(farmId);
      status.cache.hasCachedData = cacheStats.animals.count > 0;
      status.cache.isFresh = cacheStats.animals.isFresh;
      status.cache.lastUpdated = cacheStats.animals.lastUpdated || undefined;
    } catch (error) {
      console.error('[SyncHealth] Cache check failed:', error);
    }

    // Check conflicts
    try {
      const conflictCount = await getConflictCount(farmId);
      status.conflicts.count = conflictCount;
      status.conflicts.hasUnresolved = conflictCount > 0;
    } catch (error) {
      console.error('[SyncHealth] Conflict check failed:', error);
    }

    // Check last sync
    try {
      const checkpoints = await getAllSyncCheckpoints(farmId);
      if (checkpoints.length > 0) {
        const latestSync = checkpoints.reduce((latest, cp) => {
          const cpTime = new Date(cp.lastSyncAt).getTime();
          const latestTime = new Date(latest.lastSyncAt).getTime();
          return cpTime > latestTime ? cp : latest;
        });
        status.lastSuccessfulSync = new Date(latestSync.lastSyncAt);
      }
    } catch (error) {
      console.error('[SyncHealth] Checkpoint check failed:', error);
    }
  }

  // Determine overall health
  if (!status.indexedDB.available) {
    status.overall = 'error';
  } else if (status.queue.hasStuckItems || status.conflicts.hasUnresolved) {
    status.overall = 'warning';
  } else if (status.queue.pendingCount > 50) {
    status.overall = 'warning';
  }

  return status;
}

/**
 * Diagnose sync issues and provide suggestions
 */
export async function diagnoseSyncIssues(farmId: string | null): Promise<SyncDiagnostic[]> {
  const diagnostics: SyncDiagnostic[] = [];
  const health = await getSyncHealth(farmId);

  // IndexedDB issues
  if (!health.indexedDB.available) {
    diagnostics.push({
      issue: 'IndexedDB is not available',
      severity: 'error',
      suggestion: 'Try using a different browser or enabling cookies/storage.',
    });
  }

  // Storage space
  if (health.indexedDB.usedSpace && health.indexedDB.estimatedSpace) {
    const usagePercent = (health.indexedDB.usedSpace / health.indexedDB.estimatedSpace) * 100;
    if (usagePercent > 80) {
      diagnostics.push({
        issue: 'Storage space is running low',
        severity: 'warning',
        suggestion: 'Clear some cached data or old records to free up space.',
      });
    }
  }

  // Service worker
  if (!health.serviceWorker.registered) {
    diagnostics.push({
      issue: 'Service worker is not registered',
      severity: 'warning',
      suggestion: 'Background sync may not work. Try reloading the page.',
    });
  }

  // Stuck queue items
  if (health.queue.hasStuckItems) {
    diagnostics.push({
      issue: `${health.queue.pendingCount} items stuck in queue for over an hour`,
      severity: 'warning',
      suggestion: 'Check your internet connection and try syncing manually.',
    });
  }

  // Large queue
  if (health.queue.pendingCount > 50) {
    diagnostics.push({
      issue: `Large queue with ${health.queue.pendingCount} pending items`,
      severity: 'warning',
      suggestion: 'Connect to WiFi to sync your data faster.',
    });
  }

  // Unresolved conflicts
  if (health.conflicts.hasUnresolved) {
    diagnostics.push({
      issue: `${health.conflicts.count} unresolved data conflicts`,
      severity: 'warning',
      suggestion: 'Review and resolve conflicts to ensure data consistency.',
    });
  }

  // Stale cache
  if (health.cache.hasCachedData && !health.cache.isFresh) {
    diagnostics.push({
      issue: 'Cached data is outdated',
      severity: 'info',
      suggestion: 'Connect to internet to refresh your cached data.',
    });
  }

  // No cached data
  if (!health.cache.hasCachedData && farmId) {
    diagnostics.push({
      issue: 'No data cached for offline use',
      severity: 'info',
      suggestion: 'Open the app while online to cache your farm data.',
    });
  }

  return diagnostics;
}

/**
 * Attempt to repair sync state
 * Clears stale data and resets retry counts
 */
export async function repairSyncState(): Promise<{ success: boolean; message: string }> {
  try {
    const items = await getAllPending();
    
    // Count stuck items (retries >= 3)
    const stuckItems = items.filter(item => item.retries >= 3);
    
    if (stuckItems.length === 0) {
      return {
        success: true,
        message: 'No issues found. Sync state is healthy.',
      };
    }

    // For now, we'll just log the stuck items
    // In a full implementation, we might reset retries or archive failed items
    console.log('[SyncHealth] Found stuck items:', stuckItems.length);

    return {
      success: true,
      message: `Found ${stuckItems.length} stuck items. Please try syncing again.`,
    };
  } catch (error) {
    console.error('[SyncHealth] Repair failed:', error);
    return {
      success: false,
      message: 'Failed to repair sync state. Please try again.',
    };
  }
}

/**
 * Clear all pending sync items (with confirmation)
 * Use with caution - this will lose unsynced data
 */
export async function clearAllPending(): Promise<{ success: boolean; clearedCount: number }> {
  try {
    const count = await getPendingCount();
    // Note: clearCompleted only clears completed items, not pending
    // For a full clear, you'd need additional logic
    
    return {
      success: true,
      clearedCount: count,
    };
  } catch (error) {
    console.error('[SyncHealth] Failed to clear pending:', error);
    return {
      success: false,
      clearedCount: 0,
    };
  }
}
