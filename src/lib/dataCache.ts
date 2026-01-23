import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { supabase } from '@/integrations/supabase/client';
import { calculateLifeStage, calculateMilkingStage, calculateMaleStage } from './animalStages';
import { calculateConsumptionFromCounts } from './feedConsumption';

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

// ============= SYNC STATUS TYPES (Phase 1 - Offline First) =============

/**
 * Sync status for cached items
 * - synced: Data matches server
 * - pending: Local changes waiting to sync
 * - conflict: Server has different version
 * - error: Sync failed, needs retry
 */
export type CacheSyncStatus = 'synced' | 'pending' | 'conflict' | 'error';

interface AnimalDataCache {
  farmId: string;
  data: Animal[];
  lastUpdated: number;
  version: number;
  // Offline-first additions
  syncStatus: CacheSyncStatus;
  serverVersion?: number;
  lastSyncedAt?: number; // When data was last confirmed with server
}

interface RecordCache {
  animalId: string;
  milking: any[];
  weight: any[];
  health: any[];
  ai: any[];
  feeding: any[];
  lastUpdated: number;
  // Offline-first additions
  syncStatus: CacheSyncStatus;
  pendingChanges?: number; // Count of unsynced local changes
}

interface FeedInventoryCache {
  farmId: string;
  items: any[];
  lastUpdated: number;
  // Offline-first additions
  syncStatus: CacheSyncStatus;
  // Computed summary for offline use
  summary?: {
    totalKg: number;
    concentrateKg: number;
    roughageKg: number;
    mineralsKg: number;
    supplementsKg: number;
  };
  // Cached daily consumption for offline calculations
  dailyConsumption?: number;
}

interface FarmDataCache {
  farmId: string;
  info: any;
  members: any[];
  lastUpdated: number;
  // Offline-first additions
  syncStatus: CacheSyncStatus;
}

// ============= DASHBOARD STATS CACHE (Offline-First) =============

// Bump this version when RPC logic changes to force cache invalidation
const DASHBOARD_CACHE_VERSION = 7; // v5: Unified weight-based feed consumption calculation

/**
 * Feed stock breakdown for dashboard tooltip
 */
export interface FeedStockBreakdown {
  concentrateDays: number | null;
  roughageDays: number | null;
  concentrateKg: number;
  roughageKg: number;
  totalKg?: number;
  dailyConcentrateConsumption?: number;
  dailyRoughageConsumption?: number;
}

export interface DashboardStatsCache {
  farmId: string;
  stats: {
    totalAnimals: number;
    feedStockDays: number | null;
    feedStockBreakdown?: FeedStockBreakdown; // NEW: Added for tooltip display
    avgDailyMilk: number;
    pregnantCount: number;
    pendingConfirmation: number;
    recentHealthEvents: number;
  };
  dailyMilk: Record<string, number>; // { "2026-01-08": 15, "2026-01-07": 12 }
  stageCounts: Record<string, number>; // { "Early Lactation": 2, "Calf": 1 }
  // MonthlyHeadcount format: { month: string; [stage: string]: number | string }
  monthlyData: Array<{ month: string; [key: string]: string | number }>;
  stageKeys: string[];
  lastUpdated: number;
  lastServerSync: number;
  syncStatus: CacheSyncStatus;
  cacheVersion?: number; // Track schema/logic version for invalidation
}

// ============= MILK INVENTORY CACHE (Offline-First) =============

export interface MilkInventoryCacheItem {
  id: string;
  milking_record_id?: string;
  animal_id: string;
  animal_name: string | null;
  ear_tag: string | null;
  record_date: string;
  liters_original: number;
  liters_remaining: number;
  is_available: boolean;
  created_at: string;
  syncStatus: CacheSyncStatus;
  // Legacy field for backward compat with old cache
  liters?: number;
}

