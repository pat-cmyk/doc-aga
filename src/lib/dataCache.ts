import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { supabase } from '@/integrations/supabase/client';
import { calculateLifeStage, calculateMilkingStage, calculateMaleStage } from './animalStages';

// Helper to create system notification in database
async function createSystemNotification(title: string, body: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'system',
        title,
        body,
        read: false
      });
    }
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

// ============= CACHE PROGRESS SYSTEM =============

/**
 * Progress information for cache preloading operations
 * 
 * Used to show real-time progress during offline cache population.
 * Each phase represents a different data category being cached.
 */
export interface CacheProgress {
  phase: 'animals' | 'records' | 'feed' | 'farm' | 'complete';
  current: number;
  total: number;
  message: string;
}

type CacheProgressListener = (progress: CacheProgress) => void;

const cacheProgressListeners: Set<CacheProgressListener> = new Set();

/**
 * Subscribe to cache preloading progress updates
 * 
 * Allows UI components to show real-time progress during offline cache population.
 * Returns unsubscribe function for cleanup.
 * 
 * @param listener - Callback function that receives progress updates
 * @returns Unsubscribe function to remove listener
 * 
 * @example
 * ```typescript
 * useEffect(() => {
 *   const unsubscribe = onCacheProgress((progress) => {
 *     console.log(`${progress.phase}: ${progress.current}/${progress.total}`);
 *     setProgress(progress);
 *   });
 *   return unsubscribe;
 * }, []);
 * ```
 */
export function onCacheProgress(listener: CacheProgressListener) {
  cacheProgressListeners.add(listener);
  return () => {
    cacheProgressListeners.delete(listener);
  };
}

/**
 * Internal function to emit progress updates to all subscribers
 */
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

