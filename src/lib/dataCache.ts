import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { supabase } from '@/integrations/supabase/client';
import { calculateLifeStage, calculateMilkingStage, calculateMaleStage } from './animalStages';
import { calculateConsumptionFromCounts } from './feedConsumption';
import { getCheckpoint, updateCheckpoint } from './offlineFirstCache';
import { getConnectionQuality, type ConnectionQuality } from '@/hooks/useOnlineStatus';

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
  livestock_type: string;
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
  // Breeding/fertility fields (used by breeding hub offline cache)
  fertility_status?: string | null;
  last_heat_date?: string | null;
  last_ai_date?: string | null;
  last_calving_date?: string | null;
  parity?: number | null;
  services_this_cycle?: number | null;
  voluntary_waiting_end_date?: string | null;
  // Barn/lactation fields
  current_barn_id?: string | null;
  is_currently_lactating?: boolean | null;
  // Sync metadata
  updated_at?: string | null;
  created_at?: string | null;
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
  bcs: any[];
  heat: any[];
  breeding: any[];
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
const DASHBOARD_CACHE_VERSION = 10; // v10: Feed data promoted to SSOT (server-side aggregation)

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
  dailyFeed: Record<string, { totalKg: number; animalCount: number }>; // SSOT feed data
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
  livestock_type: string;
  record_date: string;
  liters_original: number;
  liters_remaining: number;
  is_available: boolean;
  created_at: string;
  syncStatus: CacheSyncStatus;
  liters?: number;
}

export interface MilkInventoryCache {
  farmId: string;
  items: MilkInventoryCacheItem[];
  summary: {
    totalLiters: number;
    oldestDate: string | null;
    bySpecies: Array<{
      livestock_type: string;
      total_liters: number;
      animal_count: number;
      oldest_date: string | null;
    }>;
    byAnimal: Array<{
      animal_id: string;
      animal_name: string | null;
      ear_tag: string | null;
      livestock_type: string;
      total_liters: number;
      oldest_date: string;
      record_count: number;
    }>;
  };
  lastUpdated: number;
  lastServerSync: number;
  syncStatus: CacheSyncStatus;
}

// ============= UPCOMING ALERTS CACHE =============

export interface UpcomingAlertsCacheItem {
  alert_type: string;
  alert_title: string;
  animal_id: string;
  animal_name: string | null;
  animal_ear_tag: string | null;
  due_date: string;
  days_until_due: number;
  urgency: string;
  schedule_id: string;
}

export interface UpcomingAlertsCache {
  farmId: string;
  daysAhead: number;
  alerts: UpcomingAlertsCacheItem[];
  lastUpdated: number;
  syncStatus: CacheSyncStatus;
}

// ============= MARKET PRICE CACHE =============

export interface MarketPriceCacheEntry {
  farmId: string;
  livestockType: string;
  price: number;
  source: string;
  effectiveDate: string;
  lastUpdated: number;
  syncStatus: CacheSyncStatus;
}

// ============= HERD VALUATION CACHE =============

export interface HerdValuationCacheEntry {
  farmId: string;
  data: any; // UnifiedHerdValuation
  lastUpdated: number;
  syncStatus: CacheSyncStatus;
}

// ============= BREEDING ANALYTICS CACHE =============

export interface BreedingAnalyticsCacheEntry {
  farmId: string;
  data: any; // BreedingAnalytics result
  lastUpdated: number;
  syncStatus: CacheSyncStatus;
}

// ============= ANIMAL COST CACHE =============

export interface AnimalCostCacheEntry {
  farmId: string;
  data: any; // FarmCostAnalysis from useAnimalCostAggregates
  lastUpdated: number;
  syncStatus: CacheSyncStatus;
}

// ============= BARNS CACHE =============

export interface BarnsCacheEntry {
  farmId: string;
  data: any[]; // Barn[] from useBarns
  lastUpdated: number;
  syncStatus: CacheSyncStatus;
}

// ============= FARM SETTINGS CACHE =============

export interface FarmSettingsCacheEntry {
  farmId: string;
  data: any; // FarmSettings from useFarmSettings
  lastUpdated: number;
  syncStatus: CacheSyncStatus;
}

// ============= BARN ASSIGNMENTS CACHE =============

export interface BarnAssignmentsCacheEntry {
  farmId: string;
  assignments: any[]; // BarnAssignment[] from useBarnAnimals
  lastUpdated: number;
  syncStatus: CacheSyncStatus;
}

// ============= EXPENSES CACHE =============

export interface ExpensesCacheEntry {
  farmId: string;
  data: any[]; // Expense[] from useExpenses
  lastUpdated: number;
  syncStatus: CacheSyncStatus;
}

// ============= REVENUES CACHE =============

