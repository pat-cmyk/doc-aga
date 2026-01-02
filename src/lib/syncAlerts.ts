import { getAll, type QueueItem } from './offlineQueue';

export interface StuckItem {
  id: string;
  type: QueueItem['type'];
  status: QueueItem['status'];
  createdAt: number;
  retries: number;
  error?: string;
  ageMinutes: number;
}

export interface SyncAlert {
  type: 'stuck_items' | 'high_failure_rate' | 'long_duration';
  severity: 'warning' | 'critical';
  message: string;
  count?: number;
  details?: string;
}

const STUCK_THRESHOLD_MINUTES = 60; // Items older than 1 hour are considered stuck
const CRITICAL_STUCK_THRESHOLD = 5; // More than 5 stuck items = critical

/**
 * Check for items that have been stuck in the queue for too long
 */
export async function checkStuckItems(farmId?: string): Promise<StuckItem[]> {
  const allItems = await getAll();
  const now = Date.now();
  
  const stuckItems = allItems
    .filter(item => {
      // Item is stuck if:
      // 1. It's been pending/processing for over an hour
      // 2. Or it's failed with max retries
      const ageMinutes = (now - item.createdAt) / (1000 * 60);
      const isStuck = ageMinutes > STUCK_THRESHOLD_MINUTES;
      const isFailedMaxRetries = item.status === 'failed' && item.retries >= 3;
      
      // Filter by farmId if provided
      if (farmId && item.payload.farmId !== farmId) {
        return false;
      }
      
      return (item.status === 'pending' || item.status === 'processing') && isStuck 
        || isFailedMaxRetries;
    })
    .map(item => ({
      id: item.id,
      type: item.type,
      status: item.status,
      createdAt: item.createdAt,
      retries: item.retries,
      error: item.error,
      ageMinutes: Math.round((now - item.createdAt) / (1000 * 60)),
    }));

  return stuckItems;
}

/**
 * Get count of stuck items across all farms (for admin)
 */
export async function getStuckItemsCount(): Promise<number> {
  const stuckItems = await checkStuckItems();
  return stuckItems.length;
}

/**
 * Generate alerts based on current queue state
 */
export async function generateSyncAlerts(farmId?: string): Promise<SyncAlert[]> {
  const alerts: SyncAlert[] = [];
  const stuckItems = await checkStuckItems(farmId);
  
  if (stuckItems.length > 0) {
    const severity = stuckItems.length >= CRITICAL_STUCK_THRESHOLD ? 'critical' : 'warning';
    
    alerts.push({
      type: 'stuck_items',
      severity,
      message: `${stuckItems.length} sync item${stuckItems.length > 1 ? 's' : ''} stuck in queue`,
      count: stuckItems.length,
      details: stuckItems.map(i => `${i.type}: ${i.ageMinutes}min old`).join(', '),
    });
  }

  // Check for items with errors
  const failedItems = stuckItems.filter(i => i.error);
  if (failedItems.length > 0) {
    const uniqueErrors = [...new Set(failedItems.map(i => i.error))];
    
    alerts.push({
      type: 'high_failure_rate',
      severity: 'warning',
      message: `${failedItems.length} item${failedItems.length > 1 ? 's' : ''} failed to sync`,
      count: failedItems.length,
      details: uniqueErrors.slice(0, 3).join('; '),
    });
  }

  return alerts;
}

/**
 * Check if there are any active sync alerts
 */
export async function hasActiveAlerts(farmId?: string): Promise<boolean> {
  const alerts = await generateSyncAlerts(farmId);
  return alerts.length > 0;
}

/**
 * Get alert severity color for UI
 */
export function getAlertSeverityColor(severity: SyncAlert['severity']): {
  bg: string;
  text: string;
  border: string;
} {
  if (severity === 'critical') {
    return {
      bg: 'bg-destructive/10',
      text: 'text-destructive',
      border: 'border-destructive/30',
    };
  }
  
  return {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-600',
    border: 'border-yellow-500/30',
  };
}