/**
 * Get comprehensive statistics about cached data for a farm
 * 
 * Returns counts and freshness information for all cache categories.
 * Used to display cache status in UI and determine if data needs refreshing.
 * 
 * @param farmId - UUID of the farm to check cache stats for
 * @returns Promise resolving to cache statistics object
 * 
 * @example
 * ```typescript
 * const stats = await getCacheStats(farmId);
 * console.log(`${stats.animals.count} animals cached`);
 * console.log(`Cache is ${stats.isReady ? 'ready' : 'not ready'}`);
 * if (!stats.animals.isFresh) {
 *   await refreshAllCaches(farmId, isOnline);
 * }
 * ```
 */
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

    // Get animal IDs for this farm
    const farmAnimalIds = new Set(
      (animalsCache?.data || []).map(animal => animal.id)
    );

    // Count total records cached FOR THIS FARM ONLY
    const allRecords = await db.getAll('records');
    const totalRecords = allRecords
      .filter(r => farmAnimalIds.has(r.animalId)) // Only count records for this farm's animals
      .reduce((sum, r) => 
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
  livestock_type: string; // NEW
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
  unique_code?: string | null;
  farm_entry_date?: string | null;
  birth_date_unknown?: boolean | null;
  mother_unknown?: boolean | null;
  father_unknown?: boolean | null;
  entry_weight_kg?: number | null;
  entry_weight_unknown?: boolean | null;
  birth_weight_kg?: number | null;
  acquisition_type?: string | null;
  purchase_price?: number | null;
  grant_source?: string | null;
  grant_source_other?: string | null;
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

/**
 * Get or initialize the IndexedDB database instance for data caching
 * 
 * Creates database and object stores on first access. Subsequent calls
 * return cached instance for better performance.
 * 
 * @returns Promise resolving to IndexedDB database instance
 */
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

/**
 * Retrieve cached animal data for a farm (if valid)
 * 
 * Returns cached animals only if cache is fresh (within TTL).
 * Includes calculated life stages and milking stages for female cattle.
 * 
 * @param farmId - UUID of the farm
 * @returns Promise resolving to cached animal data or null if expired/missing
 * 
 * @example
 * ```typescript
 * const cached = await getCachedAnimals(farmId);
 * if (cached) {
 *   setAnimals(cached.data);
 * } else {
 *   // Cache miss - fetch from server
 *   const fresh = await updateAnimalCache(farmId);
 *   setAnimals(fresh);
 * }
 * ```
 */
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

/**
 * Fetch and cache all animals for a farm from Supabase
 * 
 * Retrieves animals from database, calculates life/milking stages, and pre-caches
 * all animal records for offline use. Optionally emits progress updates for UI.
 * 
 * @param farmId - UUID of the farm
 * @param emitProgressUpdates - Whether to emit real-time progress (for preload UI)
 * @returns Promise resolving to array of cached animals with stages
 * 
 * @example
 * ```typescript
 * // Simple cache update
 * const animals = await updateAnimalCache(farmId);
 * 
 * // Update with progress tracking
 * const animals = await updateAnimalCache(farmId, true);
 * // Progress events are emitted via onCacheProgress listeners
 * ```
 */
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

    // Calculate stages for each animal (both male and female)
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
        
        const isMale = animal.gender?.toLowerCase() === 'male';
        const isFemale = animal.gender?.toLowerCase() === 'female';
        
        // If no valid gender, return without stage calculation
        if (!isMale && !isFemale) {
          return { ...animal, lifeStage: null, milkingStage: null };
        }

        // Get offspring count (for both males and females)
        const { count: offspringCount } = await supabase
          .from('animals')
          .select('*', { count: 'exact', head: true })
          .or(`mother_id.eq.${animal.id},father_id.eq.${animal.id}`);

        // Get last calving date
        const { data: offspring } = await supabase
          .from('animals')
          .select('birth_date')
          .or(`mother_id.eq.${animal.id},father_id.eq.${animal.id}`)
          .order('birth_date', { ascending: false })
          .limit(1);

        // Check for recent milking records (only relevant for females)
        let hasRecentMilking = false;
        if (isFemale) {
          const { data: recentMilking } = await supabase
            .from('milking_records')
            .select('id')
            .eq('animal_id', animal.id)
            .gte('record_date', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
            .limit(1);
          hasRecentMilking = (recentMilking?.length || 0) > 0;
        }

        // Check for active AI records (only relevant for females)
        let hasActiveAI = false;
        if (isFemale) {
          const { data: aiRecords } = await supabase
            .from('ai_records')
            .select('performed_date')
            .eq('animal_id', animal.id)
            .order('scheduled_date', { ascending: false })
            .limit(1);
          hasActiveAI = (aiRecords?.length || 0) > 0 && !offspringCount;
        }

        const stageData = {
          birthDate: animal.birth_date ? new Date(animal.birth_date) : null,
          gender: animal.gender,
          milkingStartDate: animal.milking_start_date ? new Date(animal.milking_start_date) : null,
          offspringCount: offspringCount || 0,
          lastCalvingDate: offspring?.[0]?.birth_date ? new Date(offspring[0].birth_date) : null,
          hasRecentMilking,
          hasActiveAI,
          livestockType: animal.livestock_type,
        };

        // Calculate life stage based on gender
        let lifeStage: string | null = null;
        let milkingStage: string | null = null;
        
        if (isMale) {
          lifeStage = calculateMaleStage(stageData);
          milkingStage = null; // Males don't have milking stages
        } else {
          lifeStage = calculateLifeStage(stageData);
          milkingStage = calculateMilkingStage(stageData);
        }

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

/**
 * Retrieve cached records for a specific animal (if valid)
 * 
 * Returns all record types (milking, weight, health, AI, feeding) for an animal
 * only if cache is fresh (within TTL).
 * 
 * @param animalId - UUID of the animal
 * @returns Promise resolving to cached records or null if expired/missing
 */
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

/**
 * Fetch and cache all records for a specific animal from Supabase
 * 
 * Retrieves all record types in parallel and stores them for offline access.
 * Called automatically during animal cache updates.
 * 
 * @param animalId - UUID of the animal
 * @returns Promise resolving to cached records object
 */
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

/**
 * Retrieve cached feed inventory for a farm (if valid)
 * 
 * @param farmId - UUID of the farm
 * @returns Promise resolving to cached feed inventory or null if expired/missing
 */
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

/**
 * Fetch and cache feed inventory for a farm from Supabase
 * 
 * @param farmId - UUID of the farm
 * @returns Promise resolving to array of cached feed items
 */
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

/**
 * Retrieve cached farm data including info and team members (if valid)
 * 
 * @param farmId - UUID of the farm
 * @returns Promise resolving to cached farm data or null if expired/missing
 */
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

/**
 * Fetch and cache farm data including info and team members from Supabase
 * 
 * @param farmId - UUID of the farm
 * @returns Promise resolving to cached farm data object
 */
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

/**
 * Get complete animal details including parents, offspring, and records from cache
 * 
 * Retrieves a single animal with all related data for the animal details page.
 * More efficient than separate queries when all data is needed together.
 * 
 * @param animalId - UUID of the animal
 * @param farmId - UUID of the farm (needed to find all farm animals)
 * @returns Promise resolving to object with animal, parents, offspring, and records or null
 * 
 * @example
 * ```typescript
 * const details = await getCachedAnimalDetails(animalId, farmId);
 * if (details) {
 *   console.log(`Animal: ${details.animal.name}`);
 *   console.log(`Mother: ${details.mother?.name || 'Unknown'}`);
 *   console.log(`Offspring: ${details.offspring.length}`);
 *   console.log(`Milking records: ${details.records?.milking.length || 0}`);
 * }
 * ```
 */
export async function getCachedAnimalDetails(animalId: string, farmId: string): Promise<{
  animal: Animal | null;
  mother: Animal | null;
  father: Animal | null;
  offspring: Animal[];
  records: RecordCache | null;
} | null> {
  try {
    const db = await getDB();
    
    // Get all animals from cache (to find parents/offspring)
    const allAnimalsCache = await db.get('animals', farmId);
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

/**
 * Check if an animal and its records are fully available in cache
 * 
 * Useful for determining whether to show cached data or fetch from server.
 * 
 * @param animalId - UUID of the animal
 * @param farmId - UUID of the farm
 * @returns Promise resolving to true if both animal and records are cached
 * 
 * @example
 * ```typescript
 * const isCached = await isAnimalFullyCached(animalId, farmId);
 * if (isCached) {
 *   loadFromCache();
 * } else {
 *   fetchFromServer();
 * }
 * ```
 */
export async function isAnimalFullyCached(animalId: string, farmId: string): Promise<boolean> {
  try {
    const details = await getCachedAnimalDetails(animalId, farmId);
    const records = await getCachedRecords(animalId);
    return !!(details && records);
  } catch (error) {
    console.error('[DataCache] Error checking if animal is fully cached:', error);
    return false;
  }
}

// ============= BULK OPERATIONS =============

/**
 * Preload all critical farm data into offline cache with progress updates
 * 
 * Orchestrates the complete cache population workflow:
 * 1. Animals and their records
 * 2. Feed inventory
 * 3. Farm data and team members
 * 
 * Shows toast notifications and emits progress events for UI feedback.
 * Only runs when online - skips if offline.
 * 
 * @param farmId - UUID of the farm
 * @param isOnline - Whether app currently has internet connection
 * 
 * @example
 * ```typescript
 * // Typically called on app startup or farm switch
 * useEffect(() => {
 *   if (farmId && isOnline) {
 *     preloadAllData(farmId, isOnline);
 *   }
 * }, [farmId, isOnline]);
 * ```
 */
export async function preloadAllData(farmId: string, isOnline: boolean) {
  if (!isOnline) {
    console.log('[DataCache] Offline - skipping preload');
    return;
  }

  console.log('[DataCache] Preloading critical data for farm:', farmId);

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
      message: 'Caching feeds...',
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
    
    await createSystemNotification(
      "Offline Cache Ready",
      `${stats.animals.count} animals and ${stats.records.count} records available offline`
    );
  } catch (error) {
    console.error('[DataCache] Preload failed:', error);
    
    await createSystemNotification(
      "Cache Incomplete",
      "Some data may not be available offline"
    );
  }
}

/**
 * Silently refresh all caches in the background
 * 
 * Updates animals and feed inventory without progress notifications.
 * Used for periodic cache updates during normal app usage.
 * 
 * @param farmId - UUID of the farm
 * @param isOnline - Whether app currently has internet connection
 * 
 * @example
 * ```typescript
 * // Refresh cache periodically
 * setInterval(() => {
 *   if (isOnline) {
 *     refreshAllCaches(farmId, isOnline);
 *   }
 * }, 5 * 60 * 1000); // Every 5 minutes
 * ```
 */
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

/**
 * Clear all cached data from IndexedDB
 * 
 * Removes all animals, records, feed inventory, and farm data.
 * Typically called on logout or when switching farms.
 * 
 * @example
 * ```typescript
 * // Clear cache on logout
 * const handleLogout = async () => {
 *   await clearAllCaches();
 *   await supabase.auth.signOut();
 * };
 * ```
 */
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