export interface RevenuesCacheEntry {
  farmId: string;
  data: any[]; // Revenue[] from useRevenues
  lastUpdated: number;
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
  upcomingAlerts: {
    key: string;
    value: UpcomingAlertsCache;
  };
  marketPriceCache: {
    key: string;
    value: MarketPriceCacheEntry;
  };
  herdValuationCache: {
    key: string;
    value: HerdValuationCacheEntry;
  };
  breedingAnalyticsCache: {
    key: string;
    value: BreedingAnalyticsCacheEntry;
  };
  animalCostCache: {
    key: string;
    value: AnimalCostCacheEntry;
  };
  barnsCache: {
    key: string;
    value: BarnsCacheEntry;
  };
  farmSettingsCache: {
    key: string;
    value: FarmSettingsCacheEntry;
  };
  barnAssignmentsCache: {
    key: string;
    value: BarnAssignmentsCacheEntry;
  };
  expensesCache: {
    key: string;
    value: ExpensesCacheEntry;
  };
  revenuesCache: {
    key: string;
    value: RevenuesCacheEntry;
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
  upcomingAlerts: 10 * 60 * 1000, // 10 minutes - alerts need reasonable freshness
  marketPrice: 30 * 60 * 1000, // 30 minutes - prices change infrequently
  herdValuation: 10 * 60 * 1000, // 10 minutes - depends on market price + animal weights
  breedingAnalytics: 15 * 60 * 1000, // 15 minutes - derived analytics, moderate freshness
  animalCost: 15 * 60 * 1000, // 15 minutes - stable aggregate data
  barns: 30 * 60 * 1000, // 30 minutes - rarely changes
  farmSettings: 60 * 60 * 1000, // 60 minutes - very stable
  expenses: 30 * 60 * 1000, // 30 minutes - financial data, moderate freshness
  revenues: 30 * 60 * 1000, // 30 minutes - financial data, moderate freshness
};

// OFFLINE-FIRST: Grace period - return stale cache even if expired when offline
const OFFLINE_GRACE_PERIOD = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============= COLUMN SELECTIONS (Bandwidth Optimization) =============
// Explicit column lists reduce payload by ~20-30% vs select('*').
// Excludes: client_generated_id (sync-only), is_deleted/exit_* (filtered by WHERE),
// created_by (not displayed in cache context).

const ANIMAL_SELECT_COLUMNS = [
  'id', 'farm_id', 'livestock_type', 'name', 'ear_tag', 'breed',
  'birth_date', 'gender', 'milking_start_date', 'current_weight_kg',
  'mother_id', 'father_id', 'avatar_url', 'unique_code',
  'farm_entry_date', 'birth_date_unknown', 'mother_unknown', 'father_unknown',
  'entry_weight_kg', 'entry_weight_unknown', 'birth_weight_kg',
  'acquisition_type', 'purchase_price', 'grant_source', 'grant_source_other',
  'source_farm', 'current_barn_id', 'is_currently_lactating',
  // Breeding/fertility fields (for breeding hub offline cache)
  'fertility_status', 'last_heat_date', 'last_ai_date', 'last_calving_date',
  'parity', 'services_this_cycle', 'voluntary_waiting_end_date',
  'estimated_days_in_milk',
  // Sync metadata
  'created_at', 'updated_at',
].join(',');

const MILKING_RECORD_COLUMNS = [
  'id', 'animal_id', 'record_date', 'liters', 'session',
  'is_sold', 'sale_amount', 'price_per_liter',
  'milk_quality', 'milk_quality_rejection_reason', 'input_method',
  'updated_at',
].join(',');

const WEIGHT_RECORD_COLUMNS = [
  'id', 'animal_id', 'measurement_date', 'weight_kg',
  'measurement_method', 'notes', 'recorded_by', 'input_method',
  'updated_at',
].join(',');

const HEALTH_RECORD_COLUMNS = [
  'id', 'animal_id', 'visit_date', 'diagnosis', 'treatment',
  'notes', 'resolution_notes', 'input_method', 'created_by',
  'updated_at',
].join(',');

const AI_RECORD_COLUMNS = [
  'id', 'animal_id', 'scheduled_date', 'performed_date',
  'semen_code', 'technician', 'notes',
  'pregnancy_confirmed', 'confirmed_at', 'expected_delivery_date',
  'updated_at',
].join(',');

const FEEDING_RECORD_COLUMNS = [
  'id', 'animal_id', 'record_datetime', 'feed_type', 'kilograms',
  'feed_inventory_id', 'milk_inventory_id',
  'cost_per_kg_at_time', 'notes', 'input_method',
  'updated_at',
].join(',');

const HEAT_RECORD_COLUMNS = [
  'id', 'animal_id', 'detected_at', 'detection_method',
  'intensity', 'standing_heat', 'notes',
  'optimal_breeding_start', 'optimal_breeding_end',
  'updated_at',
].join(',');

const FEED_INVENTORY_COLUMNS = [
  'id', 'farm_id', 'feed_type', 'category', 'quantity_kg', 'unit',
  'cost_per_unit', 'expiry_date', 'supplier', 'purchase_date',
  'reorder_threshold', 'last_updated',
].join(',');

// Date windows for record caching — only recent records are cached for bandwidth savings.
// Older records are fetched on-demand when users navigate to full history views.
const RECORD_CACHE_WINDOWS = {
  milking: 180,   // 6 months of milking data
  weight: 365,    // 12 months of weight tracking
  health: 365,    // 12 months of health events
  feeding: 90,    // 3 months of feeding (most voluminous)
  // AI and heat records: no window (small datasets, critical for breeding predictions)
};

function getDateWindowISO(daysBack: number): string {
  return new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * SSOT cache validity check — used by ALL cache getters.
 *
 * Returns true if cached data should be returned to the caller.
 * Always returns cached data within the 7-day grace period regardless of
 * online status. Components are responsible for fetching fresh data when online;
 * the cache only needs to be a reliable fallback.
 *
 * NOTE: We intentionally do NOT gate on getIsOnline() here because
 * navigator.onLine is unreliable on Android WebView — it can report "online"
 * for several seconds after the device actually goes offline, causing cache
 * misses at exactly the moment the user needs cached data most.
 */
function isCacheUsable(lastUpdated: number): boolean {
  return Date.now() - lastUpdated < OFFLINE_GRACE_PERIOD;
}

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

  dbInstance = await openDB<DataCacheDB>('dataCacheDB', 8, {
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
      // Version 4: Add upcomingAlerts store for offline-first alerts
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains('upcomingAlerts')) {
          db.createObjectStore('upcomingAlerts', { keyPath: 'farmId' });
        }
      }
      // Version 5: Add marketPriceCache, herdValuationCache, breedingAnalyticsCache
      if (oldVersion < 5) {
        if (!db.objectStoreNames.contains('marketPriceCache')) {
          db.createObjectStore('marketPriceCache', { keyPath: 'farmId' });
        }
        if (!db.objectStoreNames.contains('herdValuationCache')) {
          db.createObjectStore('herdValuationCache', { keyPath: 'farmId' });
        }
        if (!db.objectStoreNames.contains('breedingAnalyticsCache')) {
          db.createObjectStore('breedingAnalyticsCache', { keyPath: 'farmId' });
        }
      }
      // Version 6: Add animalCostCache, barnsCache, farmSettingsCache
      if (oldVersion < 6) {
        if (!db.objectStoreNames.contains('animalCostCache')) {
          db.createObjectStore('animalCostCache', { keyPath: 'farmId' });
        }
        if (!db.objectStoreNames.contains('barnsCache')) {
          db.createObjectStore('barnsCache', { keyPath: 'farmId' });
        }
        if (!db.objectStoreNames.contains('farmSettingsCache')) {
          db.createObjectStore('farmSettingsCache', { keyPath: 'farmId' });
        }
      }
      // Version 7: Add barnAssignmentsCache for offline barn animal management
      if (oldVersion < 7) {
        if (!db.objectStoreNames.contains('barnAssignmentsCache')) {
          db.createObjectStore('barnAssignmentsCache', { keyPath: 'farmId' });
        }
      }
      // Version 8: Add expensesCache and revenuesCache for offline finance
      if (oldVersion < 8) {
        if (!db.objectStoreNames.contains('expensesCache')) {
          db.createObjectStore('expensesCache', { keyPath: 'farmId' });
        }
        if (!db.objectStoreNames.contains('revenuesCache')) {
          db.createObjectStore('revenuesCache', { keyPath: 'farmId' });
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

    if (isCacheUsable(cached.lastUpdated)) return cached;
    return null;
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
    // Check for existing cache + checkpoint to enable delta sync
    const db = await getDB();
    const existingCache = await db.get('animals', farmId);
    const checkpoint = await getCheckpoint(farmId, 'animals');

    // Delta sync: only fetch changed animals if we have a valid cache + checkpoint
    const isDelta = !!checkpoint && !!existingCache?.data?.length;
    let fetchedAnimals: any[];
    let removedIds: Set<string> = new Set();

    if (isDelta) {
      // Delta: fetch animals updated since last sync (INCLUDING deletions/exits)
      const { data, error } = await supabase
        .from('animals')
        .select(ANIMAL_SELECT_COLUMNS + ',is_deleted,exit_date')
        .eq('farm_id', farmId)
        .gte('updated_at', checkpoint.lastSyncedAt)
        .order('created_at', { ascending: false });

      if (error) throw error;
      fetchedAnimals = data || [];

      // Separate active vs removed animals
      for (const a of fetchedAnimals) {
        if (a.is_deleted || a.exit_date) removedIds.add(a.id);
      }
      fetchedAnimals = fetchedAnimals.filter(a => !a.is_deleted && !a.exit_date);

      console.log(`[DataCache] Delta sync: ${fetchedAnimals.length} updated, ${removedIds.size} removed`);
    } else {
      // Full sync: fetch all active animals
      const { data, error } = await supabase
        .from('animals')
        .select(ANIMAL_SELECT_COLUMNS)
        .eq('farm_id', farmId)
        .eq('is_deleted', false)
        .is('exit_date', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      fetchedAnimals = data || [];
    }

    // Pre-cache records using batch query (6 HTTP requests instead of N×6)
    // For delta sync, only fetch records for changed animals
    const animalIdsToCache = fetchedAnimals.map(a => a.id);
    if (animalIdsToCache.length > 0) {
      if (emitProgressUpdates) {
        emitProgress({
          phase: 'records',
          current: 0,
          total: animalIdsToCache.length,
          message: 'Caching animal records...',
        });
        await updateRecordsCacheBatch(animalIdsToCache, (current, total) => {
          emitProgress({
            phase: 'records',
            current,
            total,
            message: `Caching records (${current}/${total})...`,
          });
        }, farmId);
      } else if (!isDelta) {
        // Full sync: batch in background (non-progress mode)
        updateRecordsCacheBatch(animalIdsToCache, undefined, farmId)
          .catch(err => console.error('[DataCache] Error batch-caching records:', err));
      } else {
        // Delta sync: await so cache is consistent before returning
        await updateRecordsCacheBatch(animalIdsToCache, undefined, farmId);
      }
    }

    // Calculate stages only for fetched animals
    const animalsWithStages = await computeAnimalStages(
      fetchedAnimals, emitProgressUpdates,
    );

    // Merge with existing cache (delta) or replace (full)
    let finalAnimals: Animal[];
    if (isDelta && existingCache?.data) {
      const updatedMap = new Map(animalsWithStages.map(a => [a.id, a]));
      finalAnimals = existingCache.data
        .filter((a: Animal) => !removedIds.has(a.id) && !updatedMap.has(a.id))
        .concat(animalsWithStages);
    } else {
      finalAnimals = animalsWithStages;
    }

    const cache: AnimalDataCache = {
      farmId,
      data: finalAnimals,
      lastUpdated: Date.now(),
      version: 1,
      syncStatus: 'synced',
      lastSyncedAt: Date.now(),
    };

    await db.put('animals', cache);

    // Update checkpoint for next delta sync
    await updateCheckpoint(farmId, 'animals', new Date().toISOString(), finalAnimals.length);

    return finalAnimals;
  } catch (error) {
    console.error('Failed to update animal cache:', error);
    return [];
  }
}

/**
 * Compute life/milking stages for a list of animals.
 * Extracted to share between full and delta sync paths.
 */
async function computeAnimalStages(
  animals: any[],
  emitProgressUpdates: boolean,
): Promise<Animal[]> {
  const totalAnimals = animals.length;
  return Promise.all(
    animals.map(async (animal, index) => {
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

      if (!isMale && !isFemale) {
        return { ...animal, lifeStage: null, milkingStage: null };
      }

      const { count: offspringCount } = await supabase
        .from('animals')
        .select('*', { count: 'exact', head: true })
        .or(`mother_id.eq.${animal.id},father_id.eq.${animal.id}`);

      const { data: offspring } = await supabase
        .from('animals')
        .select('birth_date')
        .or(`mother_id.eq.${animal.id},father_id.eq.${animal.id}`)
        .order('birth_date', { ascending: false })
        .limit(1);

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

      // Derive hasActiveAI from fertility_status (SSOT from DB trigger)
      const hasActiveAI = isFemale
        ? ['bred_waiting', 'suspected_pregnant', 'confirmed_pregnant'].includes(animal.fertility_status || '')
        : false;

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

      let lifeStage: string | null = null;
      let milkingStage: string | null = null;

      if (isMale) {
        lifeStage = calculateMaleStage(stageData);
        milkingStage = null;
      } else {
        lifeStage = calculateLifeStage(stageData);
        milkingStage = calculateMilkingStage(stageData);
      }

      return { ...animal, lifeStage, milkingStage };
    })
  );
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

    if (isCacheUsable(cached.lastUpdated)) return cached;
    return null;
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
    const [milkingRes, weightRes, healthRes, aiRes, feedingRes, heatRes, breedingRes] = await Promise.all([
      supabase.from('milking_records').select(MILKING_RECORD_COLUMNS).eq('animal_id', animalId)
        .gte('record_date', getDateWindowISO(RECORD_CACHE_WINDOWS.milking)).order('record_date', { ascending: false }),
      supabase.from('weight_records').select(WEIGHT_RECORD_COLUMNS).eq('animal_id', animalId)
        .gte('measurement_date', getDateWindowISO(RECORD_CACHE_WINDOWS.weight)).order('measurement_date', { ascending: false }),
      supabase.from('health_records').select(HEALTH_RECORD_COLUMNS).eq('animal_id', animalId)
        .gte('visit_date', getDateWindowISO(RECORD_CACHE_WINDOWS.health)).order('visit_date', { ascending: false }),
      supabase.from('ai_records').select(AI_RECORD_COLUMNS).eq('animal_id', animalId)
        .order('scheduled_date', { ascending: false }),
      supabase.from('feeding_records').select(FEEDING_RECORD_COLUMNS).eq('animal_id', animalId)
        .gte('record_datetime', getDateWindowISO(RECORD_CACHE_WINDOWS.feeding)).order('record_datetime', { ascending: false }),
      supabase.from('heat_records').select(HEAT_RECORD_COLUMNS).eq('animal_id', animalId)
        .order('detected_at', { ascending: false }),
      supabase.from('breeding_events').select('id, event_type, event_date, notes, metadata, related_heat_record_id, related_ai_record_id')
        .eq('animal_id', animalId).order('event_date', { ascending: false }).limit(100),
    ]);

    const cache: RecordCache = {
      animalId,
      milking: milkingRes.data || [],
      weight: weightRes.data || [],
      health: healthRes.data || [],
      ai: aiRes.data || [],
      feeding: feedingRes.data || [],
      bcs: [],
      heat: heatRes.data || [],
      breeding: breedingRes.data || [],
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
      bcs: [],
      heat: [],
      breeding: [],
      lastUpdated: Date.now(),
      syncStatus: 'error' as CacheSyncStatus,
      pendingChanges: 0,
    };
  }
}

/**
 * Batch-fetch and cache records for ALL animals in a farm with just 6 HTTP requests.
 *
 * Supports delta sync: if a farmId is provided and a records checkpoint exists,
 * only records with `updated_at > lastSync` are fetched and merged into existing caches.
 * First sync (no checkpoint) does a full fetch with date windowing.
 *
 * @param animalIds - UUIDs of all animals in the farm
 * @param onProgress - Optional callback for progress updates
 * @param farmId - Farm ID for checkpoint-based delta sync (optional)
 */
export async function updateRecordsCacheBatch(
  animalIds: string[],
  onProgress?: (current: number, total: number) => void,
  farmId?: string,
): Promise<void> {
  if (animalIds.length === 0) return;

  try {
    const safeIds = animalIds.length > 0 ? animalIds : ['no-match'];

    // Check for delta sync eligibility
    const checkpoint = farmId ? await getCheckpoint(farmId, 'records') : null;
    const isDelta = !!checkpoint;

    let milkingRes, weightRes, healthRes, aiRes, feedingRes, heatRes, breedingRes;

    const BREEDING_EVENT_COLUMNS = 'id, animal_id, event_type, event_date, notes, metadata, related_heat_record_id, related_ai_record_id';

    if (isDelta) {
      // Delta: only records updated since last sync (across ALL animals in farm)
      const since = checkpoint.lastSyncedAt;
      // NOTE: These tables don't have an updated_at column. Use created_at
      // (present on every table) so delta sync picks up newly inserted records
      // since the last checkpoint. Edits to existing records won't be detected
      // via delta — the periodic full-sync branch below covers that case.
      [milkingRes, weightRes, healthRes, aiRes, feedingRes, heatRes, breedingRes] = await Promise.all([
        supabase.from('milking_records').select(MILKING_RECORD_COLUMNS).in('animal_id', safeIds)
          .gte('created_at', since).order('record_date', { ascending: false }),
        supabase.from('weight_records').select(WEIGHT_RECORD_COLUMNS).in('animal_id', safeIds)
          .gte('created_at', since).order('measurement_date', { ascending: false }),
        supabase.from('health_records').select(HEALTH_RECORD_COLUMNS).in('animal_id', safeIds)
          .gte('created_at', since).order('visit_date', { ascending: false }),
        supabase.from('ai_records').select(AI_RECORD_COLUMNS).in('animal_id', safeIds)
          .gte('created_at', since).order('scheduled_date', { ascending: false }),
        supabase.from('feeding_records').select(FEEDING_RECORD_COLUMNS).in('animal_id', safeIds)
          .gte('created_at', since).order('record_datetime', { ascending: false }),
        supabase.from('heat_records').select(HEAT_RECORD_COLUMNS).in('animal_id', safeIds)
          .gte('created_at', since).order('detected_at', { ascending: false }),
        supabase.from('breeding_events').select(BREEDING_EVENT_COLUMNS).in('animal_id', safeIds)
          .gte('created_at', since).order('event_date', { ascending: false }),
      ]);

      const totalDelta = (milkingRes.data?.length || 0) + (weightRes.data?.length || 0) +
        (healthRes.data?.length || 0) + (aiRes.data?.length || 0) +
        (feedingRes.data?.length || 0) + (heatRes.data?.length || 0) +
        (breedingRes.data?.length || 0);
      console.log(`[DataCache] Records delta sync: ${totalDelta} changed records across 7 tables`);
    } else {
      // Full fetch with date windowing
      [milkingRes, weightRes, healthRes, aiRes, feedingRes, heatRes, breedingRes] = await Promise.all([
        supabase.from('milking_records').select(MILKING_RECORD_COLUMNS).in('animal_id', safeIds)
          .gte('record_date', getDateWindowISO(RECORD_CACHE_WINDOWS.milking)).order('record_date', { ascending: false }),
        supabase.from('weight_records').select(WEIGHT_RECORD_COLUMNS).in('animal_id', safeIds)
          .gte('measurement_date', getDateWindowISO(RECORD_CACHE_WINDOWS.weight)).order('measurement_date', { ascending: false }),
        supabase.from('health_records').select(HEALTH_RECORD_COLUMNS).in('animal_id', safeIds)
          .gte('visit_date', getDateWindowISO(RECORD_CACHE_WINDOWS.health)).order('visit_date', { ascending: false }),
        supabase.from('ai_records').select(AI_RECORD_COLUMNS).in('animal_id', safeIds)
          .order('scheduled_date', { ascending: false }),
        supabase.from('feeding_records').select(FEEDING_RECORD_COLUMNS).in('animal_id', safeIds)
          .gte('record_datetime', getDateWindowISO(RECORD_CACHE_WINDOWS.feeding)).order('record_datetime', { ascending: false }),
        supabase.from('heat_records').select(HEAT_RECORD_COLUMNS).in('animal_id', safeIds)
          .order('detected_at', { ascending: false }),
        supabase.from('breeding_events').select(BREEDING_EVENT_COLUMNS).in('animal_id', safeIds)
          .order('event_date', { ascending: false }).limit(100),
      ]);
    }

    // Partition results by animal_id client-side
    const partitionByAnimal = <T extends { animal_id: string }>(records: T[]): Map<string, T[]> => {
      const map = new Map<string, T[]>();
      for (const record of records) {
        const list = map.get(record.animal_id);
        if (list) list.push(record);
        else map.set(record.animal_id, [record]);
      }
      return map;
    };

    const milkingByAnimal = partitionByAnimal(milkingRes.data || []);
    const weightByAnimal = partitionByAnimal(weightRes.data || []);
    const healthByAnimal = partitionByAnimal(healthRes.data || []);
    const aiByAnimal = partitionByAnimal(aiRes.data || []);
    const feedingByAnimal = partitionByAnimal(feedingRes.data || []);
    const heatByAnimal = partitionByAnimal(heatRes.data || []);
    const breedingByAnimal = partitionByAnimal(breedingRes.data || []);

    // Store per-animal caches in IndexedDB
    const db = await getDB();
    const tx = db.transaction('records', 'readwrite');
    const store = tx.objectStore('records');

    // Collect all animal IDs that have changed records (for delta merge)
    const affectedAnimalIds = isDelta
      ? new Set([
          ...milkingByAnimal.keys(), ...weightByAnimal.keys(),
          ...healthByAnimal.keys(), ...aiByAnimal.keys(),
          ...feedingByAnimal.keys(), ...heatByAnimal.keys(),
          ...breedingByAnimal.keys(),
        ])
      : null;

    // For delta: only update animals that had changed records
    // For full: update all animals
    const idsToProcess = isDelta ? [...affectedAnimalIds!] : animalIds;

    for (let i = 0; i < idsToProcess.length; i++) {
      const animalId = idsToProcess[i];

      if (isDelta) {
        // Merge: read existing cache, replace updated records by ID
        const existing = await store.get(animalId);
        const merged: RecordCache = {
          animalId,
          milking: mergeRecordsById(existing?.milking || [], milkingByAnimal.get(animalId) || []),
          weight: mergeRecordsById(existing?.weight || [], weightByAnimal.get(animalId) || []),
          health: mergeRecordsById(existing?.health || [], healthByAnimal.get(animalId) || []),
          ai: mergeRecordsById(existing?.ai || [], aiByAnimal.get(animalId) || []),
          feeding: mergeRecordsById(existing?.feeding || [], feedingByAnimal.get(animalId) || []),
          bcs: existing?.bcs || [],
          heat: mergeRecordsById(existing?.heat || [], heatByAnimal.get(animalId) || []),
          breeding: mergeRecordsById(existing?.breeding || [], breedingByAnimal.get(animalId) || []),
          lastUpdated: Date.now(),
          syncStatus: 'synced',
          pendingChanges: 0,
        };
        await store.put(merged);
      } else {
        // Full replacement
        const cache: RecordCache = {
          animalId,
          milking: milkingByAnimal.get(animalId) || [],
          weight: weightByAnimal.get(animalId) || [],
          health: healthByAnimal.get(animalId) || [],
          ai: aiByAnimal.get(animalId) || [],
          feeding: feedingByAnimal.get(animalId) || [],
          bcs: [],
          heat: heatByAnimal.get(animalId) || [],
          breeding: breedingByAnimal.get(animalId) || [],
          lastUpdated: Date.now(),
          syncStatus: 'synced',
          pendingChanges: 0,
        };
        await store.put(cache);
      }
      onProgress?.(i + 1, idsToProcess.length);
    }

    await tx.done;

    // Update records checkpoint for next delta
    if (farmId) {
      await updateCheckpoint(farmId, 'records', new Date().toISOString(), idsToProcess.length);
    }
  } catch (error) {
    console.error('[DataCache] Batch records cache failed:', error);
  }
}

/**
 * Merge updated records into existing cache by ID.
 * New records are added, existing records with same ID are replaced.
 */
function mergeRecordsById(existing: any[], updated: any[]): any[] {
  if (updated.length === 0) return existing;
  if (existing.length === 0) return updated;

  const updatedMap = new Map(updated.map(r => [r.id, r]));
  const merged = existing.map(r => updatedMap.get(r.id) || r);

  // Add truly new records (IDs not in existing)
  const existingIds = new Set(existing.map(r => r.id));
  for (const r of updated) {
    if (!existingIds.has(r.id)) merged.push(r);
  }

  return merged;
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
    // Check for delta sync eligibility
    const checkpoint = await getCheckpoint(farmId, 'feed_inventory');
    const db = await getDB();
    const existingCache = await db.get('feedInventory', farmId);
    const isDelta = !!checkpoint && !!existingCache?.items?.length;

    let items: any[];

    if (isDelta) {
      // Delta: fetch only changed feed items since last sync
      const { data, error } = await supabase
        .from('feed_inventory')
        .select(FEED_INVENTORY_COLUMNS)
        .eq('farm_id', farmId)
        .gte('last_updated', checkpoint.lastSyncedAt);

      if (error) throw error;

      // Merge: replace existing items by ID, add new ones
      const freshItems = (data || []) as any[];
      const updatedMap = new Map(freshItems.map(i => [i.id, i]));
      items = existingCache.items
        .map(i => updatedMap.get(i.id) || i)
        .concat(freshItems.filter(i => !existingCache.items.some((e: any) => e.id === i.id)));

      console.log(`[DataCache] Feed inventory delta: ${data?.length || 0} changed items`);
    } else {
      // Full fetch
      const [feedRes, animalsRes] = await Promise.all([
        supabase
          .from('feed_inventory')
          .select(FEED_INVENTORY_COLUMNS)
          .eq('farm_id', farmId),
        supabase
          .from('animals')
          .select('id,livestock_type')
          .eq('farm_id', farmId)
          .eq('is_deleted', false)
          .is('exit_date', null)
      ]);

      if (feedRes.error) throw feedRes.error;
      items = feedRes.data || [];

      // Calculate daily consumption (only on full fetch — doesn't change often)
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

      // Store daily consumption for reuse in delta path
      const cache: FeedInventoryCache = {
        farmId,
        items,
        summary: computeFeedSummary(items),
        dailyConsumption,
        lastUpdated: Date.now(),
        syncStatus: 'synced',
      };
      await db.put('feedInventory', cache);
      await updateCheckpoint(farmId, 'feed_inventory', new Date().toISOString(), items.length);
      return items;
    }

    // Delta path: recompute summary, preserve dailyConsumption from last full sync
    const cache: FeedInventoryCache = {
      farmId,
      items,
      summary: computeFeedSummary(items),
      dailyConsumption: existingCache.dailyConsumption,
      lastUpdated: Date.now(),
      syncStatus: 'synced',
    };

    await db.put('feedInventory', cache);
    await updateCheckpoint(farmId, 'feed_inventory', new Date().toISOString(), items.length);

    return items;
  } catch (error) {
    console.error('Failed to update feed inventory cache:', error);
    return [];
  }
}

/** Compute feed category summary from items list */
function computeFeedSummary(items: any[]) {
  return {
    totalKg: items.reduce((sum, i) => sum + (i.quantity_kg || 0), 0),
    concentrateKg: items.filter(i => i.category === 'concentrates').reduce((sum, i) => sum + (i.quantity_kg || 0), 0),
    roughageKg: items.filter(i => i.category === 'roughage' || !i.category).reduce((sum, i) => sum + (i.quantity_kg || 0), 0),
    mineralsKg: items.filter(i => i.category === 'minerals').reduce((sum, i) => sum + (i.quantity_kg || 0), 0),
    supplementsKg: items.filter(i => i.category === 'supplements').reduce((sum, i) => sum + (i.quantity_kg || 0), 0),
  };
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

  const quality = getConnectionQuality();
  console.log(`[DataCache] Preloading data for farm (connection: ${quality}):`, farmId);

  try {
    // Phase 1: Animals + records (always — essential for offline use)
    emitProgress({
      phase: 'animals',
      current: 0,
      total: 100,
      message: quality === '2g' ? 'Loading animals (slow connection)...' : 'Loading animals...',
    });

    const animals = await updateAnimalCache(farmId, true);

    // Phase 2: Feed Inventory (skip on 2G — defer to next fast connection)
    if (quality !== '2g') {
      emitProgress({
        phase: 'feed',
        current: 0,
        total: 1,
        message: 'Caching feeds...',
      });
      await updateFeedInventoryCache(farmId);
    } else {
      console.log('[DataCache] 2G connection — deferring feed inventory sync');
    }

    // Phase 3: Farm Data (skip on 2G — rarely changes, low priority)
    if (quality !== '2g') {
      emitProgress({
        phase: 'farm',
        current: 0,
        total: 1,
        message: 'Caching farm data...',
      });
      await updateFarmDataCache(farmId);
    } else {
      console.log('[DataCache] 2G connection — deferring farm data sync');
    }

    // Complete
    emitProgress({
      phase: 'complete',
      current: 1,
      total: 1,
      message: quality === '2g' ? 'Essential data cached!' : 'Cache complete!',
    });

    console.log(`[DataCache] Preload complete (mode: ${quality})`);

    const stats = await getCacheStats(farmId);

    await createSystemNotification(
      quality === '2g' ? "Essential Data Cached" : "Offline Cache Ready",
      quality === '2g'
        ? `${stats.animals.count} animals cached. Feed & farm data will sync on faster connection.`
        : `${stats.animals.count} animals and ${stats.records.count} records available offline`
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

  const quality = getConnectionQuality();
  console.log(`[DataCache] Refreshing caches (connection: ${quality})...`);

  try {
    // Animals always refresh (essential, uses delta sync so lightweight)
    await updateAnimalCache(farmId);

    // Feed inventory only on non-2G (lower priority, defer to faster connection)
    if (quality !== '2g') {
      await updateFeedInventoryCache(farmId);
    } else {
      console.log('[DataCache] 2G connection — skipping feed inventory refresh');
    }

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
      db.clear('expensesCache'),
      db.clear('revenuesCache'),
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
  type: 'milking' | 'feeding' | 'health' | 'weight' | 'ai' | 'bcs';
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
  recordType: 'milking' | 'weight' | 'health' | 'ai' | 'feeding' | 'bcs',
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
    dailyFeed?: Record<string, { totalKg: number; animalCount: number }>;
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
      dailyFeed: { ...(existing?.dailyFeed || {}), ...(data.dailyFeed || {}) },
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
      dailyFeed: {},
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
 * Add feed record to local dashboard cache
 * Used for instant UI updates before server sync
 *
 * @param farmId - Farm ID
 * @param date - Date string (YYYY-MM-DD)
 * @param totalKg - Kilograms to add (accumulates throughout the day)
 * @param animalCount - Number of animals fed
 */
export async function addLocalFeedRecord(
  farmId: string,
  date: string,
  totalKg: number,
  animalCount: number
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
      dailyFeed: {},
      stageCounts: {},
      monthlyData: [],
      stageKeys: [],
      lastUpdated: Date.now(),
      lastServerSync: 0,
      syncStatus: 'pending',
    };

    // Add to existing date total (accumulate throughout the day)
    const existingFeed = updated.dailyFeed[date] || { totalKg: 0, animalCount: 0 };
    updated.dailyFeed[date] = {
      totalKg: existingFeed.totalKg + totalKg,
      animalCount: existingFeed.animalCount + animalCount,
    };
    updated.syncStatus = 'pending';
    updated.lastUpdated = Date.now();

    await db.put('dashboardStats', updated);
    console.log(`[DataCache] Added ${totalKg}kg feed for ${date}, new total: ${updated.dailyFeed[date].totalKg}kg`);
  } catch (error) {
    console.error('[DataCache] Failed to add local feed record:', error);
  }
}

/**
 * Deduct feed from local feed inventory cache
 * Used for instant UI updates before server sync
 *
 * @param farmId - Farm ID
 * @param inventoryId - Feed inventory item ID
 * @param kg - Kilograms to deduct
 */
export async function deductLocalFeedInventory(
  farmId: string,
  inventoryId: string,
  kg: number
): Promise<void> {
  try {
    const db = await getDB();
    const cached = await db.get('feedInventory', farmId);
    if (!cached) return;

    const updatedItems = cached.items.map((item: any) =>
      item.id === inventoryId
        ? { ...item, quantity_kg: Math.max(0, (item.quantity_kg || 0) - kg) }
        : item
    );

    // Update summary if it exists
    const summary = cached.summary
      ? { ...cached.summary, totalKg: Math.max(0, cached.summary.totalKg - kg) }
      : undefined;

    await db.put('feedInventory', {
      ...cached,
      items: updatedItems,
      summary,
      syncStatus: 'pending',
    });
    console.log(`[DataCache] Deducted ${kg}kg from feed inventory ${inventoryId}`);
  } catch (error) {
    console.error('[DataCache] Failed to deduct local feed inventory:', error);
  }
}

/**
 * Add health event to local dashboard cache
 * Used for instant UI updates before server sync
 *
 * @param farmId - Farm ID
 * @param count - Number of health events to add
 */
export async function addLocalHealthEvent(
  farmId: string,
  count: number
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
      dailyFeed: {},
      stageCounts: {},
      monthlyData: [],
      stageKeys: [],
      lastUpdated: Date.now(),
      lastServerSync: 0,
      syncStatus: 'pending',
    };

    updated.stats.recentHealthEvents = (updated.stats.recentHealthEvents || 0) + count;
    updated.syncStatus = 'pending';
    updated.lastUpdated = Date.now();

    await db.put('dashboardStats', updated);
    console.log(`[DataCache] Added ${count} health event(s), total: ${updated.stats.recentHealthEvents}`);
  } catch (error) {
    console.error('[DataCache] Failed to add local health event:', error);
  }
}

/**
 * Update an animal's current weight in the local animals cache
 * Used for instant UI updates before server sync
 *
 * @param farmId - Farm ID
 * @param animalId - Animal ID
 * @param weightKg - New weight in kg
 */
export async function updateLocalAnimalWeight(
  farmId: string,
  animalId: string,
  weightKg: number
): Promise<void> {
  try {
    const db = await getDB();
    const cached = await db.get('animals', farmId);
    if (!cached) return;

    const updatedAnimals = cached.data.map((a: any) =>
      a.id === animalId ? { ...a, current_weight_kg: weightKg } : a
    );

    await db.put('animals', {
      ...cached,
      data: updatedAnimals,
      syncStatus: 'pending',
    });
    console.log(`[DataCache] Updated animal ${animalId} weight to ${weightKg}kg`);
  } catch (error) {
    console.error('[DataCache] Failed to update local animal weight:', error);
  }
}

/**
 * Increment pregnant count in local dashboard cache
 * Used for instant UI updates before server sync
 *
 * @param farmId - Farm ID
 */
export async function incrementLocalPregnantCount(
  farmId: string
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
      dailyFeed: {},
      stageCounts: {},
      monthlyData: [],
      stageKeys: [],
      lastUpdated: Date.now(),
      lastServerSync: 0,
      syncStatus: 'pending',
    };

