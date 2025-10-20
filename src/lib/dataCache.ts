import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { supabase } from '@/integrations/supabase/client';
import { calculateLifeStage, calculateMilkingStage } from './animalStages';

interface Animal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  breed: string | null;
  birth_date: string | null;
  gender: string | null;
  milking_start_date: string | null;
  current_weight_kg: number | null;
  lifeStage?: string | null;
  milkingStage?: string | null;
}

interface AnimalDataCache {
  farmId: string;
  data: Animal[];
  lastUpdated: number;
  version: number;
}

interface RecordCache {
  animalId: string;
  milking: any[];
  weight: any[];
  health: any[];
  ai: any[];
  lastUpdated: number;
}

interface FeedInventoryCache {
  farmId: string;
  items: any[];
  lastUpdated: number;
}

interface FarmDataCache {
  farmId: string;
  info: any;
  members: any[];
  lastUpdated: number;
}

interface DataCacheDB extends DBSchema {
  animals: {
    key: string;
    value: AnimalDataCache;
  };
  records: {
    key: string;
    value: RecordCache;
  };
  feedInventory: {
    key: string;
    value: FeedInventoryCache;
  };
  farmData: {
    key: string;
    value: FarmDataCache;
  };
}

// Cache expiration times (in milliseconds)
const CACHE_TTL = {
  animals: 60 * 60 * 1000, // 1 hour
  records: 30 * 60 * 1000, // 30 minutes
  feedInventory: 2 * 60 * 60 * 1000, // 2 hours
  farmData: 24 * 60 * 60 * 1000, // 24 hours
};

let dbInstance: IDBPDatabase<DataCacheDB> | null = null;

async function getDB() {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<DataCacheDB>('dataCacheDB', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('animals')) {
        db.createObjectStore('animals', { keyPath: 'farmId' });
      }
      if (!db.objectStoreNames.contains('records')) {
        db.createObjectStore('records', { keyPath: 'animalId' });
      }
      if (!db.objectStoreNames.contains('feedInventory')) {
        db.createObjectStore('feedInventory', { keyPath: 'farmId' });
      }
      if (!db.objectStoreNames.contains('farmData')) {
        db.createObjectStore('farmData', { keyPath: 'farmId' });
      }
    },
  });

  return dbInstance;
}

// ============= ANIMAL CACHE =============

export async function getCachedAnimals(farmId: string): Promise<AnimalDataCache | null> {
  try {
    const db = await getDB();
    const cached = await db.get('animals', farmId);

    if (!cached) return null;

    const isValid = Date.now() - cached.lastUpdated < CACHE_TTL.animals;
    return isValid ? cached : null;
  } catch (error) {
    console.error('Error reading animal cache:', error);
    return null;
  }
}

