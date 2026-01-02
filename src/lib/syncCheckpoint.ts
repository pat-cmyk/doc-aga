/**
 * Sync checkpoint utilities for tracking last sync state
 * Uses server-side sync_checkpoints table for persistence
 */

import { supabase } from '@/integrations/supabase/client';

export interface SyncCheckpoint {
  tableName: string;
  lastSyncAt: string;
  lastRecordTimestamp: string | null;
  recordsSynced: number;
}

/**
 * Get sync checkpoint for a specific table
 */
export async function getSyncCheckpoint(
  farmId: string,
  tableName: string
): Promise<SyncCheckpoint | null> {
  const { data, error } = await supabase
    .from('farm_sync_checkpoints')
    .select('table_name, last_sync_at, last_record_timestamp, records_synced')
    .eq('farm_id', farmId)
    .eq('table_name', tableName)
    .maybeSingle();

  if (error || !data) return null;

  return {
    tableName: data.table_name,
    lastSyncAt: data.last_sync_at,
    lastRecordTimestamp: data.last_record_timestamp,
    recordsSynced: data.records_synced,
  };
}

/**
 * Update sync checkpoint after successful sync
 */
export async function updateSyncCheckpoint(
  farmId: string,
  tableName: string,
  lastRecordTimestamp: string | null,
  recordsSynced: number
): Promise<void> {
  // Use RPC function for upsert with proper conflict handling
  const { error } = await supabase.rpc('update_sync_checkpoint', {
    p_farm_id: farmId,
    p_table_name: tableName,
    p_last_record_timestamp: lastRecordTimestamp,
    p_records_synced: recordsSynced,
  });

  if (error) {
    console.error('[SyncCheckpoint] Failed to update checkpoint:', error);
  }
}

/**
 * Get all sync checkpoints for a farm
 */
export async function getAllSyncCheckpoints(
  farmId: string
): Promise<SyncCheckpoint[]> {
  const { data, error } = await supabase
    .from('farm_sync_checkpoints')
    .select('table_name, last_sync_at, last_record_timestamp, records_synced')
    .eq('farm_id', farmId);

  if (error || !data) return [];

  return data.map((row) => ({
    tableName: row.table_name,
    lastSyncAt: row.last_sync_at,
    lastRecordTimestamp: row.last_record_timestamp,
    recordsSynced: row.records_synced,
  }));
}

/**
 * Check if a full sync is needed (no checkpoint or stale)
 */
export async function needsFullSync(
  farmId: string,
  tableName: string,
  maxAgeMs: number = 24 * 60 * 60 * 1000 // 24 hours default
): Promise<boolean> {
  const checkpoint = await getSyncCheckpoint(farmId, tableName);
  
  if (!checkpoint) return true;
  
  const lastSync = new Date(checkpoint.lastSyncAt).getTime();
  const now = Date.now();
  
  return (now - lastSync) > maxAgeMs;
}

/**
 * Generate a unique client ID for offline records
 */
export function generateClientId(): string {
  return `client_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}
