/**
 * Conflict detection and resolution utilities
 * Handles server-side conflict checking and resolution strategies
 */

import { supabase } from '@/integrations/supabase/client';

export type ResolutionStrategy = 'client_wins' | 'server_wins' | 'merged' | 'pending';

export interface ConflictInfo {
  hasConflict: boolean;
  serverData: Record<string, any> | null;
  serverUpdatedAt: string | null;
}

export interface SyncConflict {
  id: string;
  tableName: string;
  recordId: string;
  clientData: Record<string, any>;
  serverData: Record<string, any>;
  resolution: ResolutionStrategy | null;
  resolvedData: Record<string, any> | null;
  createdAt: string;
  resolvedAt: string | null;
}

/**
 * Check if there's a conflict between client and server data
 */
export async function detectConflict(
  tableName: string,
  recordId: string,
  clientTimestamp: string,
  clientData: Record<string, any>
): Promise<ConflictInfo> {
  const { data, error } = await supabase.rpc('detect_sync_conflict', {
    p_table_name: tableName,
    p_record_id: recordId,
    p_client_timestamp: clientTimestamp,
    p_client_data: clientData,
  });

  if (error) {
    console.error('[ConflictDetection] Error checking conflict:', error);
    return { hasConflict: false, serverData: null, serverUpdatedAt: null };
  }

  // Cast to expected shape since RPC returns Json type
  const result = data as { has_conflict?: boolean; server_data?: Record<string, any>; server_updated_at?: string } | null;

  return {
    hasConflict: result?.has_conflict ?? false,
    serverData: result?.server_data ?? null,
    serverUpdatedAt: result?.server_updated_at ?? null,
  };
}

/**
 * Record a conflict for later resolution
 */
export async function recordConflict(
  farmId: string,
  tableName: string,
  recordId: string,
  clientData: Record<string, any>,
  serverData: Record<string, any>
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('sync_conflicts')
    .insert({
      farm_id: farmId,
      user_id: user.id,
      table_name: tableName,
      record_id: recordId,
      client_data: clientData,
      server_data: serverData,
      resolution: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[ConflictDetection] Failed to record conflict:', error);
    return null;
  }

  return data?.id ?? null;
}

/**
 * Get all unresolved conflicts for a farm
 */
export async function getUnresolvedConflicts(
  farmId: string
): Promise<SyncConflict[]> {
  const { data, error } = await supabase
    .from('sync_conflicts')
    .select('*')
    .eq('farm_id', farmId)
    .eq('resolution', 'pending')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    tableName: row.table_name,
    recordId: row.record_id,
    clientData: row.client_data as Record<string, any>,
    serverData: row.server_data as Record<string, any>,
    resolution: row.resolution as ResolutionStrategy | null,
    resolvedData: row.resolved_data as Record<string, any> | null,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }));
}

/**
 * Resolve a conflict with a chosen strategy
 */
export async function resolveConflict(
  conflictId: string,
  strategy: ResolutionStrategy,
  resolvedData?: Record<string, any>
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('sync_conflicts')
    .update({
      resolution: strategy,
      resolved_data: resolvedData ?? null,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', conflictId);

  if (error) {
    console.error('[ConflictDetection] Failed to resolve conflict:', error);
    return false;
  }

  return true;
}

/**
 * Apply resolution to the actual record
 */
export async function applyConflictResolution(
  conflict: SyncConflict
): Promise<boolean> {
  if (!conflict.resolution || conflict.resolution === 'pending') {
    return false;
  }

  let dataToApply: Record<string, any>;

  switch (conflict.resolution) {
    case 'client_wins':
      dataToApply = conflict.clientData;
      break;
    case 'server_wins':
      // Server already has correct data, nothing to apply
      return true;
    case 'merged':
      dataToApply = conflict.resolvedData ?? conflict.clientData;
      break;
    default:
      return false;
  }

  // Apply the update to the record
  const { error } = await supabase
    .from(conflict.tableName as any)
    .update(dataToApply)
    .eq('id', conflict.recordId);

  if (error) {
    console.error('[ConflictDetection] Failed to apply resolution:', error);
    return false;
  }

  return true;
}

/**
 * Get conflict count for a farm (for UI badge)
 */
export async function getConflictCount(farmId: string): Promise<number> {
  const { count, error } = await supabase
    .from('sync_conflicts')
    .select('id', { count: 'exact', head: true })
    .eq('farm_id', farmId)
    .eq('resolution', 'pending');

  if (error) return 0;
  return count ?? 0;
}

/**
 * Simple merge strategy: prefer newer values, keep all fields
 */
export function mergeRecords(
  clientData: Record<string, any>,
  serverData: Record<string, any>,
  clientTimestamp: string,
  serverTimestamp: string
): Record<string, any> {
  const clientTime = new Date(clientTimestamp).getTime();
  const serverTime = new Date(serverTimestamp).getTime();
  
  // Start with server data as base
  const merged = { ...serverData };
  
  // If client is newer, prefer client values for non-null fields
  if (clientTime > serverTime) {
    for (const key of Object.keys(clientData)) {
      if (clientData[key] !== null && clientData[key] !== undefined) {
        merged[key] = clientData[key];
      }
    }
  }
  
  return merged;
}
