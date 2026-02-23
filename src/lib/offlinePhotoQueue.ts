/**
 * Offline Photo Queue
 * 
 * Dedicated IndexedDB store for photo blobs captured while offline.
 * Modeled after offlineAudioQueue.ts. Photos are stored locally and
 * uploaded to storage when connectivity is restored.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Storage limits
const MAX_PHOTO_QUEUE_SIZE = 20;
const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const PHOTO_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Target type for the queued photo
 */
export type PhotoTarget = 'avatar' | 'health_record';

/**
 * A single queued photo item
 */
export interface PhotoQueueItem {
  id: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  target: PhotoTarget;
  animalId: string;
  farmId: string;
  /** Links this photo to a parent offline queue item (e.g., health record) */
  linkedQueueItemId?: string;
  createdAt: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  retries: number;
  lastError?: string;
}

/**
 * IndexedDB schema for photo queue
 */
interface PhotoQueueDB extends DBSchema {
  photoQueue: {
    key: string;
    value: PhotoQueueItem;
    indexes: {
      'by-status': string;
      'by-farm': string;
      'by-createdAt': number;
    };
  };
}

let dbInstance: IDBPDatabase<PhotoQueueDB> | null = null;

/**
 * Get or initialize the photo queue database
 */
async function getDB(): Promise<IDBPDatabase<PhotoQueueDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<PhotoQueueDB>('docAgaPhotoQueue', 1, {
    upgrade(db) {
      const store = db.createObjectStore('photoQueue', { keyPath: 'id' });
      store.createIndex('by-status', 'status');
      store.createIndex('by-farm', 'farmId');
      store.createIndex('by-createdAt', 'createdAt');
    },
  });

  return dbInstance;
}

/**
 * Queue a photo for later upload
 * 
 * @param blob - The photo blob (compressed)
 * @param options - Photo metadata
 * @returns Queue item ID
 */
export async function addPhoto(
  blob: Blob,
  options: {
    fileName: string;
    mimeType: string;
    target: PhotoTarget;
    animalId: string;
    farmId: string;
    linkedQueueItemId?: string;
  }
): Promise<string> {
  // Check size limit
  if (blob.size > MAX_PHOTO_SIZE_BYTES) {
    throw new Error(`Photo too large (${(blob.size / 1024 / 1024).toFixed(1)}MB). Maximum is 10MB.`);
  }

  const db = await getDB();

  // Clean up expired items first
  await cleanupExpired();

  // Check capacity
  const tx = db.transaction('photoQueue', 'readwrite');
  const count = await tx.store.count();

  if (count >= MAX_PHOTO_QUEUE_SIZE) {
    // Remove oldest completed/failed items first, then pending
    const oldest = await tx.store.index('by-createdAt').openCursor();
    if (oldest) {
      await oldest.delete();
      console.warn('[OfflinePhotoQueue] Queue full, removed oldest item');
    }
  }

  const id = `photo_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const item: PhotoQueueItem = {
    id,
    blob,
    fileName: options.fileName,
    mimeType: options.mimeType,
    target: options.target,
    animalId: options.animalId,
    farmId: options.farmId,
    linkedQueueItemId: options.linkedQueueItemId,
    createdAt: Date.now(),
    status: 'pending',
    retries: 0,
  };

  await tx.store.add(item);
  await tx.done;

  console.log(`[OfflinePhotoQueue] Queued photo: ${id} (${(blob.size / 1024).toFixed(0)}KB, target: ${options.target})`);
  return id;
}

/**
 * Get all pending photos
 */
export async function getPendingPhotos(): Promise<PhotoQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('photoQueue', 'by-status', 'pending');
}

/**
 * Get pending photos for a specific farm
 */
export async function getPendingPhotosForFarm(farmId: string): Promise<PhotoQueueItem[]> {
  const all = await getPendingPhotos();
  return all.filter(p => p.farmId === farmId);
}

/**
 * Get pending photos linked to a specific queue item
 */
export async function getPhotosForQueueItem(linkedQueueItemId: string): Promise<PhotoQueueItem[]> {
  const all = await getPendingPhotos();
  return all.filter(p => p.linkedQueueItemId === linkedQueueItemId);
}

/**
 * Get a single photo by ID
 */
export async function getPhoto(id: string): Promise<PhotoQueueItem | undefined> {
  const db = await getDB();
  return db.get('photoQueue', id);
}

/**
 * Get count of pending photos
 */
export async function getPendingPhotoCount(): Promise<number> {
  const db = await getDB();
  return db.countFromIndex('photoQueue', 'by-status', 'pending');
}

/**
 * Get count of pending avatar photos for an animal
 */
export async function getPendingAvatarCount(animalId: string): Promise<number> {
  const pending = await getPendingPhotos();
  return pending.filter(p => p.animalId === animalId && p.target === 'avatar').length;
}

/**
 * Update photo status
 */
export async function updatePhotoStatus(
  id: string,
  status: PhotoQueueItem['status'],
  error?: string
): Promise<void> {
  const db = await getDB();
  const item = await db.get('photoQueue', id);

  if (item) {
    item.status = status;
    if (error) {
      item.lastError = error;
      item.retries++;
    }
    await db.put('photoQueue', item);
  }
}

/**
 * Remove a photo from the queue
 */
export async function removePhoto(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('photoQueue', id);
  console.log(`[OfflinePhotoQueue] Removed photo: ${id}`);
}

/**
 * Clean up expired photos (older than 7 days)
 */
export async function cleanupExpired(): Promise<number> {
  const db = await getDB();
  const cutoff = Date.now() - PHOTO_RETENTION_MS;
  const all = await db.getAll('photoQueue');

  let removed = 0;
  for (const item of all) {
    if (item.createdAt < cutoff) {
      await db.delete('photoQueue', item.id);
      removed++;
    }
  }

  if (removed > 0) {
    console.log(`[OfflinePhotoQueue] Cleaned up ${removed} expired items`);
  }

  return removed;
}

/**
 * Get storage usage statistics
 */
export async function getPhotoStorageStats(): Promise<{
  count: number;
  pendingCount: number;
  failedCount: number;
  totalSizeKB: number;
}> {
  const db = await getDB();
  const all = await db.getAll('photoQueue');

  let totalSize = 0;
  let pendingCount = 0;
  let failedCount = 0;

  for (const item of all) {
    totalSize += item.blob.size;
    if (item.status === 'pending') pendingCount++;
    if (item.status === 'failed') failedCount++;
  }

  return {
    count: all.length,
    pendingCount,
    failedCount,
    totalSizeKB: Math.round(totalSize / 1024),
  };
}
