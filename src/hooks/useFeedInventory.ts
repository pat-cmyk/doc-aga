import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getCachedFeedInventory, updateFeedInventoryCache } from '@/lib/dataCache';
import type { FeedInventoryItem } from '@/lib/feedInventory';

/**
 * Summary of feed inventory with computed metrics
 * SSOT for all feed-related dashboard and operations data
 */
export interface FeedInventorySummary {
  totalKg: number;
  concentrateKg: number;
  roughageKg: number;
  mineralsKg: number;
  supplementsKg: number;
  concentrateDays: number | null;
  roughageDays: number | null;
  feedStockDays: number | null; // Based on roughage only (survival buffer)
  totalValue: number;
  expiringCount: number;
  lowStockCount: number;
}

/**
 * Consumption rates by livestock type (kg/day)
 */
const CONSUMPTION_RATES: Record<string, number> = {
  cattle: 12,
  carabao: 10,
  goat: 1.5,
  sheep: 2,
  default: 10
};

/**
 * Diet composition ratios
 */
const DIET_RATIOS = {
  roughage: 0.7,   // 70% roughage
  concentrate: 0.3 // 30% concentrates
};

/**
 * Compute feed inventory summary from items
 * Reusable for both online and offline calculations
 */
export function computeFeedSummary(
  items: FeedInventoryItem[],
  totalDailyConsumption: number = 0
): FeedInventorySummary {
  // Categorize by explicit category column
  const concentrateKg = items
    .filter(i => i.category === 'concentrates')
    .reduce((sum, i) => sum + (i.quantity_kg || 0), 0);
  
  const roughageKg = items
    .filter(i => i.category === 'roughage' || !i.category)
    .reduce((sum, i) => sum + (i.quantity_kg || 0), 0);
  
  const mineralsKg = items
    .filter(i => i.category === 'minerals')
    .reduce((sum, i) => sum + (i.quantity_kg || 0), 0);
  
  const supplementsKg = items
    .filter(i => i.category === 'supplements')
    .reduce((sum, i) => sum + (i.quantity_kg || 0), 0);

  const totalKg = items.reduce((sum, i) => sum + (i.quantity_kg || 0), 0);

  // Calculate daily consumption by category
  const dailyRoughageConsumption = totalDailyConsumption * DIET_RATIOS.roughage;
  const dailyConcentrateConsumption = totalDailyConsumption * DIET_RATIOS.concentrate;

  // Calculate days remaining
  const roughageDays = dailyRoughageConsumption > 0
    ? Math.floor(roughageKg / dailyRoughageConsumption)
    : null;
  
  const concentrateDays = dailyConcentrateConsumption > 0
    ? Math.floor((concentrateKg + mineralsKg + supplementsKg) / dailyConcentrateConsumption)
    : null;

  // Feed stock days = roughage only (livestock can survive on roughage alone)
  const feedStockDays = roughageDays;

  // Calculate total inventory value
  const totalValue = items.reduce((sum, item) => {
    const costPerKg = item.cost_per_unit || 0;
    return sum + (item.quantity_kg * costPerKg);
  }, 0);

  // Count expiring items (within 30 days)
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringCount = items.filter(item => {
    if (!item.expiry_date) return false;
    const expiry = new Date(item.expiry_date);
    return expiry <= thirtyDaysFromNow;
  }).length;

  // Count low stock items
  const lowStockCount = items.filter(item => {
    if (!item.reorder_threshold) return false;
    return item.quantity_kg <= item.reorder_threshold;
  }).length;

  return {
    totalKg,
    concentrateKg,
    roughageKg,
    mineralsKg,
    supplementsKg,
    concentrateDays,
    roughageDays,
    feedStockDays,
    totalValue,
    expiringCount,
    lowStockCount
  };
}

/**
 * Calculate total daily consumption based on animal counts
 */
export function calculateTotalDailyConsumption(
  animalCounts: { livestockType: string; count: number }[]
): number {
  return animalCounts.reduce((total, { livestockType, count }) => {
    const rate = CONSUMPTION_RATES[livestockType.toLowerCase()] || CONSUMPTION_RATES.default;
    return total + (rate * count);
  }, 0);
}

interface UseFeedInventoryOptions {
  enableRealtime?: boolean;
}

/**
 * Single Source of Truth hook for feed inventory
 * 
 * Features:
 * - Offline-first: Reads from IndexedDB cache immediately
 * - Realtime updates: Subscribes to Postgres changes when online
 * - Computed summary: Provides aggregated metrics
 * - Farm-scoped: All queries filter by farm_id
 */
