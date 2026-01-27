/**
 * Offline Audio Queue
 * 
 * Dedicated IndexedDB store for audio blobs recorded while offline.
 * Separate from the sync queue to handle larger audio files and 
 * provide specific audio management capabilities.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { compressAudio } from './audioCompression';
import type { ExtractorType, ExtractorContext } from './voiceFormExtractors';

// Storage limits
const MAX_AUDIO_QUEUE_SIZE = 10;
const MAX_AUDIO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const AUDIO_RETENTION_MS = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Metadata for a queued audio recording
 */
export interface AudioQueueMetadata {
  /** Source component that initiated the recording */
  source: 'doc-aga' | 'milk-form' | 'feed-form' | 'health-form' | 'bcs-form' | 'general';
  /** Type of extractor to run on transcription */
  extractorType?: ExtractorType;
  /** Context for the extractor (e.g., animal list) */
  extractorContext?: ExtractorContext;
  /** Farm ID for record association */
  farmId?: string;
  /** Dialog ID for routing result back to correct form */
  dialogId?: string;
}

/**
 * A single queued audio item
 */
export interface AudioQueueItem {
  id: string;
  audioBlob: Blob;
  createdAt: number;
  status: 'pending' | 'transcribing' | 'transcribed' | 'failed';
  transcript?: string;
  retries: number;
  lastError?: string;
  metadata: AudioQueueMetadata;
}

/**
 * IndexedDB schema for audio queue
 */
interface AudioQueueDB extends DBSchema {
  audioQueue: {
    key: string;
    value: AudioQueueItem;
    indexes: { 
      'by-status': string; 
      'by-createdAt': number;
    };
  };
}

let dbInstance: IDBPDatabase<AudioQueueDB> | null = null;

/**
 * Get or initialize the audio queue database
 */
async function getDB(): Promise<IDBPDatabase<AudioQueueDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<AudioQueueDB>('docAgaAudioQueue', 1, {
    upgrade(db) {
      const store = db.createObjectStore('audioQueue', { keyPath: 'id' });
      store.createIndex('by-status', 'status');
      store.createIndex('by-createdAt', 'createdAt');
    },
  });

  return dbInstance;
}

/**
 * Queue an audio recording for later transcription
 * 
 * @param audioBlob - The recorded audio blob
 * @param metadata - Source and extraction configuration
 * @returns Queue item ID
 */
