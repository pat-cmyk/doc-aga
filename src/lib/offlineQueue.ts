import { openDB, DBSchema, IDBPDatabase } from 'idb';

const MAX_QUEUE_SIZE = 50;

interface QueueItem {
  id: string;
  type: 'voice_activity' | 'animal_form';
  payload: {
    audioBlob?: Blob;
    farmId?: string;
    animalId?: string | null;
    timestamp?: number;
    formData?: any;
  };
  createdAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retries: number;
  error?: string;
  processedAt?: number;
}

interface OfflineDB extends DBSchema {
  queue: {
    key: string;
    value: QueueItem;
    indexes: { 'by-status': string; 'by-createdAt': number };
  };
}

let dbInstance: IDBPDatabase<OfflineDB> | null = null;

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

export async function addToQueue(item: Omit<QueueItem, 'retries' | 'status'> & { status?: QueueItem['status'] }): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('queue', 'readwrite');
  
  // Check queue size
  const count = await tx.store.count();
  
  if (count >= MAX_QUEUE_SIZE) {
    // Remove oldest pending/completed item
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

export async function getAllPending(): Promise<QueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('queue', 'by-status', 'pending');
}

export async function getAll(): Promise<QueueItem[]> {
  const db = await getDB();
  return db.getAll('queue');
}

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

export async function removeItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('queue', id);
}

export async function clearCompleted(): Promise<void> {
  const db = await getDB();
  const completed = await db.getAllFromIndex('queue', 'by-status', 'completed');
  
  for (const item of completed) {
    await db.delete('queue', item.id);
  }
}

export async function getQueueCount(): Promise<number> {
  const db = await getDB();
  return db.count('queue');
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return db.countFromIndex('queue', 'by-status', 'pending');
}

export type { QueueItem };