export function useFeedInventory(
  farmId: string,
  options: UseFeedInventoryOptions = {}
) {
  const { enableRealtime = true } = options;
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();
  
  const [cachedData, setCachedData] = useState<FeedInventoryItem[] | null>(null);
  const [animalConsumption, setAnimalConsumption] = useState<number>(0);

  // Load cached data AND cached consumption immediately on mount
  useEffect(() => {
    if (!farmId) return;
    
    const loadCache = async () => {
      const cached = await getCachedFeedInventory(farmId);
      if (cached?.items) {
        setCachedData(cached.items as FeedInventoryItem[]);
      }
      // Load cached daily consumption for offline calculations
      if (cached?.dailyConsumption) {
        setAnimalConsumption(cached.dailyConsumption);
      }
    };
    loadCache();
  }, [farmId]);

  // Fetch animal consumption rates when online (updates cache for future offline use)
  useEffect(() => {
    if (!farmId || !isOnline) return;

    const loadConsumption = async () => {
      const { data: animals } = await supabase
        .from('animals')
        .select('livestock_type')
        .eq('farm_id', farmId)
        .eq('is_deleted', false);

      if (animals) {
        const counts = animals.reduce((acc, animal) => {
          const type = animal.livestock_type || 'cattle';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const consumption = calculateTotalDailyConsumption(
          Object.entries(counts).map(([livestockType, count]) => ({ 
            livestockType, 
            count 
          }))
        );
        setAnimalConsumption(consumption);
      }
    };
    loadConsumption();
  }, [farmId, isOnline]);

  // Main query with cache-first strategy
  const { 
    data: serverData, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['feed-inventory', farmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feed_inventory')
        .select('*')
        .eq('farm_id', farmId)
        .order('feed_type');

      if (error) throw error;
      
      // Update cache with fresh data
      await updateFeedInventoryCache(farmId);
      
      return data as FeedInventoryItem[];
    },
    enabled: !!farmId && isOnline,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30,   // 30 minutes
  });

  // Use server data when available, fallback to cache
  const inventory = useMemo(() => {
    return serverData || cachedData || [];
  }, [serverData, cachedData]);

  // Compute summary from inventory
  const summary = useMemo(() => {
    return computeFeedSummary(inventory, animalConsumption);
  }, [inventory, animalConsumption]);

  // Realtime subscription
  useEffect(() => {
    if (!farmId || !enableRealtime || !isOnline) return;

    const channel = supabase
      .channel(`feed-inventory-${farmId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feed_inventory',
          filter: `farm_id=eq.${farmId}`
        },
        () => {
          // Refetch on any change
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [farmId, enableRealtime, isOnline, refetch]);

  // Get item by ID
  const getItemById = useCallback((id: string) => {
    return inventory.find(item => item.id === id);
  }, [inventory]);

  // Get items by category
  const getItemsByCategory = useCallback((category: string) => {
    return inventory.filter(item => item.category === category);
  }, [inventory]);

  // Optimistic update helper
  const optimisticUpdate = useCallback((
    updater: (items: FeedInventoryItem[]) => FeedInventoryItem[]
  ) => {
    queryClient.setQueryData(
      ['feed-inventory', farmId],
      (old: FeedInventoryItem[] | undefined) => updater(old || [])
    );
  }, [queryClient, farmId]);

  // Deduct stock (for consumption)
  const deductStock = useCallback(async (
    itemId: string,
    kilograms: number
  ): Promise<boolean> => {
    const item = getItemById(itemId);
    if (!item || item.quantity_kg < kilograms) return false;

    // Optimistic update
    optimisticUpdate(items => 
      items.map(i => 
        i.id === itemId 
          ? { ...i, quantity_kg: i.quantity_kg - kilograms }
          : i
      )
    );

    if (isOnline) {
      const { error } = await supabase
        .from('feed_inventory')
        .update({ quantity_kg: item.quantity_kg - kilograms })
        .eq('id', itemId);

      if (error) {
        // Rollback on error
        refetch();
        return false;
      }
    }

    return true;
  }, [getItemById, optimisticUpdate, isOnline, refetch]);

  return {
    // Data
    inventory,
    summary,
    
    // State
    loading: isLoading && !cachedData,
    error,
    isOnline,
    isCached: !!cachedData && !serverData,
    
    // Actions
    reload: refetch,
    getItemById,
    getItemsByCategory,
    deductStock,
    optimisticUpdate,
    
    // Raw consumption for external calculations
    dailyConsumption: animalConsumption
  };
}

export default useFeedInventory;