    updated.stats.pregnantCount = (updated.stats.pregnantCount || 0) + 1;
    updated.stats.pendingConfirmation = Math.max(0, (updated.stats.pendingConfirmation || 0) - 1);
    updated.syncStatus = 'pending';
    updated.lastUpdated = Date.now();

    await db.put('dashboardStats', updated);
    console.log(`[DataCache] Incremented pregnant count to ${updated.stats.pregnantCount}`);
  } catch (error) {
    console.error('[DataCache] Failed to increment local pregnant count:', error);
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
  
  // Group by species
  const speciesMap = new Map<string, {
    total_liters: number;
    animal_ids: Set<string>;
    oldest_date: string;
  }>();

  availableItems.forEach(item => {
    const type = item.livestock_type || 'cattle';
    const existing = speciesMap.get(type);
    if (existing) {
      existing.total_liters += item.liters_remaining;
      existing.animal_ids.add(item.animal_id);
      if (item.record_date < existing.oldest_date) {
        existing.oldest_date = item.record_date;
      }
    } else {
      speciesMap.set(type, {
        total_liters: item.liters_remaining,
        animal_ids: new Set([item.animal_id]),
        oldest_date: item.record_date,
      });
    }
  });

  const bySpecies = Array.from(speciesMap.entries()).map(([livestock_type, data]) => ({
    livestock_type,
    total_liters: data.total_liters,
    animal_count: data.animal_ids.size,
    oldest_date: data.oldest_date,
  })).sort((a, b) => b.total_liters - a.total_liters);

  // Group by animal
  const animalMap = new Map<string, {
    animal_name: string | null;
    ear_tag: string | null;
    livestock_type: string;
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
        livestock_type: item.livestock_type || 'cattle',
        total_liters: item.liters_remaining,
        oldest_date: item.record_date,
        record_count: 1,
      });
    }
  });
  
  const byAnimal = Array.from(animalMap.entries())
    .map(([animal_id, data]) => ({ animal_id, ...data }))
    .sort((a, b) => b.total_liters - a.total_liters);
  
  return { totalLiters, oldestDate, bySpecies, byAnimal };
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
 * Rollback milk inventory deduction on permanent sync failure.
 * Reverse of deductMilkFromInventoryCache() — restores liters_remaining and is_available.
 */
