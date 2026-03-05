import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/errorHandling";
import { getCacheManager, isCacheManagerReady } from "@/lib/cacheManager";
import { updateMilkPriceCache, getCachedRevenues, updateRevenuesCache } from "@/lib/dataCache";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { format } from "date-fns";
import { DateRange } from "@/components/finance/FinanceDateRangePicker";

export interface Revenue {
  id: string;
  farm_id: string;
  user_id: string;
  amount: number;
  source: string;
  transaction_date: string;
  linked_animal_id: string | null;
  linked_milk_log_id: string | null;
  notes: string | null;
  is_deleted: boolean;
  created_at: string;
}

export interface AddRevenueData {
  farm_id: string;
  amount: number;
  source: string;
  transaction_date?: string;
  linked_animal_id?: string;
  linked_milk_log_id?: string;
  notes?: string;
}

export function useRevenues(farmId: string, dateRange?: DateRange) {
  const isOnline = useOnlineStatus();

  return useQuery({
    queryKey: ["revenues", farmId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async () => {
      // 1. Try IndexedDB cache first
      const cached = await getCachedRevenues(farmId);

      // 2. If offline, serve from cache with client-side date filtering
      if (!isOnline) {
        if (cached) {
          let items = cached.data as Revenue[];
          if (dateRange) {
            const startStr = format(dateRange.start, "yyyy-MM-dd");
            const endStr = format(dateRange.end, "yyyy-MM-dd");
            items = items.filter(
              (r) => r.transaction_date >= startStr && r.transaction_date <= endStr
            );
          }
          return items;
        }
        return [] as Revenue[];
      }

      // 3. Online: fetch from Supabase
      let query = supabase
        .from("farm_revenues")
        .select("*")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .order("transaction_date", { ascending: false });

      if (dateRange) {
        query = query
          .gte("transaction_date", format(dateRange.start, "yyyy-MM-dd"))
          .lte("transaction_date", format(dateRange.end, "yyyy-MM-dd"));
      }

      const { data, error } = await query;
      if (error) throw error;

      const revenues = data as Revenue[];

      // 4. Update cache with unfiltered data (only when no date filter to avoid partial cache)
      if (!dateRange) {
        await updateRevenuesCache(farmId, revenues);
      }

      return revenues;
    },
    enabled: !!farmId,
  });
}

export function useAddRevenue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddRevenueData) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: revenue, error } = await supabase
        .from("farm_revenues")
        .insert({
          ...data,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return revenue as Revenue;
    },
    onSuccess: async (_, variables) => {
      if (isCacheManagerReady()) {
        await getCacheManager().invalidateForMutation('revenue', variables.farm_id);
      } else {
        queryClient.invalidateQueries({ queryKey: ["revenues", variables.farm_id] });
        queryClient.invalidateQueries({ queryKey: ["revenue-summary", variables.farm_id] });
      }
      toast.success("Revenue added successfully");
    },
    onError: (error) => {
      showErrorToast(error, "adding revenue");
    },
  });
}

export function useUpdateRevenue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Revenue> & { id: string }) => {
      const { data: revenue, error } = await supabase
        .from("farm_revenues")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return revenue as Revenue;
    },
    onSuccess: async (data) => {
      if (isCacheManagerReady()) {
        await getCacheManager().invalidateForMutation('revenue', data.farm_id);
      } else {
        queryClient.invalidateQueries({ queryKey: ["revenues", data.farm_id] });
        queryClient.invalidateQueries({ queryKey: ["revenue-summary", data.farm_id] });
        queryClient.invalidateQueries({ queryKey: ["profitability", data.farm_id] });
      }
      toast.success("Revenue updated successfully");
    },
    onError: (error) => {
      showErrorToast(error, "updating revenue");
    },
  });
}

export function useDeleteRevenue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, farmId }: { id: string; farmId: string }) => {
      const { error } = await supabase
        .from("farm_revenues")
        .update({ is_deleted: true })
        .eq("id", id);

      if (error) throw error;
      return { id, farmId };
    },
    onSuccess: async (data) => {
      if (isCacheManagerReady()) {
        await getCacheManager().invalidateForMutation('revenue', data.farmId);
      } else {
        queryClient.invalidateQueries({ queryKey: ["revenues", data.farmId] });
        queryClient.invalidateQueries({ queryKey: ["revenue-summary", data.farmId] });
        queryClient.invalidateQueries({ queryKey: ["profitability", data.farmId] });
      }
      toast.success("Revenue deleted successfully");
    },
    onError: (error) => {
      showErrorToast(error, "deleting revenue");
    },
  });
}

export function useLastMilkPrice(farmId: string) {
  return useQuery({
    queryKey: ["last-milk-price", farmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milking_records")
        .select("price_per_liter, animal_id, animals!inner(farm_id)")
        .eq("animals.farm_id", farmId)
        .eq("is_sold", true)
        .not("price_per_liter", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      return data?.[0]?.price_per_liter || 65;
    },
    enabled: !!farmId,
  });
}

export type SpeciesPriceMap = Record<string, number>;

export function useLastMilkPriceBySpecies(farmId: string) {
  return useQuery({
    queryKey: ["last-milk-price-by-species", farmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milking_records")
        .select(`
          price_per_liter, 
          animal_id, 
          created_at,
          animals!inner(farm_id, livestock_type)
        `)
        .eq("animals.farm_id", farmId)
        .eq("is_sold", true)
        .not("price_per_liter", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const priceMap: SpeciesPriceMap = {};
      const seen = new Set<string>();
      
      for (const record of data || []) {
        const type = (record.animals as any)?.livestock_type;
        if (type && !seen.has(type)) {
          priceMap[type] = record.price_per_liter as number;
          seen.add(type);
        }
      }

      const result = {
        cattle: priceMap.cattle ?? 30,
        goat: priceMap.goat ?? 45,
        carabao: priceMap.carabao ?? 35,
        sheep: priceMap.sheep ?? 50,
        ...priceMap,
      };

      // Cache for offline milk feeding
      updateMilkPriceCache(farmId, result);

      return result;
    },
    enabled: !!farmId,
  });
}
