import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  getCachedMilkInventory,
  updateMilkInventoryCache,
  isMilkInventoryCacheFresh,
  type MilkInventoryCache,
  type MilkInventoryCacheItem,
} from "@/lib/dataCache";

export interface MilkInventoryItem {
  id: string;
  animal_id: string;
  animal_name: string | null;
  ear_tag: string | null;
  record_date: string;
  liters: number;
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
  const [isCacheFresh, setIsCacheFresh] = useState(false);

  // Load cached data immediately on mount
  useEffect(() => {
    if (!farmId) return;
    
    getCachedMilkInventory(farmId).then(cached => {
      if (cached) {
        setCachedData(cached);
        console.log('[MilkInventory] Loaded cached data:', cached.items.length, 'items');
      }
    });
    
    isMilkInventoryCacheFresh(farmId).then(fresh => {
      setIsCacheFresh(fresh);
    });
  }, [farmId]);

  // Server query - only runs if online and cache is stale
  const serverQuery = useQuery({
    queryKey: ["milk-inventory", farmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milking_records")
        .select(`
          id,
          animal_id,
          record_date,
          liters,
          created_at,
          animals!inner(farm_id, name, ear_tag)
        `)
        .eq("animals.farm_id", farmId)
        .or("is_sold.eq.false,is_sold.is.null")
        .order("record_date", { ascending: true });

      if (error) throw error;

      const items: MilkInventoryCacheItem[] = (data || []).map((r: any) => ({
        id: r.id,
        animal_id: r.animal_id,
        animal_name: r.animals?.name,
        ear_tag: r.animals?.ear_tag,
        record_date: r.record_date,
        liters: parseFloat(r.liters),
        created_at: r.created_at,
        syncStatus: 'synced' as const,
      }));

      // Calculate summary
      const totalLiters = items.reduce((sum, r) => sum + r.liters, 0);
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
          existing.total_liters += item.liters;
          existing.record_count += 1;
          if (item.record_date < existing.oldest_date) {
            existing.oldest_date = item.record_date;
          }
        } else {
          animalMap.set(item.animal_id, {
            animal_name: item.animal_name,
            ear_tag: item.ear_tag,
            total_liters: item.liters,
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

      return { items, summary };
    },
    // Only fetch from server if online AND cache is stale
    enabled: !!farmId && isOnline && !isCacheFresh,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Derive the data to return - prefer cached data for instant display
  const items: MilkInventoryItem[] = serverQuery.data?.items || cachedData?.items || [];
  const summary: MilkInventorySummary = serverQuery.data?.summary || cachedData?.summary || {
    totalLiters: 0,
    oldestDate: null,
    byAnimal: [],
  };

  return {
    data: items.length > 0 || cachedData ? { items, summary } : undefined,
    isLoading: !cachedData && serverQuery.isLoading,
    isError: serverQuery.isError && !cachedData,
    error: serverQuery.error,
    refetch: serverQuery.refetch,
  };
}

export function useMilkSalesHistory(farmId: string) {
  return useQuery({
    queryKey: ["milk-sales-history", farmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milking_records")
        .select(`
          id,
          animal_id,
          record_date,
          liters,
          price_per_liter,
          sale_amount,
          is_sold,
          created_at,
          animals!inner(farm_id, name, ear_tag)
        `)
        .eq("animals.farm_id", farmId)
        .eq("is_sold", true)
        .not("sale_amount", "is", null)
        .order("record_date", { ascending: false })
        .limit(100);

      if (error) throw error;

      return (data || []).map((r: any) => ({
        id: r.id,
        animal_id: r.animal_id,
        animal_name: r.animals?.name,
        ear_tag: r.animals?.ear_tag,
        record_date: r.record_date,
        liters: parseFloat(r.liters),
        price_per_liter: r.price_per_liter ? parseFloat(r.price_per_liter) : null,
        sale_amount: r.sale_amount ? parseFloat(r.sale_amount) : null,
      }));
    },
    enabled: !!farmId,
  });
}