export async function rollbackMilkInventoryDeduction(
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
        return {
          ...item,
          liters_remaining: item.liters_remaining + deduction.litersUsed,
          is_available: true,
          syncStatus: 'synced' as CacheSyncStatus,
        };
      }
      return item;
    });

    const summary = recalculateMilkInventorySummary(items);
    await db.put('milkInventory', { ...existing, items, summary, lastUpdated: Date.now(), syncStatus: 'synced' });

    // Also rollback rejected milk cache if applicable
    const rejectedKey = `${farmId}_rejected`;
    const existingRejected = await db.get('milkInventory', rejectedKey);
    if (existingRejected) {
      const rejItems = existingRejected.items.map(item => {
        const deduction = deductions.find(d => d.id === item.id);
        if (deduction) {
          return { ...item, liters_remaining: item.liters_remaining + deduction.litersUsed, is_available: true, syncStatus: 'synced' as CacheSyncStatus };
        }
        return item;
      });
      const rejSummary = recalculateMilkInventorySummary(rejItems);
      await db.put('milkInventory', { ...existingRejected, items: rejItems, summary: rejSummary, lastUpdated: Date.now(), syncStatus: 'synced' });
    }

    console.log(`[DataCache] Rolled back milk deduction for ${deductions.length} items`);
  } catch (error) {
    console.error('[DataCache] Failed to rollback milk deduction:', error);
  }
}

