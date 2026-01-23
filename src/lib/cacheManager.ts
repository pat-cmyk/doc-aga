import { QueryClient } from "@tanstack/react-query";
import { 
  clearMilkInventoryCache, 
  clearDashboardCache,
  clearAnimalCache,
} from "./dataCache";

/**
 * Cache dependency map: defines which caches need invalidation for each mutation type
 * 
 * When data is mutated, all related caches must be invalidated to prevent stale data.
 * IndexedDB (offline cache) and React Query (in-memory cache) are both cleared.
 */
const CACHE_DEPENDENCIES: Record<string, string[]> = {
  'milk-record': ['milk-inventory', 'milking-records', 'dashboard', 'lactating-animals', 'animals'],
  'health-record': ['health-records', 'dashboard'],
  'feed-record': ['feeding-records', 'feed-inventory', 'dashboard'],
  'animal': ['animals', 'dashboard', 'milk-inventory', 'lactating-animals'],
  'ai-record': ['ai-records', 'dashboard', 'breeding-stats', 'heat-records'],
  'weight-record': ['weight-records', 'dashboard', 'animals', 'feed-inventory', 'lactating-animals'],
  'bcs-record': ['bcs-records', 'dashboard'],
  'heat-record': ['heat-records', 'dashboard', 'breeding-stats'],
  'expense': ['expenses', 'expense-summary', 'dashboard', 'profitability'],
  'revenue': ['revenues', 'revenue-summary', 'dashboard', 'profitability'],
  'milk-sale': ['milk-inventory', 'milk-sales-history', 'dashboard', 'revenues', 'revenue-summary'],
  'dry-off': ['animals', 'lactating-animals', 'dashboard', 'milk-inventory'],
};

/**
 * Maps cache keys to their IndexedDB clear functions
 */
async function clearIndexedDBCache(cacheKey: string, farmId: string): Promise<void> {
  switch (cacheKey) {
    case 'milk-inventory':
      await clearMilkInventoryCache(farmId);
      break;
    case 'dashboard':
      await clearDashboardCache(farmId);
      break;
    case 'animals':
      await clearAnimalCache(farmId);
      break;
    // React Query only caches (no IndexedDB equivalent)
    default:
      break;
  }
}

/**
 * Unified Cache Manager
 * 
 * Coordinates cache invalidation between IndexedDB (offline) and React Query (in-memory).
 * Ensures all related caches are invalidated when data changes.
 */
class CacheManager {
  private queryClient: QueryClient;

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  /**
   * Invalidate all caches related to a mutation type
   * 
   * @param mutationType - The type of data being mutated (e.g., 'milk-record')
   * @param farmId - The farm ID to scope cache invalidation
   */
  async invalidateForMutation(
    mutationType: keyof typeof CACHE_DEPENDENCIES,
    farmId: string
  ): Promise<void> {
    const relatedCaches = CACHE_DEPENDENCIES[mutationType] || [];
    
    console.log(`[CacheManager] Invalidating caches for ${mutationType}:`, relatedCaches);

    // Clear all related caches in parallel
    await Promise.all(
      relatedCaches.map(async (cacheKey) => {
        // Clear IndexedDB cache
        await clearIndexedDBCache(cacheKey, farmId);

        // Invalidate React Query cache (with and without farmId)
        this.queryClient.invalidateQueries({ queryKey: [cacheKey] });
        this.queryClient.invalidateQueries({ queryKey: [cacheKey, farmId] });
      })
    );

    // Force refetch of primary cache for immediate update
    if (relatedCaches.length > 0) {
      await this.queryClient.refetchQueries({ 
        queryKey: [relatedCaches[0], farmId],
        type: 'active',
      });
    }
    
    console.log(`[CacheManager] Cache invalidation complete for ${mutationType}`);
  }

  /**
   * Force refresh all caches for a farm
   * Used when switching farms or after major sync operations
   */
  async refreshAllForFarm(farmId: string): Promise<void> {
    const allCacheKeys = new Set(Object.values(CACHE_DEPENDENCIES).flat());
    
    await Promise.all(
      Array.from(allCacheKeys).map(async (cacheKey) => {
        await clearIndexedDBCache(cacheKey, farmId);
        this.queryClient.invalidateQueries({ queryKey: [cacheKey, farmId] });
      })
    );
    
    console.log(`[CacheManager] All caches refreshed for farm ${farmId}`);
  }
}

// Singleton instance
let cacheManagerInstance: CacheManager | null = null;

/**
 * Get the CacheManager singleton instance
 * @throws Error if CacheManager has not been initialized
 */
export function getCacheManager(): CacheManager {
  if (!cacheManagerInstance) {
    throw new Error("CacheManager not initialized. Call initCacheManager first.");
  }
  return cacheManagerInstance;
}

/**
 * Initialize the CacheManager with a QueryClient
 * Should be called once at app startup
 */
export function initCacheManager(queryClient: QueryClient): void {
  cacheManagerInstance = new CacheManager(queryClient);
  console.log("[CacheManager] Initialized");
}

/**
 * Check if CacheManager has been initialized
 */
export function isCacheManagerReady(): boolean {
  return cacheManagerInstance !== null;
}