export async function queueOfflineAudio(
  audioBlob: Blob,
  metadata: AudioQueueMetadata
): Promise<string> {
  const db = await getDB();
  
  // Compress audio first
  let compressedBlob: Blob;
  try {
    compressedBlob = await compressAudio(audioBlob);
    console.log(`[OfflineAudioQueue] Compressed: ${(audioBlob.size / 1024).toFixed(0)}KB → ${(compressedBlob.size / 1024).toFixed(0)}KB`);
  } catch (error) {
    console.warn('[OfflineAudioQueue] Compression failed, using original:', error);
    compressedBlob = audioBlob;
  }
  
  // Check size limit
  if (compressedBlob.size > MAX_AUDIO_SIZE_BYTES) {
    throw new Error(`Audio too large (${(compressedBlob.size / 1024 / 1024).toFixed(1)}MB). Maximum is 5MB.`);
  }
  
  // Clean up old items if at capacity
  const tx = db.transaction('audioQueue', 'readwrite');
  const count = await tx.store.count();
  
  if (count >= MAX_AUDIO_QUEUE_SIZE) {
    // Remove oldest pending/failed items to make room
    const oldest = await tx.store.index('by-createdAt').openCursor();
    if (oldest) {
      await oldest.delete();
      console.warn('[OfflineAudioQueue] Queue full, removed oldest item');
    }
  }
  
  // Create queue item
  const id = `audio_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const item: AudioQueueItem = {
    id,
    audioBlob: compressedBlob,
    createdAt: Date.now(),
    status: 'pending',
    retries: 0,
    metadata,
  };
  
  await tx.store.add(item);
  await tx.done;
  
  console.log(`[OfflineAudioQueue] Queued audio: ${id} (${(compressedBlob.size / 1024).toFixed(0)}KB)`);
  
  return id;
}

/**
 * Get all pending audio items
 */
export async function getPendingAudio(): Promise<AudioQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('audioQueue', 'by-status', 'pending');
}

/**
 * Get count of pending audio items
 */
export async function getPendingAudioCount(): Promise<number> {
  const db = await getDB();
  return db.countFromIndex('audioQueue', 'by-status', 'pending');
}

/**
 * Get total count of all audio items
 */
export async function getAudioQueueCount(): Promise<number> {
  const db = await getDB();
  return db.count('audioQueue');
}

/**
 * Get all audio items (for debugging/review UI)
 */
export async function getAllAudioItems(): Promise<AudioQueueItem[]> {
  const db = await getDB();
  return db.getAll('audioQueue');
}

/**
 * Get all failed audio items
 */
export async function getFailedAudio(): Promise<AudioQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('audioQueue', 'by-status', 'failed');
}

/**
 * Update audio item status to transcribing
 */
export async function markTranscribing(id: string): Promise<void> {
  const db = await getDB();
  const item = await db.get('audioQueue', id);
  
  if (item) {
    item.status = 'transcribing';
    await db.put('audioQueue', item);
  }
}

/**
 * Mark audio as successfully transcribed
 */
export async function markTranscribed(id: string, transcript: string): Promise<void> {
  const db = await getDB();
  const item = await db.get('audioQueue', id);
  
  if (item) {
    item.status = 'transcribed';
    item.transcript = transcript;
    await db.put('audioQueue', item);
  }
}

/**
 * Mark audio as failed with error message
 */
export async function markFailed(id: string, error: string): Promise<void> {
  const db = await getDB();
  const item = await db.get('audioQueue', id);
  
  if (item) {
    item.status = 'failed';
    item.lastError = error;
    item.retries++;
    await db.put('audioQueue', item);
  }
}

/**
 * Reset a failed item for retry
 */
export async function resetForRetry(id: string): Promise<void> {
  const db = await getDB();
  const item = await db.get('audioQueue', id);
  
  if (item) {
    item.status = 'pending';
    item.lastError = undefined;
    await db.put('audioQueue', item);
  }
}

/**
 * Remove an audio item from the queue
 */
export async function removeAudioItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('audioQueue', id);
  console.log(`[OfflineAudioQueue] Removed audio: ${id}`);
}

/**
 * Remove all transcribed items (cleanup after successful sync)
 */
export async function clearTranscribed(): Promise<number> {
  const db = await getDB();
  const transcribed = await db.getAllFromIndex('audioQueue', 'by-status', 'transcribed');
  
  for (const item of transcribed) {
    await db.delete('audioQueue', item.id);
  }
  
  console.log(`[OfflineAudioQueue] Cleared ${transcribed.length} transcribed items`);
  return transcribed.length;
}

/**
 * Clean up expired audio items (older than 48 hours)
 */
export async function cleanupExpired(): Promise<number> {
  const db = await getDB();
  const cutoff = Date.now() - AUDIO_RETENTION_MS;
  const all = await db.getAll('audioQueue');
  
  let removed = 0;
  for (const item of all) {
    if (item.createdAt < cutoff) {
      await db.delete('audioQueue', item.id);
      removed++;
    }
  }
  
  if (removed > 0) {
    console.log(`[OfflineAudioQueue] Cleaned up ${removed} expired items`);
  }
  
  return removed;
}

/**
 * Get storage usage statistics
 */
export async function getAudioStorageStats(): Promise<{
  count: number;
  pendingCount: number;
  failedCount: number;
  totalSizeKB: number;
  oldestTimestamp: number | null;
}> {
  const db = await getDB();
  const all = await db.getAll('audioQueue');
  
  let totalSize = 0;
  let pendingCount = 0;
  let failedCount = 0;
  let oldestTimestamp: number | null = null;
  
  for (const item of all) {
    totalSize += item.audioBlob.size;
    if (item.status === 'pending') pendingCount++;
    if (item.status === 'failed') failedCount++;
    if (!oldestTimestamp || item.createdAt < oldestTimestamp) {
      oldestTimestamp = item.createdAt;
    }
  }
  
  return {
    count: all.length,
    pendingCount,
    failedCount,
    totalSizeKB: Math.round(totalSize / 1024),
    oldestTimestamp,
  };
}