// ============= MILK PRICE CACHE (localStorage) =============

const MILK_PRICE_CACHE_KEY = 'milk_prices_';
const MILK_PRICE_DEFAULTS: Record<string, number> = { cattle: 30, goat: 45, carabao: 35, sheep: 50 };

/**
 * Cache milk prices per species to localStorage for offline use.
 * Called after successful useLastMilkPriceBySpecies fetch.
 */
export function updateMilkPriceCache(farmId: string, prices: Record<string, number>): void {
  try {
    localStorage.setItem(`${MILK_PRICE_CACHE_KEY}${farmId}`, JSON.stringify({ prices, cachedAt: Date.now() }));
  } catch { /* localStorage full — non-critical */ }
}

/**
 * Get cached milk prices for offline use.
 * Returns null if no cache exists. Consumers should fall back to defaults.
 */
export function getCachedMilkPrices(farmId: string): Record<string, number> | null {
  try {
    const stored = localStorage.getItem(`${MILK_PRICE_CACHE_KEY}${farmId}`);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return { ...MILK_PRICE_DEFAULTS, ...parsed.prices };
  } catch {
    return null;
  }
}

// ============= REJECTED MILK CACHE =============

/**
 * Cache rejected milk inventory separately for offline access.
 * Uses key `${farmId}_rejected` in the milkInventory IndexedDB store.
 */