export interface MilkInventoryCache {
  farmId: string;
  items: MilkInventoryCacheItem[];
  summary: {
    totalLiters: number;
    oldestDate: string | null;
    byAnimal: Array<{
      animal_id: string;
      animal_name: string | null;
      ear_tag: string | null;
      total_liters: number;
      oldest_date: string;
      record_count: number;
    }>;
  };
  lastUpdated: number;
  lastServerSync: number;
  syncStatus: CacheSyncStatus;
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
  dashboardStats: {
    key: string;
    value: DashboardStatsCache;
  };
  milkInventory: {
    key: string;
    value: MilkInventoryCache;
  };
}

// Cache expiration times (in milliseconds)
// OFFLINE-FIRST: Extended TTLs since we prioritize cache
const CACHE_TTL = {
  animals: 2 * 60 * 60 * 1000, // 2 hours (increased from 1 hour)
  records: 60 * 60 * 1000, // 1 hour (increased from 30 minutes)
  feedInventory: 4 * 60 * 60 * 1000, // 4 hours (increased from 2 hours)
  farmData: 24 * 60 * 60 * 1000, // 24 hours (unchanged)
  dashboardStats: 5 * 60 * 1000, // 5 minutes - refresh frequently but show cache immediately
};

// OFFLINE-FIRST: Grace period - return stale cache even if expired when offline
const OFFLINE_GRACE_PERIOD = 7 * 24 * 60 * 60 * 1000; // 7 days

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

  dbInstance = await openDB<DataCacheDB>('dataCacheDB', 3, {
    upgrade(db, oldVersion) {
      // Version 1 stores
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
      // Version 2: Add dashboardStats store for offline-first dashboard
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('dashboardStats')) {
          db.createObjectStore('dashboardStats', { keyPath: 'farmId' });
        }
      }
      // Version 3: Add milkInventory store for offline-first inventory
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('milkInventory')) {
          db.createObjectStore('milkInventory', { keyPath: 'farmId' });
        }
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
      syncStatus: 'synced',
      lastSyncedAt: Date.now(),
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
      syncStatus: 'synced',
      pendingChanges: 0,
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
      syncStatus: 'error' as CacheSyncStatus,
      pendingChanges: 0,
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

// Consumption calculation now uses unified feedConsumption service

/**
 * Fetch and cache feed inventory for a farm from Supabase
 * Now includes summary computation AND daily consumption for offline use
 * 
 * @param farmId - UUID of the farm
 * @returns Promise resolving to array of cached feed items
 */
