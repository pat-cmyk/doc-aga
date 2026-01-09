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
/**
 * Queue item representing an offline operation waiting to be synced
 * 
 * Stores all data needed to process voice recordings and animal form submissions
 * when internet connection is restored. Tracks retry attempts and processing status.
 * 
 * Phase 2: Added optimistic update support fields
 */
interface QueueItem {
  id: string;
  type: 'voice_activity' | 'animal_form' | 'bulk_milk' | 'single_milk' | 'bulk_feed' | 'bulk_health' | 'single_health' | 'voice_form_input';
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
    initialWeight?: {
      type: 'entry' | 'birth';
      weight_kg: number;
      measurement_date: string;
    } | null;
    transcription?: string;
    transcriptionConfirmed?: boolean;
    // Bulk milk recording
    milkRecords?: Array<{
      animalId: string;
      animalName: string;
      liters: number;
      recordDate: string;
      session: 'AM' | 'PM';
    }>;
    // Single milk recording (from animal profile)
    singleMilk?: {
      animalId: string;
      animalName: string | null;
      earTag: string | null;
      liters: number;
      recordDate: string;
      session: 'AM' | 'PM';
    };
    // Bulk feed recording
    feedRecords?: Array<{
      animalId: string;
      animalName: string;
      kilograms: number;
      cost?: number;
    }>;
    feedType?: string;
    feedInventoryId?: string;
    totalKg?: number;
    recordDate?: string;
    // Bulk health recording
    healthRecords?: Array<{
      animalId: string;
      animalName: string;
    }>;
    diagnosis?: string;
    treatment?: string;
    notes?: string;
    // Single health recording (from animal profile)
    singleHealth?: {
      animalId: string;
      animalName: string | null;
      visitDate: string;
      category?: string;
      diagnosis: string;
      treatment?: string;
      notes?: string;
    };
    // Voice form input (unified component)
    voiceFormInput?: {
      audioBlob: Blob;
      extractorType: 'milk' | 'feed' | 'text' | 'custom';
      extractorContext?: any;
      formType: string;
      dialogId?: string;
    };
  };
  createdAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'awaiting_confirmation';
  retries: number;
  error?: string;
  processedAt?: number;
  
  // Phase 2: Optimistic update support
  /** Temporary ID for instant UI display before server confirms */
  optimisticId: string;
  /** Server response after successful sync */
  serverResponse?: any;
  /** Server data if conflict detected during sync */
  conflictData?: any;
  /** Version when edit started (for conflict detection) */
  baseVersion?: number;
  /** Only the changed fields (for partial updates) */
  localChanges?: Record<string, any>;
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
 * 
 * Auto-generates optimisticId if not provided for tracking optimistic updates.
 * Triggers background sync if online.
 */
export async function addToQueue(
  item: Omit<QueueItem, 'retries' | 'status' | 'optimisticId'> & { 
    status?: QueueItem['status'];
    optimisticId?: string;
  }
): Promise<string> {
  const db = await getDB();
  const tx = db.transaction('queue', 'readwrite');
  
  const count = await tx.store.count();
  
  if (count >= MAX_QUEUE_SIZE) {
    const oldest = await tx.store.index('by-createdAt').openCursor();
    if (oldest) {
      await oldest.delete();
    }
  }
  
  // Auto-generate optimisticId if not provided
  const optimisticId = item.optimisticId || crypto.randomUUID();
  
  await tx.store.add({
    ...item,
    status: item.status || 'pending',
    retries: 0,
    optimisticId,
  } as QueueItem);
  
  await tx.done;
  
  // Trigger background sync if online
  if (navigator.onLine) {
    // Dynamically import to avoid circular dependencies
    import('./swBridge').then(({ requestBackgroundSync }) => {
      requestBackgroundSync();
    }).catch(() => {
      // Silently fail if bridge not available
    });
  }
  
  return optimisticId;
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

/**
 * Reset all failed items back to pending status
 * Used for bulk retry of stuck items
 */
export async function resetAllFailed(): Promise<number> {
  const db = await getDB();
  const failed = await db.getAllFromIndex('queue', 'by-status', 'failed');
  
  let resetCount = 0;
  for (const item of failed) {
    item.status = 'pending';
    item.retries = 0;
    item.error = undefined;
    await db.put('queue', item);
    resetCount++;
  }
  
  return resetCount;
}

/**
 * Get all failed items for review
 */
export async function getAllFailed(): Promise<QueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('queue', 'by-status', 'failed');
}

export type { QueueItem };