export async function updateRejectedMilkCache(
  farmId: string,
  items: MilkInventoryCacheItem[],
  summary: MilkInventoryCache['summary']
): Promise<void> {
  try {
    const db = await getDB();
    const cache: MilkInventoryCache = {
      farmId: `${farmId}_rejected`, // Separate key from good milk cache
      items,
      summary,
      lastUpdated: Date.now(),
      lastServerSync: Date.now(),
      syncStatus: 'synced',
    };
    await db.put('milkInventory', cache);
    console.log(`[DataCache] Cached ${items.length} rejected milk items`);
  } catch (error) {
    console.error('[DataCache] Failed to cache rejected milk:', error);
  }
}

/**
 * Get cached rejected milk inventory for offline fallback.
 */
export async function getCachedRejectedMilk(farmId: string): Promise<MilkInventoryCache | null> {
  try {
    const db = await getDB();
    return (await db.get('milkInventory', `${farmId}_rejected`)) || null;
  } catch (error) {
    console.error('[DataCache] Error reading rejected milk cache:', error);
    return null;
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
    clearUpcomingAlertsCache(farmId),
    clearMarketPriceCache(farmId),
    clearHerdValuationCache(farmId),
    clearBreedingAnalyticsCache(farmId),
  ]);
  console.log('[DataCache] All caches cleared for farm:', farmId);
}