export async function updateAnimalCache(farmId: string): Promise<Animal[]> {
  try {
    const { data: animals, error } = await supabase
      .from('animals')
      .select('*')
      .eq('farm_id', farmId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Calculate stages for each animal
    const animalsWithStages = await Promise.all(
      (animals || []).map(async (animal) => {
        if (animal.gender?.toLowerCase() !== 'female') {
          return { ...animal, lifeStage: null, milkingStage: null };
        }

        // Get offspring count
        const { count: offspringCount } = await supabase
          .from('animals')
          .select('*', { count: 'exact', head: true })
          .eq('mother_id', animal.id);

        // Get last calving date
        const { data: offspring } = await supabase
          .from('animals')
          .select('birth_date')
          .eq('mother_id', animal.id)
          .order('birth_date', { ascending: false })
          .limit(1);

        // Check for recent milking records
        const { data: recentMilking } = await supabase
          .from('milking_records')
          .select('id')
          .eq('animal_id', animal.id)
          .gte('record_date', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        // Check for active AI records
        const { data: aiRecords } = await supabase
          .from('ai_records')
          .select('performed_date')
          .eq('animal_id', animal.id)
          .order('scheduled_date', { ascending: false })
          .limit(1);

        const stageData = {
          birthDate: animal.birth_date ? new Date(animal.birth_date) : null,
          gender: animal.gender,
          milkingStartDate: animal.milking_start_date ? new Date(animal.milking_start_date) : null,
          offspringCount: offspringCount || 0,
          lastCalvingDate: offspring?.[0]?.birth_date ? new Date(offspring[0].birth_date) : null,
          hasRecentMilking: (recentMilking?.length || 0) > 0,
          hasActiveAI: (aiRecords?.length || 0) > 0 && !offspringCount,
        };

        const lifeStage = calculateLifeStage(stageData);
        const milkingStage = calculateMilkingStage(stageData);

        return { ...animal, lifeStage, milkingStage };
      })
    );

    const cache: AnimalDataCache = {
      farmId,
      data: animalsWithStages,
      lastUpdated: Date.now(),
      version: 1,
    };

    const db = await getDB();
    await db.put('animals', cache);

    return animalsWithStages;
  } catch (error) {
    console.error('Failed to update animal cache:', error);
    return [];
  }
}

// ============= RECORDS CACHE =============

export async function getCachedRecords(animalId: string): Promise<RecordCache | null> {
  try {
    const db = await getDB();
    const cached = await db.get('records', animalId);

    if (!cached) return null;

    const isValid = Date.now() - cached.lastUpdated < CACHE_TTL.records;
    return isValid ? cached : null;
  } catch (error) {
    console.error('Error reading records cache:', error);
    return null;
  }
}

export async function updateRecordsCache(animalId: string): Promise<RecordCache> {
  try {
    const [milkingRes, weightRes, healthRes, aiRes] = await Promise.all([
      supabase.from('milking_records').select('*').eq('animal_id', animalId).order('record_date', { ascending: false }),
      supabase.from('weight_records').select('*').eq('animal_id', animalId).order('measurement_date', { ascending: false }),
      supabase.from('health_records').select('*').eq('animal_id', animalId).order('visit_date', { ascending: false }),
      supabase.from('ai_records').select('*').eq('animal_id', animalId).order('scheduled_date', { ascending: false }),
    ]);

    const cache: RecordCache = {
      animalId,
      milking: milkingRes.data || [],
      weight: weightRes.data || [],
      health: healthRes.data || [],
      ai: aiRes.data || [],
      lastUpdated: Date.now(),
    };

    const db = await getDB();
    await db.put('records', cache);

    return cache;
  } catch (error) {
    console.error('Failed to update records cache:', error);
    return {
      animalId,
      milking: [],
      weight: [],
      health: [],
      ai: [],
      lastUpdated: Date.now(),
    };
  }
}

// ============= FEED INVENTORY CACHE =============

export async function getCachedFeedInventory(farmId: string): Promise<FeedInventoryCache | null> {
  try {
    const db = await getDB();
    const cached = await db.get('feedInventory', farmId);

    if (!cached) return null;

    const isValid = Date.now() - cached.lastUpdated < CACHE_TTL.feedInventory;
    return isValid ? cached : null;
  } catch (error) {
    console.error('Error reading feed inventory cache:', error);
    return null;
  }
}

export async function updateFeedInventoryCache(farmId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('feed_inventory')
      .select('*')
      .eq('farm_id', farmId);

    if (error) throw error;

    const cache: FeedInventoryCache = {
      farmId,
      items: data || [],
      lastUpdated: Date.now(),
    };

    const db = await getDB();
    await db.put('feedInventory', cache);

    return data || [];
  } catch (error) {
    console.error('Failed to update feed inventory cache:', error);
    return [];
  }
}

// ============= FARM DATA CACHE =============

export async function getCachedFarmData(farmId: string): Promise<FarmDataCache | null> {
  try {
    const db = await getDB();
    const cached = await db.get('farmData', farmId);

    if (!cached) return null;

    const isValid = Date.now() - cached.lastUpdated < CACHE_TTL.farmData;
    return isValid ? cached : null;
  } catch (error) {
    console.error('Error reading farm data cache:', error);
    return null;
  }
}

export async function updateFarmDataCache(farmId: string): Promise<FarmDataCache | null> {
  try {
    const [farmRes, membersRes] = await Promise.all([
      supabase.from('farms').select('*').eq('id', farmId).single(),
      supabase.from('farm_memberships').select('*').eq('farm_id', farmId),
    ]);

    if (farmRes.error) throw farmRes.error;

    const cache: FarmDataCache = {
      farmId,
      info: farmRes.data,
      members: membersRes.data || [],
      lastUpdated: Date.now(),
    };

    const db = await getDB();
    await db.put('farmData', cache);

    return cache;
  } catch (error) {
    console.error('Failed to update farm data cache:', error);
    return null;
  }
}

// ============= BULK OPERATIONS =============

export async function preloadAllData(farmId: string, isOnline: boolean) {
  if (!isOnline) {
    console.log('[DataCache] Offline - skipping preload');
    return;
  }

  console.log('[DataCache] Preloading critical data for farm:', farmId);

  try {
    await Promise.all([
      updateAnimalCache(farmId),
      updateFeedInventoryCache(farmId),
      updateFarmDataCache(farmId),
    ]);

    console.log('[DataCache] Preload complete');
  } catch (error) {
    console.error('[DataCache] Preload failed:', error);
  }
}

export async function refreshAllCaches(farmId: string, isOnline: boolean) {
  if (!isOnline) return;

  console.log('[DataCache] Refreshing all caches...');

  try {
    await Promise.all([
      updateAnimalCache(farmId),
      updateFeedInventoryCache(farmId),
    ]);

    console.log('[DataCache] Cache refresh complete');
  } catch (error) {
    console.error('[DataCache] Cache refresh failed:', error);
  }
}

export async function clearAllCaches() {
  try {
    const db = await getDB();
    await Promise.all([
      db.clear('animals'),
      db.clear('records'),
      db.clear('feedInventory'),
      db.clear('farmData'),
    ]);
    console.log('[DataCache] All caches cleared');
  } catch (error) {
    console.error('[DataCache] Failed to clear caches:', error);
  }
}
