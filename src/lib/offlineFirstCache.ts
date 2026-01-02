/**
 * Offline-First Cache Layer
 * 
 * Unified interface for IndexedDB caching that integrates with React Query.
 * Provides cache-first reads, optimistic writes, and sync status tracking.
 * 
 * Design Principles:
 * 1. Always read from cache first (instant UI)
 * 2. Sync with server in background (eventual consistency)
 * 3. Track sync status per record (transparency)
 * 4. Handle conflicts gracefully (user choice)
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// ============= TYPES =============

/**
 * Sync status for cached items
 * - synced: Data matches server
 * - pending: Local changes waiting to sync
 * - conflict: Server has different version
 * - error: Sync failed, needs retry
 */
export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'error';

/**
 * Wrapper for cached data with sync metadata
 */
export interface CachedItem<T = unknown> {
  data: T;
  lastUpdated: number;
  syncStatus: SyncStatus;
  localVersion: number;
  serverVersion?: number;
  syncError?: string;
  optimisticId?: string; // For items created locally before server response
}

/**
 * Sync checkpoint for incremental sync
 */
export interface SyncCheckpoint {
  table: string;
  farmId: string;
  lastSyncedAt: string; // ISO timestamp
  recordCount: number;
}

/**
 * Overall sync status for a farm
 */
export interface FarmSyncStatus {
  farmId: string;
  lastFullSync: number | null;
  pendingChanges: number;
  conflicts: number;
  errors: number;
  isCurrentlySyncing: boolean;
}

// ============= SCHEMA =============

interface OfflineFirstDB extends DBSchema {
  syncCheckpoints: {
    key: string; // `${farmId}:${table}`
    value: SyncCheckpoint;
  };
  syncStatus: {
    key: string; // farmId
    value: FarmSyncStatus;
  };
  pendingWrites: {
    key: string; // Unique ID
    value: {
      id: string;
      table: string;
      operation: 'insert' | 'update' | 'delete';
      data: Record<string, unknown>;
      createdAt: number;
      retries: number;
      lastError?: string;
      farmId: string;
    };
    indexes: { 'by-table': string; 'by-farm': string };
  };
}

// ============= DATABASE =============

let dbInstance: IDBPDatabase<OfflineFirstDB> | null = null;

async function getDB(): Promise<IDBPDatabase<OfflineFirstDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<OfflineFirstDB>('offlineFirstDB', 1, {
    upgrade(db) {
      // Sync checkpoints for incremental sync
      if (!db.objectStoreNames.contains('syncCheckpoints')) {
        db.createObjectStore('syncCheckpoints', { keyPath: 'table' });
      }
      
      // Overall sync status per farm
      if (!db.objectStoreNames.contains('syncStatus')) {
        db.createObjectStore('syncStatus', { keyPath: 'farmId' });
      }
      
      // Pending write operations
      if (!db.objectStoreNames.contains('pendingWrites')) {
        const store = db.createObjectStore('pendingWrites', { keyPath: 'id' });
        store.createIndex('by-table', 'table');
        store.createIndex('by-farm', 'farmId');
      }
    },
  });

  return dbInstance;
}

// ============= SYNC CHECKPOINTS =============

/**
 * Get the last sync checkpoint for a table
 */
export async function getCheckpoint(farmId: string, table: string): Promise<SyncCheckpoint | null> {
  const db = await getDB();
  const key = `${farmId}:${table}`;
  return (await db.get('syncCheckpoints', key)) || null;
}

/**
 * Update sync checkpoint after successful sync
 */
export async function updateCheckpoint(
  farmId: string,
  table: string,
  lastSyncedAt: string,
  recordCount: number
): Promise<void> {
  const db = await getDB();
  const key = `${farmId}:${table}`;
  await db.put('syncCheckpoints', {
    table: key,
    farmId,
    lastSyncedAt,
    recordCount,
  });
}

/**
 * Get all checkpoints for a farm
 */
export async function getAllCheckpoints(farmId: string): Promise<SyncCheckpoint[]> {
  const db = await getDB();
  const all = await db.getAll('syncCheckpoints');
  return all.filter(cp => cp.farmId === farmId);
}

// ============= FARM SYNC STATUS =============

/**
 * Get overall sync status for a farm
 */
export async function getFarmSyncStatus(farmId: string): Promise<FarmSyncStatus> {
  const db = await getDB();
  const existing = await db.get('syncStatus', farmId);
  
  if (existing) return existing;
  
  // Return default status
  return {
    farmId,
    lastFullSync: null,
    pendingChanges: 0,
    conflicts: 0,
    errors: 0,
    isCurrentlySyncing: false,
  };
}

