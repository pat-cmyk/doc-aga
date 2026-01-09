import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  getCachedMilkInventory,
  updateMilkInventoryCache,
  type MilkInventoryCache,
  type MilkInventoryCacheItem,
} from "@/lib/dataCache";

export interface MilkInventoryItem {
  id: string;
  milking_record_id: string;
  animal_id: string;
  animal_name: string | null;
  ear_tag: string | null;
  record_date: string;
  liters_original: number;
  liters_remaining: number;
  is_available: boolean;
  created_at: string;
}

export interface MilkInventorySummary {
  totalLiters: number;
  oldestDate: string | null;
  byAnimal: {
    animal_id: string;
    animal_name: string | null;
    ear_tag: string | null;
    total_liters: number;
    oldest_date: string;
    record_count: number;
  }[];
}

export function useMilkInventory(farmId: string) {
  const isOnline = useOnlineStatus();
  const [cachedData, setCachedData] = useState<MilkInventoryCache | null>(null);
  const [cacheChecked, setCacheChecked] = useState(false);

  // Load cached data immediately on mount for instant display
  useEffect(() => {
    if (!farmId) return;
    
    getCachedMilkInventory(farmId).then((cached) => {
      setCachedData(cached);
      setCacheChecked(true);
      console.log('[MilkInventory] Cache loaded:', {
        hasCache: !!cached,
        itemCount: cached?.items.length ?? 0,
      });
    });
  }, [farmId]);

  // Query the new milk_inventory table directly
  const serverQuery = useQuery({
    queryKey: ["milk-inventory", farmId],
    queryFn: async () => {
      console.log('[MilkInventory] Fetching from milk_inventory table...');
      const { data, error } = await supabase
        .from("milk_inventory")
        .select(`
          id,
          milking_record_id,
          animal_id,
          record_date,
          liters_original,
          liters_remaining,
          is_available,
          created_at,
          client_generated_id,
          animals!inner(name, ear_tag)
        `)
        .eq("farm_id", farmId)
        .eq("is_available", true)
        .gt("liters_remaining", 0)
        .order("record_date", { ascending: true });

      if (error) throw error;

      const items: MilkInventoryCacheItem[] = (data || []).map((r: any) => ({
        id: r.id,
        milking_record_id: r.milking_record_id,
        animal_id: r.animal_id,
        animal_name: r.animals?.name,
        ear_tag: r.animals?.ear_tag,
        record_date: r.record_date,
        liters_original: parseFloat(r.liters_original),
        liters_remaining: parseFloat(r.liters_remaining),
        is_available: r.is_available,
        created_at: r.created_at,
        client_generated_id: r.client_generated_id, // For reconciliation
        syncStatus: 'synced' as const,
      }));

      // Calculate summary using liters_remaining
      const totalLiters = items.reduce((sum, r) => sum + r.liters_remaining, 0);
      const oldestDate = items.length > 0 ? items[0].record_date : null;

      // Group by animal
      const animalMap = new Map<string, {
        animal_name: string | null;
        ear_tag: string | null;
        total_liters: number;
        oldest_date: string;
        record_count: number;
      }>();

      items.forEach(item => {
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

      const byAnimal = Array.from(animalMap.entries()).map(([animal_id, data]) => ({
        animal_id,
        ...data,
      })).sort((a, b) => b.total_liters - a.total_liters);

      const summary: MilkInventorySummary = {
        totalLiters,
        oldestDate,
        byAnimal,
      };

      // Update cache with server data
      await updateMilkInventoryCache(farmId, items, summary);
      
      // Update local state
      const newCache = await getCachedMilkInventory(farmId);
      if (newCache) {
        setCachedData(newCache);
      }

      console.log('[MilkInventory] Server returned', items.length, 'items, total', totalLiters.toFixed(1), 'L');
      return { items, summary };
    },
    enabled: !!farmId && cacheChecked && isOnline,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Transform cache/server items to the consistent MilkInventoryItem type
  const transformItem = (item: any): MilkInventoryItem => ({
    id: item.id,
    milking_record_id: item.milking_record_id || item.id,
    animal_id: item.animal_id,
    animal_name: item.animal_name,
    ear_tag: item.ear_tag,
    record_date: item.record_date,
    liters_original: item.liters_original ?? item.liters ?? 0,
    liters_remaining: item.liters_remaining ?? item.liters ?? 0,
    is_available: item.is_available ?? true,
    created_at: item.created_at,
  });

  // Prioritize server data, fall back to cache
  const items: MilkInventoryItem[] = serverQuery.data?.items?.map(transformItem) 
    || cachedData?.items?.map(transformItem) 
    || [];
  
  const summary: MilkInventorySummary = serverQuery.data?.summary || cachedData?.summary || {
    totalLiters: 0,
    oldestDate: null,
    byAnimal: [],
  };

  const refetch = async () => {
    return serverQuery.refetch();
  };

  // Never return undefined if we have any cached data - prevents "empty inventory" flash
  const hasCachedData = !!cachedData && (cachedData.items.length > 0 || cachedData.summary.totalLiters > 0);
  const hasAnyData = items.length > 0 || hasCachedData;

  return {
    data: hasAnyData ? { items, summary } : undefined,
    isLoading: !cacheChecked || (!cachedData && serverQuery.isLoading),
    isFetching: serverQuery.isFetching,
    isError: serverQuery.isError && !cachedData,
    error: serverQuery.error,
    refetch,
    hasCachedData,
    cachedItemCount: cachedData?.items.length ?? 0,
  };
}

export function useMilkSalesHistory(farmId: string) {
  return useQuery({
    queryKey: ["milk-sales-history", farmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milk_inventory")
        .select(`
          id,
          milking_record_id,
          animal_id,
          record_date,
          liters_original,
          liters_remaining,
          is_available,
          created_at,
          animals!inner(name, ear_tag)
        `)
        .eq("farm_id", farmId)
        .eq("is_available", false)
        .order("updated_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      return (data || []).map((r: any) => ({
        id: r.id,
        milking_record_id: r.milking_record_id,
        animal_id: r.animal_id,
        animal_name: r.animals?.name,
        ear_tag: r.animals?.ear_tag,
        record_date: r.record_date,
        liters_original: parseFloat(r.liters_original),
        liters_sold: parseFloat(r.liters_original) - parseFloat(r.liters_remaining),
      }));
    },
    enabled: !!farmId,
  });
}
