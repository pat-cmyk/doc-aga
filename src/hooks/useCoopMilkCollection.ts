/**
 * @online-only Cooperative milk collection hooks.
 * Records milk delivered by member farms to the CAIN cooperative hub.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CoopMilkReceiving {
  id: string;
  farm_id: string;
  farm_name: string;
  receiving_date: string;
  session: string;
  volume_liters: number;
  species: string;
  milk_quality: string;
  price_per_liter: number;
  total_value: number;
  received_by: string;
  notes: string | null;
  status: "active" | "reversed";
  entry_type: "original" | "reversal" | "correction";
  original_receiving_id: string | null;
  reversal_reason: string | null;
  created_at: string;
}

export const useCoopMilkReceivings = (
  cooperativeId: string | null,
  dateRange?: { from: string; to: string } | null
) => {
  return useQuery({
    queryKey: ["coop-milk-receivings", cooperativeId, dateRange],
    queryFn: async () => {
      if (!cooperativeId) return [];
      const { data, error } = await (supabase.rpc as any)("get_coop_milk_receivings", {
        _cooperative_id: cooperativeId,
        _date_from: dateRange?.from || null,
        _date_to: dateRange?.to || null,
      });
      if (error) throw error;
      return (data || []) as CoopMilkReceiving[];
    },
    enabled: !!cooperativeId,
  });
};

export const useAddCoopMilkReceiving = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      cooperativeId: string;
      farmId: string;
      receivingDate: string;
      session: string;
      volumeLiters: number;
      species: string;
      milkQuality?: string;
      pricePerLiter?: number;
      notes?: string;
    }) => {
      const { data, error } = await (supabase.rpc as any)("record_coop_milk_receiving", {
        _cooperative_id: params.cooperativeId,
        _farm_id: params.farmId,
        _receiving_date: params.receivingDate,
        _session: params.session,
        _volume_liters: params.volumeLiters,
        _species: params.species,
        _milk_quality: params.milkQuality || "good",
        _price_per_liter: params.pricePerLiter || null,
        _notes: params.notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["coop-milk-receivings", variables.cooperativeId] });
    },
  });
};

export const useCorrectCoopMilkReceiving = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      originalId: string;
      newVolumeLiters: number;
      newPricePerLiter?: number;
      reason: string;
    }) => {
      const { data, error } = await (supabase.rpc as any)("correct_coop_milk_receiving", {
        _original_id: params.originalId,
        _new_volume_liters: params.newVolumeLiters,
        _new_price_per_liter: params.newPricePerLiter || null,
        _reason: params.reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coop-milk-receivings"] });
      queryClient.invalidateQueries({ queryKey: ["coop-soa"] });
    },
  });
};