/**
 * Update farm sync status
 */
export async function updateFarmSyncStatus(
  farmId: string,
  updates: Partial<FarmSyncStatus>
): Promise<void> {
  const db = await getDB();
  const existing = await getFarmSyncStatus(farmId);
  await db.put('syncStatus', { ...existing, ...updates, farmId });
}

/**
 * Mark farm as currently syncing
 */
export async function setSyncing(farmId: string, isSyncing: boolean): Promise<void> {
  await updateFarmSyncStatus(farmId, { isCurrentlySyncing: isSyncing });
}

/**
 * Record successful full sync
 */
export async function recordFullSync(farmId: string): Promise<void> {
  await updateFarmSyncStatus(farmId, {
    lastFullSync: Date.now(),
    isCurrentlySyncing: false,
  });
}

// ============= PENDING WRITES =============

/**
 * Queue a write operation for sync
 */
export async function queueWrite(
  farmId: string,
  table: string,
  operation: 'insert' | 'update' | 'delete',
  data: Record<string, unknown>
): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  
  await db.put('pendingWrites', {
    id,
    table,
    operation,
    data,
    createdAt: Date.now(),
    retries: 0,
    farmId,
  });
  
  // Update pending count
  const status = await getFarmSyncStatus(farmId);
  await updateFarmSyncStatus(farmId, {
    pendingChanges: status.pendingChanges + 1,
  });
  
  return id;
}

/**
 * Get all pending writes for a farm
 */
export async function getPendingWrites(farmId: string): Promise<Array<{
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  createdAt: number;
  retries: number;
}>> {
  const db = await getDB();
  return db.getAllFromIndex('pendingWrites', 'by-farm', farmId);
}

/**
 * Remove a pending write after successful sync
 */
export async function removePendingWrite(id: string): Promise<void> {
  const db = await getDB();
  const item = await db.get('pendingWrites', id);
  if (item) {
    await db.delete('pendingWrites', id);
    
    // Update pending count
    const status = await getFarmSyncStatus(item.farmId);
    await updateFarmSyncStatus(item.farmId, {
      pendingChanges: Math.max(0, status.pendingChanges - 1),
    });
  }
}

/**
 * Increment retry count for a pending write
 */
export async function incrementWriteRetry(id: string, error?: string): Promise<number> {
  const db = await getDB();
  const item = await db.get('pendingWrites', id);
  
  if (item) {
    item.retries++;
    item.lastError = error;
    await db.put('pendingWrites', item);
    return item.retries;
  }
  
  return 0;
}

/**
 * Get count of pending writes
 */
export async function getPendingWriteCount(farmId: string): Promise<number> {
  const db = await getDB();
  const all = await db.getAllFromIndex('pendingWrites', 'by-farm', farmId);
  return all.length;
}

// ============= CACHE WRAPPER UTILITIES =============

/**
 * Wrap data with sync metadata for caching
 */
export function wrapWithSyncStatus<T>(
  data: T,
  status: SyncStatus = 'synced',
  serverVersion?: number
): CachedItem<T> {
  return {
    data,
    lastUpdated: Date.now(),
    syncStatus: status,
    localVersion: 1,
    serverVersion,
  };
}

/**
 * Check if cached item needs sync
 */
export function needsSync(item: CachedItem): boolean {
  return item.syncStatus === 'pending' || item.syncStatus === 'error';
}

/**
 * Check if cached item has conflict
 */
export function hasConflict(item: CachedItem): boolean {
  return item.syncStatus === 'conflict';
}

/**
 * Update sync status of a cached item
 */
export function updateItemSyncStatus<T>(
  item: CachedItem<T>,
  status: SyncStatus,
  serverVersion?: number
): CachedItem<T> {
  return {
    ...item,
    syncStatus: status,
    serverVersion: serverVersion ?? item.serverVersion,
    lastUpdated: Date.now(),
  };
}

// ============= CONFLICT DETECTION =============

/**
 * Detect if there's a conflict between local and server versions
 */
export function detectConflict(
  localItem: CachedItem,
  serverVersion: number
): boolean {
  // Conflict if:
  // 1. We have local pending changes
  // 2. Server version is newer than what we based our changes on
  return (
    localItem.syncStatus === 'pending' &&
    localItem.serverVersion !== undefined &&
    serverVersion > localItem.serverVersion
  );
}

// ============= EXPORTS =============

export {
  getDB as getOfflineFirstDB,
};
