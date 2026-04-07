/**
 * @online-only Cooperative price schedule hooks.
 * Manages standing milk price list by species for the CAIN hub.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CoopPriceEntry {
  id: string;
  species: string;
  price_per_liter: number;
  effective_date: string;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export const useCoopPriceSchedule = (cooperativeId: string | null) => {
  return useQuery({
    queryKey: ["coop-price-schedule", cooperativeId],
    queryFn: async () => {
      if (!cooperativeId) return [];
      const { data, error } = await supabase.rpc("get_coop_price_schedule", {
        _cooperative_id: cooperativeId,
      });
      if (error) throw error;
      return (data || []) as CoopPriceEntry[];
    },
    enabled: !!cooperativeId,
  });
};

export const useActiveCoopPrice = (cooperativeId: string | null, species: string | null) => {
  return useQuery({
    queryKey: ["coop-active-price", cooperativeId, species],
    queryFn: async () => {
      if (!cooperativeId || !species) return null;
      const { data, error } = await supabase.rpc("get_active_coop_price", {
        _cooperative_id: cooperativeId,
        _species: species,
      });
      if (error) throw error;
      return data as number | null;
    },
    enabled: !!cooperativeId && !!species,
  });
};

export const useSetCoopMilkPrice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      cooperativeId: string;
      species: string;
      pricePerLiter: number;
      effectiveDate: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc("set_coop_milk_price", {
        _cooperative_id: params.cooperativeId,
        _species: params.species,
        _price_per_liter: params.pricePerLiter,
        _effective_date: params.effectiveDate,
        _notes: params.notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["coop-price-schedule", variables.cooperativeId] });
      queryClient.invalidateQueries({ queryKey: ["coop-active-price", variables.cooperativeId] });
    },
  });
};
