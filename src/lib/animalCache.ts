import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { supabase } from '@/integrations/supabase/client';

interface AnimalCache {
  farmId: string;
  mothers: Array<{ id: string; name: string; ear_tag: string; breed?: string }>;
  fathers: Array<{ id: string; name: string; ear_tag: string; breed?: string }>;
  lastUpdated: number;
}

interface CacheDB extends DBSchema {
  animalCache: {
    key: string;
    value: AnimalCache;
  };
}

const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

let dbInstance: IDBPDatabase<CacheDB> | null = null;

async function getDB() {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<CacheDB>('animalCacheDB', 1, {
    upgrade(db) {
      db.createObjectStore('animalCache', { keyPath: 'farmId' });
    },
  });

  return dbInstance;
}

export async function getCachedAnimals(farmId: string): Promise<AnimalCache | null> {
  const db = await getDB();
  const cached = await db.get('animalCache', farmId);

  if (!cached) return null;

  // Check if cache is still valid (30 minutes)
  const isValid = Date.now() - cached.lastUpdated < CACHE_DURATION_MS;
  
  return isValid ? cached : null;
}

export async function updateAnimalCache(farmId: string, isOnline: boolean): Promise<AnimalCache | null> {
  if (!isOnline) {
    // Return cached data if offline
    return getCachedAnimals(farmId);
  }

  try {
    const { data: animals, error } = await supabase
      .from('animals')
      .select('id, name, ear_tag, breed, gender, birth_date')
      .eq('farm_id', farmId)
      .eq('is_deleted', false);

    if (error) throw error;

    const sixteenMonthsAgo = new Date();
    sixteenMonthsAgo.setMonth(sixteenMonthsAgo.getMonth() - 16);

    const mothers = (animals || [])
      .filter(a => 
        a.gender?.toLowerCase() === 'female' &&
        a.birth_date &&
        new Date(a.birth_date) <= sixteenMonthsAgo
      )
      .map(a => ({ id: a.id, name: a.name || '', ear_tag: a.ear_tag || '', breed: a.breed }));

    const fathers = (animals || [])
      .filter(a => 
        a.gender?.toLowerCase() === 'male' &&
        a.birth_date &&
        new Date(a.birth_date) <= sixteenMonthsAgo
      )
      .map(a => ({ id: a.id, name: a.name || '', ear_tag: a.ear_tag || '', breed: a.breed }));

    const cache: AnimalCache = {
      farmId,
      mothers,
      fathers,
      lastUpdated: Date.now(),
    };

    const db = await getDB();
    await db.put('animalCache', cache);

    return cache;
  } catch (error) {
    console.error('Failed to update animal cache:', error);
    // Return stale cache if update fails
    return getCachedAnimals(farmId);
  }
}

export async function clearCache(farmId?: string): Promise<void> {
  const db = await getDB();
  
  if (farmId) {
    await db.delete('animalCache', farmId);
  } else {
    await db.clear('animalCache');
  }
}