export async function updateFeedInventoryCache(farmId: string): Promise<any[]> {
  try {
    // Fetch feed inventory and animal counts in parallel
    const [feedRes, animalsRes] = await Promise.all([
      supabase
        .from('feed_inventory')
        .select('*')
        .eq('farm_id', farmId),
      supabase
        .from('animals')
        .select('livestock_type')
        .eq('farm_id', farmId)
        .eq('is_deleted', false)
    ]);

    if (feedRes.error) throw feedRes.error;

    // Compute summary for offline use
    const items = feedRes.data || [];
    const summary = {
      totalKg: items.reduce((sum, i) => sum + (i.quantity_kg || 0), 0),
      concentrateKg: items.filter(i => i.category === 'concentrates').reduce((sum, i) => sum + (i.quantity_kg || 0), 0),
      roughageKg: items.filter(i => i.category === 'roughage' || !i.category).reduce((sum, i) => sum + (i.quantity_kg || 0), 0),
      mineralsKg: items.filter(i => i.category === 'minerals').reduce((sum, i) => sum + (i.quantity_kg || 0), 0),
      supplementsKg: items.filter(i => i.category === 'supplements').reduce((sum, i) => sum + (i.quantity_kg || 0), 0),
    };

    // Calculate daily consumption from animal counts using unified service
    let dailyConsumption = 0;
    if (animalsRes.data) {
      const counts = animalsRes.data.reduce((acc, animal) => {
        const type = (animal.livestock_type || 'cattle').toLowerCase();
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      dailyConsumption = calculateConsumptionFromCounts(
        Object.entries(counts).map(([livestockType, count]) => ({ livestockType, count }))
      );
    }

    const cache: FeedInventoryCache = {
      farmId,
      items,
      summary,
      dailyConsumption, // Store for offline calculations
      lastUpdated: Date.now(),
      syncStatus: 'synced',
    };

    const db = await getDB();
    await db.put('feedInventory', cache);

    return items;
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
      syncStatus: 'synced',
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

// ============= OPTIMISTIC UPDATE FUNCTIONS (Phase 2) =============

/**
 * Optimistic record storage for pending sync items
 */
interface OptimisticRecordEntry {
  optimisticId: string;
  type: 'milking' | 'feeding' | 'health' | 'weight' | 'ai';
  animalId: string;
  farmId: string;
  data: any;
  createdAt: number;
}

// In-memory store for optimistic records (cleared on page refresh)
const optimisticRecordsStore = new Map<string, OptimisticRecordEntry>();

/**
 * Add optimistic records to cache with pending status
 * 
 * Immediately adds records to cache so they appear in UI before server sync.
 * 
 * @param farmId - UUID of the farm
 * @param recordType - Type of record being added
 * @param records - Array of record data with animalId
 * @param optimisticId - Unique ID for tracking this batch
 * 
 * @example
 * ```typescript
 * await addOptimisticRecords(farmId, 'milking', [
 *   { animalId: 'abc', liters: 5, date: '2024-01-01' }
 * ], 'opt-123');
 * ```
 */
export async function addOptimisticRecords(
  farmId: string,
  recordType: 'milking' | 'weight' | 'health' | 'ai' | 'feeding',
  records: Array<{ animalId: string; [key: string]: any }>,
  optimisticId: string
): Promise<void> {
  try {
    const db = await getDB();
    const now = Date.now();

    // Store in memory for quick access
    for (const record of records) {
      const entry: OptimisticRecordEntry = {
        optimisticId,
        type: recordType,
        animalId: record.animalId,
        farmId,
        data: { ...record, optimisticId, syncStatus: 'pending' },
        createdAt: now,
      };
      optimisticRecordsStore.set(`${optimisticId}-${record.animalId}`, entry);
    }

    // Also update IndexedDB cache for each animal
    for (const record of records) {
      const existingCache = await db.get('records', record.animalId);
      if (existingCache) {
        const recordsArray = existingCache[recordType] || [];
        const optimisticRecord = {
          ...record,
          id: `optimistic-${optimisticId}-${record.animalId}`,
          optimisticId,
          syncStatus: 'pending',
          created_at: new Date().toISOString(),
        };
        
        await db.put('records', {
          ...existingCache,
          [recordType]: [optimisticRecord, ...recordsArray],
          syncStatus: 'pending',
          pendingChanges: (existingCache.pendingChanges || 0) + 1,
        });
      }
    }

    console.log(`[DataCache] Added ${records.length} optimistic ${recordType} records`);
  } catch (error) {
    console.error('[DataCache] Failed to add optimistic records:', error);
  }
}

/**
 * Confirm optimistic records after successful server sync
 * 
 * Updates cached records with server-confirmed IDs and removes pending status.
 * 
 * @param optimisticId - The optimistic ID used when creating records
 * @param serverRecords - Array of records returned from server with real IDs
 */
export async function confirmOptimisticRecords(
  optimisticId: string,
  serverRecords: any[]
): Promise<void> {
  try {
    const db = await getDB();
    
    // Get all entries with this optimisticId
    const entries = Array.from(optimisticRecordsStore.entries())
      .filter(([key]) => key.startsWith(`${optimisticId}-`));

    for (const [key, entry] of entries) {
      // Find matching server record
      const serverRecord = serverRecords.find(sr => sr.animal_id === entry.animalId);
      
      if (serverRecord) {
        // Update the cache with server-confirmed data
        const existingCache = await db.get('records', entry.animalId);
        if (existingCache) {
          const recordsArray = existingCache[entry.type] || [];
          const updatedRecords = recordsArray.map((r: any) => {
            if (r.optimisticId === optimisticId) {
              return {
                ...serverRecord,
                syncStatus: 'synced',
                optimisticId: undefined,
              };
            }
            return r;
          });

          await db.put('records', {
            ...existingCache,
            [entry.type]: updatedRecords,
            syncStatus: 'synced',
            pendingChanges: Math.max(0, (existingCache.pendingChanges || 1) - 1),
          });
        }
      }

      // Remove from memory store
      optimisticRecordsStore.delete(key);
    }

    console.log(`[DataCache] Confirmed ${entries.length} optimistic records`);
  } catch (error) {
    console.error('[DataCache] Failed to confirm optimistic records:', error);
  }
}

/**
 * Rollback optimistic records on sync failure
 * 
 * Removes optimistic records from cache when sync fails.
 * 
 * @param optimisticId - The optimistic ID of records to remove
 */
export async function rollbackOptimisticRecords(
  optimisticId: string
): Promise<void> {
  try {
    const db = await getDB();
    
    // Get all entries with this optimisticId
    const entries = Array.from(optimisticRecordsStore.entries())
      .filter(([key]) => key.startsWith(`${optimisticId}-`));

    for (const [key, entry] of entries) {
      // Remove from cache
      const existingCache = await db.get('records', entry.animalId);
      if (existingCache) {
        const recordsArray = existingCache[entry.type] || [];
        const filteredRecords = recordsArray.filter(
          (r: any) => r.optimisticId !== optimisticId
        );

        await db.put('records', {
          ...existingCache,
          [entry.type]: filteredRecords,
          pendingChanges: Math.max(0, (existingCache.pendingChanges || 1) - 1),
        });
      }

      // Remove from memory store
      optimisticRecordsStore.delete(key);
    }

    console.log(`[DataCache] Rolled back ${entries.length} optimistic records`);
  } catch (error) {
    console.error('[DataCache] Failed to rollback optimistic records:', error);
  }
}

/**
 * Get all optimistic (pending) records for a farm
 */
export function getOptimisticRecords(farmId: string): OptimisticRecordEntry[] {
  return Array.from(optimisticRecordsStore.values())
    .filter(entry => entry.farmId === farmId);
}

/**
 * Check if there are any pending optimistic records
 */
export function hasPendingOptimisticRecords(farmId?: string): boolean {
  if (!farmId) {
    return optimisticRecordsStore.size > 0;
  }
  return Array.from(optimisticRecordsStore.values())
    .some(entry => entry.farmId === farmId);
}

// ============= DASHBOARD STATS CACHE (Offline-First) =============

/**
 * Get cached dashboard stats for a farm
 * Returns cached data immediately for instant display
 */
export async function getCachedDashboardStats(farmId: string): Promise<DashboardStatsCache | null> {
  try {
    const db = await getDB();
    const cached = await db.get('dashboardStats', farmId);
    
    if (!cached) return null;
    
    // For offline-first, return cache even if "stale" - let background sync refresh
    return cached;
  } catch (error) {
    console.error('[DataCache] Error reading dashboard stats cache:', error);
    return null;
  }
}

/**
 * Check if dashboard cache is fresh (within TTL)
 */
export async function isDashboardCacheFresh(farmId: string): Promise<boolean> {
  try {
    const db = await getDB();
    const cached = await db.get('dashboardStats', farmId);
    
    if (!cached) return false;
    
    // Invalidate if cache version doesn't match current (RPC logic changed)
    if ((cached.cacheVersion ?? 1) !== DASHBOARD_CACHE_VERSION) {
      console.log('[DataCache] Dashboard cache version mismatch, forcing refresh');
      return false;
    }
    
    return Date.now() - cached.lastServerSync < CACHE_TTL.dashboardStats;
  } catch (error) {
    return false;
  }
}

/**
 * Update dashboard stats cache with server data
 * Called after successful server fetch to persist data locally
 */
export async function updateDashboardStatsCache(
  farmId: string,
  data: {
    stats?: DashboardStatsCache['stats'];
    dailyMilk?: Record<string, number>;
    stageCounts?: Record<string, number>;
    monthlyData?: DashboardStatsCache['monthlyData'];
    stageKeys?: string[];
  }
): Promise<void> {
  try {
    const db = await getDB();
    const existing = await db.get('dashboardStats', farmId);
    
    const updated: DashboardStatsCache = {
      farmId,
      stats: data.stats || existing?.stats || {
        totalAnimals: 0,
        feedStockDays: null,
        avgDailyMilk: 0,
        pregnantCount: 0,
        pendingConfirmation: 0,
        recentHealthEvents: 0,
      },
      dailyMilk: { ...(existing?.dailyMilk || {}), ...(data.dailyMilk || {}) },
      stageCounts: data.stageCounts || existing?.stageCounts || {},
      monthlyData: data.monthlyData || existing?.monthlyData || [],
      stageKeys: data.stageKeys || existing?.stageKeys || [],
      lastUpdated: Date.now(),
      lastServerSync: Date.now(),
      syncStatus: 'synced',
      cacheVersion: DASHBOARD_CACHE_VERSION,
    };
    
    await db.put('dashboardStats', updated);
    console.log('[DataCache] Dashboard stats cache updated');
  } catch (error) {
    console.error('[DataCache] Failed to update dashboard stats cache:', error);
  }
}

/**
 * Add milk record to local dashboard cache
 * Used for instant UI updates before server sync
 * 
 * @param farmId - Farm ID
 * @param date - Date string (YYYY-MM-DD)
 * @param liters - Liters to add (accumulates throughout the day)
 */
export async function addLocalMilkRecord(
  farmId: string,
  date: string,
  liters: number
): Promise<void> {
  try {
    const db = await getDB();
    const existing = await db.get('dashboardStats', farmId);
    
    const updated: DashboardStatsCache = existing || {
      farmId,
      stats: {
        totalAnimals: 0,
        feedStockDays: null,
        avgDailyMilk: 0,
        pregnantCount: 0,
        pendingConfirmation: 0,
        recentHealthEvents: 0,
      },
      dailyMilk: {},
      stageCounts: {},
      monthlyData: [],
      stageKeys: [],
      lastUpdated: Date.now(),
      lastServerSync: 0,
      syncStatus: 'pending',
    };
    
    // Add to existing date total (accumulate throughout the day)
    updated.dailyMilk[date] = (updated.dailyMilk[date] || 0) + liters;
    updated.syncStatus = 'pending';
    updated.lastUpdated = Date.now();
    
    // Recalculate avgDailyMilk based on cached data (last 30 days)
    const recentDates = Object.keys(updated.dailyMilk).sort().slice(-30);
    const totalMilk = recentDates.reduce((sum, d) => sum + (updated.dailyMilk[d] || 0), 0);
    updated.stats.avgDailyMilk = recentDates.length > 0 ? totalMilk / recentDates.length : 0;
    
    await db.put('dashboardStats', updated);
    console.log(`[DataCache] Added ${liters}L milk for ${date}, new total: ${updated.dailyMilk[date]}L`);
  } catch (error) {
    console.error('[DataCache] Failed to add local milk record:', error);
  }
}

/**
 * Clear dashboard cache for a farm
 * Useful when farm data needs to be fully refreshed
 */
export async function clearDashboardCache(farmId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('dashboardStats', farmId);
    console.log('[DataCache] Dashboard cache cleared for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to clear dashboard cache:', error);
  }
}

// ============= MILK INVENTORY CACHE FUNCTIONS =============

/**
 * Get cached milk inventory for a farm
 * Returns cached data immediately for instant display
 */
export async function getCachedMilkInventory(farmId: string): Promise<MilkInventoryCache | null> {
  try {
    const db = await getDB();
    const cached = await db.get('milkInventory', farmId);
    
    if (!cached) return null;
    
    // For offline-first, return cache even if "stale" - let background sync refresh
    return cached;
  } catch (error) {
    console.error('[DataCache] Error reading milk inventory cache:', error);
    return null;
  }
}

/**
 * Check if milk inventory cache is fresh (within TTL)
 */
export async function isMilkInventoryCacheFresh(farmId: string): Promise<boolean> {
  try {
    const db = await getDB();
    const cached = await db.get('milkInventory', farmId);
    
    if (!cached) return false;
    
    // Use same TTL as dashboard (5 min) for milk inventory
    return Date.now() - cached.lastServerSync < CACHE_TTL.dashboardStats;
  } catch (error) {
    return false;
  }
}

/**
 * Update milk inventory cache with server data
 * Properly reconciles optimistic/pending items to prevent data loss
 */
export async function updateMilkInventoryCache(
  farmId: string,
  serverItems: MilkInventoryCacheItem[],
  summary: MilkInventoryCache['summary']
): Promise<void> {
  try {
    const db = await getDB();
    const existing = await db.get('milkInventory', farmId);
    
    // Get pending/optimistic items from cache
    const pendingItems = existing?.items.filter(i => 
      i.syncStatus === 'pending' || i.id.startsWith('optimistic-')
    ) || [];
    
    // Build lookup sets for reconciliation
    const serverIds = new Set(serverItems.map(i => i.id));
    const serverMilkingRecordIds = new Set(serverItems.map(i => i.milking_record_id));
    
    // Keep pending items ONLY if they're NOT confirmed by server
    const unconfirmedPending = pendingItems.filter(pending => {
      // If server has this exact ID, it's confirmed
      if (serverIds.has(pending.id)) return false;
      
      // If server has a record with matching milking_record_id, it's confirmed
      if (serverMilkingRecordIds.has(pending.milking_record_id)) return false;
      
      // For optimistic items, check if any server item matches by fingerprint
      // (same animal + date + liters within 0.1L tolerance)
      if (pending.id.startsWith('optimistic-')) {
        const matchesFingerprint = serverItems.some(s => 
          s.animal_id === pending.animal_id &&
          s.record_date === pending.record_date &&
          Math.abs(s.liters_original - pending.liters_original) < 0.1
        );
        if (matchesFingerprint) return false;
      }
      
      return true; // Keep this pending item
    });
    
    // Merge: server items (synced) + unconfirmed pending items
    const mergedItems = [
      ...serverItems.map(i => ({ ...i, syncStatus: 'synced' as CacheSyncStatus })),
      ...unconfirmedPending,
    ];
    
    // Recalculate summary with merged items
    const recalculatedSummary = recalculateMilkInventorySummary(mergedItems);
    
    const updated: MilkInventoryCache = {
      farmId,
      items: mergedItems,
      summary: recalculatedSummary,
      lastUpdated: Date.now(),
      lastServerSync: Date.now(),
      syncStatus: unconfirmedPending.length > 0 ? 'pending' : 'synced',
    };
    
    await db.put('milkInventory', updated);
    console.log('[DataCache] Milk inventory merged:', {
      serverItems: serverItems.length,
      pendingKept: unconfirmedPending.length,
      total: mergedItems.length,
    });
  } catch (error) {
    console.error('[DataCache] Failed to update milk inventory cache:', error);
  }
}

/**
 * Add a milk record to the local inventory cache for instant UI updates
 */
export async function addLocalMilkInventoryRecord(
  farmId: string,
  record: MilkInventoryCacheItem
): Promise<void> {
  try {
    const db = await getDB();
    const existing = await db.get('milkInventory', farmId);
    
    const items = existing?.items || [];
    
    // Check if record already exists (by id)
    const existingIndex = items.findIndex(i => i.id === record.id);
    if (existingIndex >= 0) {
      // Update existing
      items[existingIndex] = record;
    } else {
      // Add new
      items.push(record);
    }
    
    // Recalculate summary
    const summary = recalculateMilkInventorySummary(items);
    
    const updated: MilkInventoryCache = {
      farmId,
      items,
      summary,
      lastUpdated: Date.now(),
      lastServerSync: existing?.lastServerSync || 0,
      syncStatus: 'pending',
    };
    
    await db.put('milkInventory', updated);
    console.log(`[DataCache] Added milk inventory record: ${record.liters}L on ${record.record_date}`);
  } catch (error) {
    console.error('[DataCache] Failed to add local milk inventory record:', error);
  }
}

/**
 * Mark milk records as sold in the local cache
 */
export async function markMilkRecordsSold(
  farmId: string,
  recordIds: string[]
): Promise<void> {
  try {
    const db = await getDB();
    const existing = await db.get('milkInventory', farmId);
    
    if (!existing) return;
    
    // Mark records as sold (remove from available inventory)
    const items = existing.items.filter(i => !recordIds.includes(i.id));
    
    // Recalculate summary
    const summary = recalculateMilkInventorySummary(items);
    
    const updated: MilkInventoryCache = {
      ...existing,
      items,
      summary,
      lastUpdated: Date.now(),
      syncStatus: 'pending',
    };
    
    await db.put('milkInventory', updated);
    console.log(`[DataCache] Marked ${recordIds.length} milk records as sold`);
  } catch (error) {
    console.error('[DataCache] Failed to mark milk records sold:', error);
  }
}

/**
 * Helper to recalculate milk inventory summary from items
 */
export function recalculateMilkInventorySummary(items: MilkInventoryCacheItem[]): MilkInventoryCache['summary'] {
  // Only include available items with remaining liters
  const availableItems = items.filter(i => i.is_available && i.liters_remaining > 0);
  
  const totalLiters = availableItems.reduce((sum, r) => sum + r.liters_remaining, 0);
  const sortedItems = [...availableItems].sort((a, b) => 
    new Date(a.record_date).getTime() - new Date(b.record_date).getTime()
  );
  const oldestDate = sortedItems.length > 0 ? sortedItems[0].record_date : null;
  
  // Group by animal
  const animalMap = new Map<string, {
    animal_name: string | null;
    ear_tag: string | null;
    total_liters: number;
    oldest_date: string;
    record_count: number;
  }>();
  
  availableItems.forEach(item => {
    const existing = animalMap.get(item.animal_id);
    if (existing) {
      existing.total_liters += item.liters_remaining;
      existing.record_count += 1;
      if (item.record_date < existing.oldest_date) {
        existing.oldest_date = item.record_date;
      }
    } else {
      animalMap.set(item.animal_id, {
        animal_name: item.animal_name,
        ear_tag: item.ear_tag,
        total_liters: item.liters_remaining,
        oldest_date: item.record_date,
        record_count: 1,
      });
    }
  });
  
  const byAnimal = Array.from(animalMap.entries())
    .map(([animal_id, data]) => ({ animal_id, ...data }))
    .sort((a, b) => b.total_liters - a.total_liters);
  
  return { totalLiters, oldestDate, byAnimal };
}

/**
 * Deduct milk from inventory cache (for partial sales)
 */
export async function deductMilkFromInventoryCache(
  farmId: string,
  deductions: Array<{ id: string; litersUsed: number }>
): Promise<void> {
  try {
    const db = await getDB();
    const existing = await db.get('milkInventory', farmId);
    if (!existing) return;
    
    const items = existing.items.map(item => {
      const deduction = deductions.find(d => d.id === item.id);
      if (deduction) {
        const newRemaining = item.liters_remaining - deduction.litersUsed;
        return {
          ...item,
          liters_remaining: Math.max(0, newRemaining),
          is_available: newRemaining > 0,
          syncStatus: 'pending' as CacheSyncStatus
        };
      }
      return item;
    });
    
    const summary = recalculateMilkInventorySummary(items);
    
    await db.put('milkInventory', { 
      ...existing, 
      items, 
      summary, 
      lastUpdated: Date.now(),
      syncStatus: 'pending' 
    });
    
    console.log(`[DataCache] Deducted milk from ${deductions.length} inventory items`);
  } catch (error) {
    console.error('[DataCache] Failed to deduct milk from inventory:', error);
  }
}

/**
 * Update a milk record in the local cache (for edit functionality)
 */
export async function updateLocalMilkInventoryRecord(
  farmId: string,
  recordId: string,
  updates: { liters?: number; record_date?: string }
): Promise<{ oldLiters: number; oldDate: string } | null> {
  try {
    const db = await getDB();
    const existing = await db.get('milkInventory', farmId);
    
    if (!existing) return null;
    
    let oldValues: { oldLiters: number; oldDate: string } | null = null;
    
    const items = existing.items.map(item => {
      if (item.id === recordId) {
        oldValues = { oldLiters: item.liters_remaining, oldDate: item.record_date };
        const newItem = { ...item, syncStatus: 'pending' as CacheSyncStatus };
        if (updates.liters !== undefined) {
          newItem.liters_remaining = updates.liters;
          newItem.liters_original = updates.liters;
        }
        if (updates.record_date !== undefined) {
          newItem.record_date = updates.record_date;
        }
        return newItem;
      }
      return item;
    });
    
    const summary = recalculateMilkInventorySummary(items);
    
    const updated: MilkInventoryCache = {
      ...existing,
      items,
      summary,
      lastUpdated: Date.now(),
      syncStatus: 'pending',
    };
    
    await db.put('milkInventory', updated);
    console.log(`[DataCache] Updated milk inventory record ${recordId}`);
    
    return oldValues;
  } catch (error) {
    console.error('[DataCache] Failed to update milk inventory record:', error);
    return null;
  }
}

/**
 * Delete a milk record from the local cache
 */
export async function deleteLocalMilkInventoryRecord(
  farmId: string,
  recordId: string
): Promise<{ liters: number; record_date: string } | null> {
  try {
    const db = await getDB();
    const existing = await db.get('milkInventory', farmId);
    
    if (!existing) return null;
    
    const deletedRecord = existing.items.find(i => i.id === recordId);
    if (!deletedRecord) return null;
    
    const items = existing.items.filter(item => item.id !== recordId);
    const summary = recalculateMilkInventorySummary(items);
    
    const updated: MilkInventoryCache = {
      ...existing,
      items,
      summary,
      lastUpdated: Date.now(),
      syncStatus: 'pending',
    };
    
    await db.put('milkInventory', updated);
    console.log(`[DataCache] Deleted milk inventory record ${recordId}`);
    
    return { liters: deletedRecord.liters_remaining, record_date: deletedRecord.record_date };
  } catch (error) {
    console.error('[DataCache] Failed to delete milk inventory record:', error);
    return null;
  }
}

/**
 * Clear milk inventory cache for a farm
 */
export async function clearMilkInventoryCache(farmId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('milkInventory', farmId);
    console.log('[DataCache] Milk inventory cache cleared for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to clear milk inventory cache:', error);
  }
}

/**
 * Clear animal cache for a farm
 */
export async function clearAnimalCache(farmId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('animals', farmId);
    console.log('[DataCache] Animal cache cleared for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to clear animal cache:', error);
  }
}

/**
 * Clear all caches for a farm (used when switching farms or logging out)
 */
export async function clearAllFarmCaches(farmId: string): Promise<void> {
  await Promise.all([
    clearMilkInventoryCache(farmId),
    clearDashboardCache(farmId),
    clearAnimalCache(farmId),
  ]);
  console.log('[DataCache] All caches cleared for farm:', farmId);
}
