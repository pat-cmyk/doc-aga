import { openDB, DBSchema, IDBPDatabase } from 'idb';

/**
 * Maximum number of items allowed in the offline queue
 * 
 * When limit is reached, oldest pending/completed items are removed to make room.
 * Prevents IndexedDB storage from growing unbounded.
 */
const MAX_QUEUE_SIZE = 50;

/**
 * Queue item representing an offline operation waiting to be synced
 * 
 * Stores all data needed to process voice recordings and animal form submissions
 * when internet connection is restored. Tracks retry attempts and processing status.
 */
interface QueueItem {
  id: string;
  type: 'voice_activity' | 'animal_form';
  payload: {
    audioBlob?: Blob;
    farmId?: string;
    animalId?: string | null;
    animalContext?: {
      name: string;
      ear_tag: string;
      gender?: string;
      breed?: string;
      birth_date?: string;
      life_stage?: string;
      farm_entry_date?: string;
    } | null;
    timestamp?: number;
    formData?: any;
    aiInfo?: {
      ai_bull_brand?: string;
      ai_bull_reference?: string;
      ai_bull_breed?: string;
      birth_date?: string;
    } | null;
    transcription?: string;
    transcriptionConfirmed?: boolean;
  };
  createdAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'awaiting_confirmation';
  retries: number;
  error?: string;
  processedAt?: number;
}

/**
 * IndexedDB schema for offline queue storage
 */
interface OfflineDB extends DBSchema {
  queue: {
    key: string;
    value: QueueItem;
    indexes: { 'by-status': string; 'by-createdAt': number };
  };
}

let dbInstance: IDBPDatabase<OfflineDB> | null = null;

/**
 * Get or initialize the IndexedDB database instance
 */
async function getDB() {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<OfflineDB>('docAgaOfflineDB', 1, {
    upgrade(db) {
      const store = db.createObjectStore('queue', { keyPath: 'id' });
      store.createIndex('by-status', 'status');
      store.createIndex('by-createdAt', 'createdAt');
    },
  });

  return dbInstance;
}

/**
 * Add a new item to the offline queue
 */
export async function addToQueue(item: Omit<QueueItem, 'retries' | 'status'> & { status?: QueueItem['status'] }): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('queue', 'readwrite');
  
  const count = await tx.store.count();
  
  if (count >= MAX_QUEUE_SIZE) {
    const oldest = await tx.store.index('by-createdAt').openCursor();
    if (oldest) {
      await oldest.delete();
    }
  }
  
  await tx.store.add({
    ...item,
    status: item.status || 'pending',
    retries: 0,
  } as QueueItem);
  
  await tx.done;
}

/**
 * Get all pending queue items ready for processing
 */
export async function getAllPending(): Promise<QueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('queue', 'by-status', 'pending');
}

/**
 * Get all queue items regardless of status
 */
export async function getAll(): Promise<QueueItem[]> {
  const db = await getDB();
  return db.getAll('queue');
}

/**
 * Update the processing status of a queue item
 */
export async function updateStatus(
  id: string,
  status: QueueItem['status'],
  error?: string
): Promise<void> {
  const db = await getDB();
  const item = await db.get('queue', id);
  
  if (item) {
    item.status = status;
    item.error = error;
    if (status === 'completed' || status === 'failed') {
      item.processedAt = Date.now();
    }
    await db.put('queue', item);
  }
}

/**
 * Increment the retry counter for a failed queue item
 */
export async function incrementRetries(id: string): Promise<number> {
  const db = await getDB();
  const item = await db.get('queue', id);
  
  if (item) {
    item.retries++;
    await db.put('queue', item);
    return item.retries;
  }
  
  return 0;
}

/**
 * Remove a single item from the queue
 */
export async function removeItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('queue', id);
}

/**
 * Remove all completed items from the queue
 */
export async function clearCompleted(): Promise<void> {
  const db = await getDB();
  const completed = await db.getAllFromIndex('queue', 'by-status', 'completed');
  
  for (const item of completed) {
    await db.delete('queue', item.id);
  }
}

/**
 * Get total count of all items in queue
 */
export async function getQueueCount(): Promise<number> {
  const db = await getDB();
  return db.count('queue');
}

/**
 * Get count of pending items waiting to sync
 */
export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return db.countFromIndex('queue', 'by-status', 'pending');
}

/**
 * Reset a failed item for retry
 */
export async function resetForRetry(id: string): Promise<void> {
  const db = await getDB();
  const item = await db.get('queue', id);
  
  if (item) {
    item.status = 'pending';
    item.retries = 0;
    item.error = undefined;
    await db.put('queue', item);
  }
}

/**
 * Update multiple fields of a queue item
 */
export async function updateItem(id: string, changes: Partial<QueueItem>): Promise<void> {
  const db = await getDB();
  const item = await db.get('queue', id);
  
  if (item) {
    Object.assign(item, changes);
    await db.put('queue', item);
  }
}

/**
 * Update specific fields in a queue item's payload
 */
export async function updatePayload(id: string, payloadChanges: Partial<QueueItem['payload']>): Promise<void> {
  const db = await getDB();
  const item = await db.get('queue', id);
  
  if (item) {
    Object.assign(item.payload, payloadChanges);
    await db.put('queue', item);
  }
}

/**
 * Set queue item to awaiting user confirmation state
 */
export async function setAwaitingConfirmation(id: string, transcription: string): Promise<void> {
  const db = await getDB();
  const item = await db.get('queue', id);
  
  if (item) {
    item.status = 'awaiting_confirmation';
    item.payload.transcription = transcription;
    item.retries = 0;
    item.error = undefined;
    await db.put('queue', item);
  }
}

/**
 * Confirm transcription and mark item ready for processing
 */
export async function confirmTranscription(id: string, transcription: string): Promise<void> {
  const db = await getDB();
  const item = await db.get('queue', id);
  
  if (item) {
    item.payload.transcription = transcription;
    item.payload.transcriptionConfirmed = true;
    item.status = 'pending';
    await db.put('queue', item);
  }
}

export type { QueueItem };