// ============= UPCOMING ALERTS CACHE =============

/**
 * Get cached upcoming alerts for a farm
 * Returns cached data if within TTL, null otherwise
 */
export async function getCachedUpcomingAlerts(farmId: string): Promise<UpcomingAlertsCache | null> {
  try {
    const db = await getDB();
    const cached = await db.get('upcomingAlerts', farmId);
    if (!cached) return null;
    
    if (isCacheUsable(cached.lastUpdated)) return cached;
    return null;
  } catch (error) {
    console.error('[DataCache] Error reading upcoming alerts cache:', error);
    return null;
  }
}

/**
 * Update the upcoming alerts cache with fresh data from the server
 */
export async function updateUpcomingAlertsCache(
  farmId: string,
  alerts: UpcomingAlertsCacheItem[],
  daysAhead: number = 7
): Promise<void> {
  try {
    const db = await getDB();
    const cacheEntry: UpcomingAlertsCache = {
      farmId,
      daysAhead,
      alerts,
      lastUpdated: Date.now(),
      syncStatus: 'synced',
    };
    await db.put('upcomingAlerts', cacheEntry);
    console.log(`[DataCache] Upcoming alerts cache updated: ${alerts.length} alerts`);
  } catch (error) {
    console.error('[DataCache] Failed to update upcoming alerts cache:', error);
  }
}

/**
 * Clear upcoming alerts cache for a farm
 */
export async function clearUpcomingAlertsCache(farmId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('upcomingAlerts', farmId);
    console.log('[DataCache] Upcoming alerts cache cleared for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to clear upcoming alerts cache:', error);
  }
}

// ============= MARKET PRICE CACHE FUNCTIONS =============

export async function getCachedMarketPrice(farmId: string): Promise<MarketPriceCacheEntry | null> {
  try {
    const db = await getDB();
    const cached = await db.get('marketPriceCache', farmId);
    if (!cached) return null;
    if (isCacheUsable(cached.lastUpdated)) return cached;
    return null;
  } catch (error) {
    console.error('[DataCache] Error reading market price cache:', error);
    return null;
  }
}

export async function updateMarketPriceCache(farmId: string, data: Omit<MarketPriceCacheEntry, 'farmId' | 'lastUpdated' | 'syncStatus'>): Promise<void> {
  try {
    const db = await getDB();
    await db.put('marketPriceCache', { ...data, farmId, lastUpdated: Date.now(), syncStatus: 'synced' });
    console.log('[DataCache] Market price cache updated for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to update market price cache:', error);
  }
}

export async function clearMarketPriceCache(farmId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('marketPriceCache', farmId);
    console.log('[DataCache] Market price cache cleared for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to clear market price cache:', error);
  }
}

// ============= HERD VALUATION CACHE FUNCTIONS =============

export async function getCachedHerdValuation(farmId: string): Promise<HerdValuationCacheEntry | null> {
  try {
    const db = await getDB();
    const cached = await db.get('herdValuationCache', farmId);
    if (!cached) return null;
    if (isCacheUsable(cached.lastUpdated)) return cached;
    return null;
  } catch (error) {
    console.error('[DataCache] Error reading herd valuation cache:', error);
    return null;
  }
}

// ============= ANIMAL COST CACHE FUNCTIONS =============

export async function getCachedAnimalCosts(farmId: string): Promise<AnimalCostCacheEntry | null> {
  try {
    const db = await getDB();
    const cached = await db.get('animalCostCache', farmId);
    if (!cached) return null;
    if (isCacheUsable(cached.lastUpdated)) return cached;
    return null;
  } catch (error) {
    console.error('[DataCache] Error reading animal cost cache:', error);
    return null;
  }
}

export async function updateAnimalCostCache(farmId: string, data: any): Promise<void> {
  try {
    const db = await getDB();
    await db.put('animalCostCache', { farmId, data, lastUpdated: Date.now(), syncStatus: 'synced' });
    console.log('[DataCache] Animal cost cache updated for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to update animal cost cache:', error);
  }
}

export async function clearAnimalCostCache(farmId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('animalCostCache', farmId);
    console.log('[DataCache] Animal cost cache cleared for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to clear animal cost cache:', error);
  }
}

// ============= BARNS CACHE FUNCTIONS =============

export async function getCachedBarns(farmId: string): Promise<BarnsCacheEntry | null> {
  try {
    const db = await getDB();
    const cached = await db.get('barnsCache', farmId);
    if (!cached) return null;
    if (isCacheUsable(cached.lastUpdated)) return cached;
    return null;
  } catch (error) {
    console.error('[DataCache] Error reading barns cache:', error);
    return null;
  }
}

export async function updateBarnsCache(farmId: string, data: any[]): Promise<void> {
  try {
    const db = await getDB();
    await db.put('barnsCache', { farmId, data, lastUpdated: Date.now(), syncStatus: 'synced' });
    console.log('[DataCache] Barns cache updated for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to update barns cache:', error);
  }
}

export async function clearBarnsCache(farmId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('barnsCache', farmId);
    console.log('[DataCache] Barns cache cleared for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to clear barns cache:', error);
  }
}

// ============= FARM SETTINGS CACHE FUNCTIONS =============

export async function getCachedFarmSettings(farmId: string): Promise<FarmSettingsCacheEntry | null> {
  try {
    const db = await getDB();
    const cached = await db.get('farmSettingsCache', farmId);
    if (!cached) return null;
    if (isCacheUsable(cached.lastUpdated)) return cached;
    return null;
  } catch (error) {
    console.error('[DataCache] Error reading farm settings cache:', error);
    return null;
  }
}

export async function updateFarmSettingsCache(farmId: string, data: any): Promise<void> {
  try {
    const db = await getDB();
    await db.put('farmSettingsCache', { farmId, data, lastUpdated: Date.now(), syncStatus: 'synced' });
    console.log('[DataCache] Farm settings cache updated for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to update farm settings cache:', error);
  }
}

export async function clearFarmSettingsCache(farmId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('farmSettingsCache', farmId);
    console.log('[DataCache] Farm settings cache cleared for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to clear farm settings cache:', error);
  }
}

export async function updateHerdValuationCache(farmId: string, data: any): Promise<void> {
  try {
    const db = await getDB();
    await db.put('herdValuationCache', { farmId, data, lastUpdated: Date.now(), syncStatus: 'synced' });
    console.log('[DataCache] Herd valuation cache updated for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to update herd valuation cache:', error);
  }
}

export async function clearHerdValuationCache(farmId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('herdValuationCache', farmId);
    console.log('[DataCache] Herd valuation cache cleared for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to clear herd valuation cache:', error);
  }
}

