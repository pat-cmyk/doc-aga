import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { supabase } from '@/integrations/supabase/client';
import { calculateLifeStage, calculateMilkingStage } from './animalStages';
import { toast } from '@/hooks/use-toast';

// ============= CACHE PROGRESS SYSTEM =============

export interface CacheProgress {
  phase: 'animals' | 'records' | 'feed' | 'farm' | 'complete';
  current: number;
  total: number;
  message: string;
}

type CacheProgressListener = (progress: CacheProgress) => void;

const cacheProgressListeners: Set<CacheProgressListener> = new Set();

export function onCacheProgress(listener: CacheProgressListener) {
  cacheProgressListeners.add(listener);
  return () => {
    cacheProgressListeners.delete(listener);
  };
}

function emitProgress(progress: CacheProgress) {
  cacheProgressListeners.forEach(listener => listener(progress));
}

// ============= CACHE STATS =============

export interface CacheStats {
  animals: {
    count: number;
    lastUpdated: Date | null;
    isFresh: boolean; // < 30 min old
  };
  records: {
    count: number;
    lastUpdated: Date | null;
  };
  feedInventory: {
    itemCount: number;
    lastUpdated: Date | null;
  };
  isReady: boolean; // All critical data cached
}

export async function getCacheStats(farmId: string): Promise<CacheStats> {
  try {
    const db = await getDB();
    const [animalsCache, feedCache] = await Promise.all([
      db.get('animals', farmId),
      db.get('feedInventory', farmId),
    ]);

    const animalLastUpdated = animalsCache?.lastUpdated 
      ? new Date(animalsCache.lastUpdated) 
      : null;
    const animalsFresh = animalsCache?.lastUpdated 
      ? Date.now() - animalsCache.lastUpdated < 30 * 60 * 1000 
      : false;

    // Count total records cached
    const allRecords = await db.getAll('records');
    const totalRecords = allRecords.reduce((sum, r) => 
      sum + r.milking.length + r.weight.length + r.health.length + r.ai.length + r.feeding.length, 
      0
    );

    return {
      animals: {
        count: animalsCache?.data?.length || 0,
        lastUpdated: animalLastUpdated,
        isFresh: animalsFresh,
      },
      records: {
        count: totalRecords,
        lastUpdated: allRecords.length > 0 && allRecords[0]?.lastUpdated 
          ? new Date(allRecords[0].lastUpdated) 
          : null,
      },
      feedInventory: {
        itemCount: feedCache?.items?.length || 0,
        lastUpdated: feedCache?.lastUpdated ? new Date(feedCache.lastUpdated) : null,
      },
      isReady: (animalsCache?.data?.length || 0) > 0,
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return {
      animals: { count: 0, lastUpdated: null, isFresh: false },
      records: { count: 0, lastUpdated: null },
      feedInventory: { itemCount: 0, lastUpdated: null },
      isReady: false,
    };
  }
}

interface Animal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  breed: string | null;
  birth_date: string | null;
  gender: string | null;
  milking_start_date: string | null;
  current_weight_kg: number | null;
  mother_id?: string | null;
  father_id?: string | null;
  avatar_url?: string | null;
  life_stage?: string | null;
  milking_stage?: string | null;
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
  feeding: any[];
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

export async function updateAnimalCache(farmId: string, emitProgressUpdates = false): Promise<Animal[]> {
  try {
    const { data: animals, error } = await supabase
      .from('animals')
      .select('*')
      .eq('farm_id', farmId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    const totalAnimals = animals?.length || 0;
    
    // Pre-cache records for each animal (in background)
    if (animals && animals.length > 0 && emitProgressUpdates) {
      emitProgress({
        phase: 'records',
        current: 0,
        total: totalAnimals,
        message: 'Caching animal records...',
      });
      
      // Cache records with progress tracking
      for (let i = 0; i < animals.length; i++) {
        await updateRecordsCache(animals[i].id);
        if (emitProgressUpdates) {
          emitProgress({
            phase: 'records',
            current: i + 1,
            total: totalAnimals,
            message: `Caching records (${i + 1}/${totalAnimals})...`,
          });
        }
      }
    } else if (animals && animals.length > 0) {
      // Don't await - let this run in background (non-progress mode)
      Promise.all(animals.map(animal => updateRecordsCache(animal.id)))
        .catch(err => console.error('[DataCache] Error pre-caching records:', err));
    }

    // Calculate stages for each animal
    const animalsWithStages = await Promise.all(
      (animals || []).map(async (animal, index) => {
        if (emitProgressUpdates) {
          emitProgress({
            phase: 'animals',
            current: index + 1,
            total: totalAnimals,
            message: `Processing animals (${index + 1}/${totalAnimals})...`,
          });
        }
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
    const [milkingRes, weightRes, healthRes, aiRes, feedingRes] = await Promise.all([
      supabase.from('milking_records').select('*').eq('animal_id', animalId).order('record_date', { ascending: false }),
      supabase.from('weight_records').select('*').eq('animal_id', animalId).order('measurement_date', { ascending: false }),
      supabase.from('health_records').select('*').eq('animal_id', animalId).order('visit_date', { ascending: false }),
      supabase.from('ai_records').select('*').eq('animal_id', animalId).order('scheduled_date', { ascending: false }),
      supabase.from('feeding_records').select('*').eq('animal_id', animalId).order('record_datetime', { ascending: false }),
    ]);

    const cache: RecordCache = {
      animalId,
      milking: milkingRes.data || [],
      weight: weightRes.data || [],
      health: healthRes.data || [],
      ai: aiRes.data || [],
      feeding: feedingRes.data || [],
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
      feeding: [],
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

// ============= SINGLE ANIMAL CACHE =============

// Get single animal with all related data from cache
export async function getCachedAnimalDetails(animalId: string): Promise<{
  animal: Animal | null;
  mother: Animal | null;
  father: Animal | null;
  offspring: Animal[];
  records: RecordCache | null;
} | null> {
  try {
    const db = await getDB();
    
    // Get all animals from cache (to find parents/offspring)
    const allAnimalsCache = await db.get('animals', 'animals');
    if (!allAnimalsCache || !allAnimalsCache.data) return null;
    
    // Find the specific animal
    const animal = allAnimalsCache.data.find((a: Animal) => a.id === animalId);
    if (!animal) return null;
    
    // Find parents from the same cache
    const mother = animal.mother_id 
      ? allAnimalsCache.data.find((a: Animal) => a.id === animal.mother_id) || null
      : null;
    const father = animal.father_id
      ? allAnimalsCache.data.find((a: Animal) => a.id === animal.father_id) || null
      : null;
    
    // Find offspring from the same cache
    const offspring = allAnimalsCache.data.filter((a: Animal) => 
      a.mother_id === animalId || a.father_id === animalId
    );
    
    // Get records from cache
    const records = await getCachedRecords(animalId);
    
    return {
      animal,
      mother,
      father,
      offspring,
      records
    };
  } catch (error) {
    console.error('[DataCache] Error getting cached animal details:', error);
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

  // Show start toast
  toast({
    title: "📦 Preparing offline data...",
    description: "This will only take a moment",
  });

  try {
    // Phase 1: Animals
    emitProgress({
      phase: 'animals',
      current: 0,
      total: 100,
      message: 'Loading animals...',
    });
    
    const animals = await updateAnimalCache(farmId, true);
    
    // Phase 2: Feed Inventory
    emitProgress({
      phase: 'feed',
      current: 0,
      total: 1,
      message: 'Caching feed inventory...',
    });
    
    await updateFeedInventoryCache(farmId);
    
    // Phase 3: Farm Data
    emitProgress({
      phase: 'farm',
      current: 0,
      total: 1,
      message: 'Caching farm data...',
    });
    
    await updateFarmDataCache(farmId);
    
    // Complete
    emitProgress({
      phase: 'complete',
      current: 1,
      total: 1,
      message: 'Cache complete!',
    });

    console.log('[DataCache] Preload complete');
    
    // Get final stats for success message
    const stats = await getCacheStats(farmId);
    
    toast({
      title: "✅ Offline cache ready!",
      description: `${stats.animals.count} animals and ${stats.records.count} records available offline`,
      duration: 5000,
    });
  } catch (error) {
    console.error('[DataCache] Preload failed:', error);
    
    toast({
      title: "⚠️ Cache incomplete",
      description: "Some data may not be available offline",
      variant: "destructive",
    });
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
