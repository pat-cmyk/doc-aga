import { supabase } from '@/integrations/supabase/client';

export type SyncType = 'background' | 'manual' | 'periodic' | 'voice';

export interface SyncSession {
  id: string;
  startTime: number;
  farmId?: string;
  syncType: SyncType;
}

export interface SyncStats {
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  durationMs: number;
}

let activeSession: SyncSession | null = null;

// Type for sync_analytics row (since types not yet regenerated)
interface SyncAnalyticsRow {
  id: string;
  farm_id: string | null;
  user_id: string | null;
  sync_type: string;
  items_processed: number | null;
  items_succeeded: number | null;
  items_failed: number | null;
  duration_ms: number | null;
  started_at: string;
  completed_at: string | null;
  error_summary: string | null;
  created_at: string;
}

/**
 * Start a new sync telemetry session
 * Records the start of a sync operation for analytics
 */
export async function startSyncSession(
  farmId: string | undefined,
  syncType: SyncType
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  
  const sessionId = crypto.randomUUID();
  const startTime = Date.now();
  
  activeSession = {
    id: sessionId,
    startTime,
    farmId,
    syncType,
  };

  // Insert initial record using raw query since types not yet updated
  try {
    const { error } = await supabase.rpc('execute_raw_query' as any, {
      query_text: `INSERT INTO sync_analytics (id, farm_id, user_id, sync_type, started_at, items_processed, items_succeeded, items_failed) 
                   VALUES ($1, $2, $3, $4, $5, 0, 0, 0)`,
      params: [sessionId, farmId || null, user?.id || null, syncType, new Date(startTime).toISOString()]
    });
    
    if (error) {
      // Fallback: try direct insert if RPC doesn't exist
      console.warn('[SyncTelemetry] RPC not available, sync analytics disabled');
    }
  } catch {
    // Silently fail - telemetry is non-critical
    console.warn('[SyncTelemetry] Failed to start session - table may not exist yet');
  }

  return sessionId;
}

/**
 * Complete a sync session with final statistics
 */
export async function completeSyncSession(
  sessionId: string,
  stats: SyncStats
): Promise<void> {
  const completedAt = new Date().toISOString();
  
  try {
    // Use any cast to bypass type checking for new table
    await (supabase as any)
      .from('sync_analytics')
      .update({
        items_processed: stats.itemsProcessed,
        items_succeeded: stats.itemsSucceeded,
        items_failed: stats.itemsFailed,
        duration_ms: stats.durationMs,
        completed_at: completedAt,
      })
      .eq('id', sessionId);
  } catch {
    console.warn('[SyncTelemetry] Failed to complete session');
  }

  // Clear active session
  if (activeSession?.id === sessionId) {
    activeSession = null;
  }
}

/**
 * Record an error during sync
 */
export async function recordSyncError(
  sessionId: string,
  error: Error | string
): Promise<void> {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  try {
    await (supabase as any)
      .from('sync_analytics')
      .update({
        error_summary: errorMessage.slice(0, 500),
      })
      .eq('id', sessionId);
  } catch {
    console.warn('[SyncTelemetry] Failed to record error');
  }
}

/**
 * Get sync statistics for a farm over a period
 */
export async function getSyncStats(
  farmId: string,
  days: number = 7
): Promise<{
  totalSyncs: number;
  successRate: number;
  avgDurationMs: number;
  failedSyncs: number;
  lastSync: string | null;
}> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    const { data, error } = await (supabase as any)
      .from('sync_analytics')
      .select('*')
      .eq('farm_id', farmId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    if (error || !data) {
      return {
        totalSyncs: 0,
        successRate: 100,
        avgDurationMs: 0,
        failedSyncs: 0,
        lastSync: null,
      };
    }

    const rows = data as SyncAnalyticsRow[];
    const totalSyncs = rows.length;
    const totalItems = rows.reduce((sum, s) => sum + (s.items_processed || 0), 0);
    const succeededItems = rows.reduce((sum, s) => sum + (s.items_succeeded || 0), 0);
    const failedSyncs = rows.filter(s => (s.items_failed || 0) > 0).length;
    const durationsWithValues = rows.filter(s => s.duration_ms != null);
    const avgDurationMs = durationsWithValues.length > 0
      ? Math.round(durationsWithValues.reduce((sum, s) => sum + (s.duration_ms || 0), 0) / durationsWithValues.length)
      : 0;

    return {
      totalSyncs,
      successRate: totalItems > 0 ? Math.round((succeededItems / totalItems) * 100) : 100,
      avgDurationMs,
      failedSyncs,
      lastSync: rows[0]?.created_at || null,
    };
  } catch {
    return {
      totalSyncs: 0,
      successRate: 100,
      avgDurationMs: 0,
      failedSyncs: 0,
      lastSync: null,
    };
  }
}

/**
 * Get recent failures for debugging
 */
export async function getRecentFailures(
  farmId: string,
  limit: number = 10
): Promise<Array<{
  id: string;
  syncType: string;
  errorSummary: string | null;
  createdAt: string;
  itemsFailed: number;
}>> {
  try {
    const { data, error } = await (supabase as any)
      .from('sync_analytics')
      .select('id, sync_type, error_summary, created_at, items_failed')
      .eq('farm_id', farmId)
      .gt('items_failed', 0)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return (data as any[]).map(row => ({
      id: row.id,
      syncType: row.sync_type,
      errorSummary: row.error_summary,
      createdAt: row.created_at,
      itemsFailed: row.items_failed || 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Get the active sync session (if any)
 */
export function getActiveSession(): SyncSession | null {
  return activeSession;
}
