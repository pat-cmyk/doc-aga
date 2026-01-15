import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCacheManager, isCacheManagerReady } from "@/lib/cacheManager";

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

export function useRevenues(farmId: string) {
  return useQuery({
    queryKey: ["revenues", farmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farm_revenues")
        .select("*")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .order("transaction_date", { ascending: false });

      if (error) throw error;
      return data as Revenue[];
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
      return data?.[0]?.price_per_liter || 65; // Default to ₱65/liter
    },
    enabled: !!farmId,
  });
}