// ============= BREEDING ANALYTICS CACHE FUNCTIONS =============

export async function getCachedBreedingAnalytics(farmId: string): Promise<BreedingAnalyticsCacheEntry | null> {
  try {
    const db = await getDB();
    const cached = await db.get('breedingAnalyticsCache', farmId);
    if (!cached) return null;
    if (isCacheUsable(cached.lastUpdated)) return cached;
    return null;
  } catch (error) {
    console.error('[DataCache] Error reading breeding analytics cache:', error);
    return null;
  }
}

export async function updateBreedingAnalyticsCache(farmId: string, data: any): Promise<void> {
  try {
    const db = await getDB();
    await db.put('breedingAnalyticsCache', { farmId, data, lastUpdated: Date.now(), syncStatus: 'synced' });
    console.log('[DataCache] Breeding analytics cache updated for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to update breeding analytics cache:', error);
  }
}

export async function clearBreedingAnalyticsCache(farmId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('breedingAnalyticsCache', farmId);
    console.log('[DataCache] Breeding analytics cache cleared for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to clear breeding analytics cache:', error);
  }
}

// ============= BARN ASSIGNMENTS CACHE FUNCTIONS =============

export async function getCachedBarnAssignments(farmId: string): Promise<BarnAssignmentsCacheEntry | null> {
  try {
    const db = await getDB();
    const cached = await db.get('barnAssignmentsCache', farmId);
    if (!cached) return null;
    if (isCacheUsable(cached.lastUpdated)) return cached;
    return null;
  } catch (error) {
    console.error('[DataCache] Error reading barn assignments cache:', error);
    return null;
  }
}

export async function updateBarnAssignmentsCache(farmId: string, assignments: any[]): Promise<void> {
  try {
    const db = await getDB();
    await db.put('barnAssignmentsCache', { farmId, assignments, lastUpdated: Date.now(), syncStatus: 'synced' });
    console.log('[DataCache] Barn assignments cache updated for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to update barn assignments cache:', error);
  }
}

export async function clearBarnAssignmentsCache(farmId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('barnAssignmentsCache', farmId);
    console.log('[DataCache] Barn assignments cache cleared for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to clear barn assignments cache:', error);
  }
}

/**
 * Optimistically update a single barn assignment locally (add or remove)
 * Used for offline barn animal management
 */
export async function updateLocalBarnAssignment(
  farmId: string,
  action: 'add' | 'remove',
  assignment: any
): Promise<void> {
  try {
    const db = await getDB();
    const cached = await db.get('barnAssignmentsCache', farmId);
    const currentAssignments = cached?.assignments || [];

    let updatedAssignments: any[];
    if (action === 'add') {
      updatedAssignments = [assignment, ...currentAssignments];
    } else {
      updatedAssignments = currentAssignments.map((a: any) =>
        a.id === assignment.id ? { ...a, removed_at: new Date().toISOString() } : a
      );
    }

    await db.put('barnAssignmentsCache', {
      farmId,
      assignments: updatedAssignments,
      lastUpdated: cached?.lastUpdated || Date.now(),
      syncStatus: 'pending',
    });
  } catch (error) {
    console.error('[DataCache] Failed to update local barn assignment:', error);
  }
}

/**
 * Optimistically update a barn in the local barns cache
 */
export async function updateLocalBarn(
  farmId: string,
  action: 'add' | 'update' | 'delete' | 'increment_count' | 'decrement_count',
  barnData: any
): Promise<void> {
  try {
    const db = await getDB();
    const cached = await db.get('barnsCache', farmId);
    const currentBarns = (cached?.data || []) as any[];

    let updatedBarns: any[];
    if (action === 'add') {
      updatedBarns = [...currentBarns, barnData];
    } else if (action === 'delete') {
      updatedBarns = currentBarns.filter((b: any) => b.id !== barnData.id);
    } else if (action === 'update') {
      updatedBarns = currentBarns.map((b: any) =>
        b.id === barnData.id ? { ...b, ...barnData } : b
      );
    } else if (action === 'increment_count') {
      updatedBarns = currentBarns.map((b: any) =>
        b.id === barnData.id ? { ...b, animal_count: (b.animal_count || 0) + 1 } : b
      );
    } else {
      updatedBarns = currentBarns.map((b: any) =>
        b.id === barnData.id ? { ...b, animal_count: Math.max(0, (b.animal_count || 0) - 1) } : b
      );
    }

    await db.put('barnsCache', {
      farmId,
      data: updatedBarns,
      lastUpdated: cached?.lastUpdated || Date.now(),
      syncStatus: 'pending',
    });
  } catch (error) {
    console.error('[DataCache] Failed to update local barn:', error);
  }
}

/**
 * Update an animal's current_barn_id in the local animals cache
 */
export async function updateLocalAnimalBarn(
  farmId: string,
  animalId: string,
  barnId: string | null
): Promise<void> {
  try {
    const db = await getDB();
    const cached = await db.get('animals', farmId);
    if (!cached) return;

    const updatedAnimals = cached.data.map((a: any) =>
      a.id === animalId ? { ...a, current_barn_id: barnId } : a
    );

    await db.put('animals', {
      ...cached,
      data: updatedAnimals,
      syncStatus: 'pending',
    });
  } catch (error) {
    console.error('[DataCache] Failed to update local animal barn:', error);
  }
}

// ============= EXPENSES CACHE FUNCTIONS =============

/**
 * Get cached expenses for a farm (if within grace period)
 */
export async function getCachedExpenses(farmId: string): Promise<ExpensesCacheEntry | null> {
  try {
    const db = await getDB();
    const cached = await db.get('expensesCache', farmId);
    if (!cached) return null;
    if (isCacheUsable(cached.lastUpdated)) return cached;
    return null;
  } catch (error) {
    console.error('[DataCache] Error reading expenses cache:', error);
    return null;
  }
}

/**
 * Update the expenses cache for a farm
 */
export async function updateExpensesCache(farmId: string, data: any[]): Promise<void> {
  try {
    const db = await getDB();
    await db.put('expensesCache', {
      farmId,
      data,
      lastUpdated: Date.now(),
      syncStatus: 'synced' as CacheSyncStatus,
    });
    console.log('[DataCache] Expenses cache updated for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to update expenses cache:', error);
  }
}

/**
 * Clear the expenses cache for a farm
 */
export async function clearExpensesCache(farmId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('expensesCache', farmId);
    console.log('[DataCache] Expenses cache cleared for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to clear expenses cache:', error);
  }
}

// ============= REVENUES CACHE FUNCTIONS =============

/**
 * Get cached revenues for a farm (if within grace period)
 */
export async function getCachedRevenues(farmId: string): Promise<RevenuesCacheEntry | null> {
  try {
    const db = await getDB();
    const cached = await db.get('revenuesCache', farmId);
    if (!cached) return null;
    if (isCacheUsable(cached.lastUpdated)) return cached;
    return null;
  } catch (error) {
    console.error('[DataCache] Error reading revenues cache:', error);
    return null;
  }
}

/**
 * Update the revenues cache for a farm
 */
export async function updateRevenuesCache(farmId: string, data: any[]): Promise<void> {
  try {
    const db = await getDB();
    await db.put('revenuesCache', {
      farmId,
      data,
      lastUpdated: Date.now(),
      syncStatus: 'synced' as CacheSyncStatus,
    });
    console.log('[DataCache] Revenues cache updated for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to update revenues cache:', error);
  }
}

/**
 * Clear the revenues cache for a farm
 */
export async function clearRevenuesCache(farmId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('revenuesCache', farmId);
    console.log('[DataCache] Revenues cache cleared for farm:', farmId);
  } catch (error) {
    console.error('[DataCache] Failed to clear revenues cache:', error);
  }
}
