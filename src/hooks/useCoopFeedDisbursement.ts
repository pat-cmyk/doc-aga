/**
 * @online-only Cooperative feed disbursement hooks.
 * Records feed released from the hub to member farms (Feed-Out).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CoopFeedDisbursement {
  id: string;
  farm_id: string;
  farm_name: string;
  disbursement_date: string;
  feed_type: string;
  category: string;
  quantity_kg: number;
  cost_per_kg: number;
  total_cost: number;
  disbursed_by: string;
  notes: string | null;
  status: "active" | "reversed";
  entry_type: "original" | "reversal" | "correction";
  original_disbursement_id: string | null;
  reversal_reason: string | null;
  created_at: string;
}

export const useCoopFeedDisbursements = (
  cooperativeId: string | null,
  dateRange?: { from: string; to: string } | null
) => {
  return useQuery({
    queryKey: ["coop-feed-disbursements", cooperativeId, dateRange],
    queryFn: async () => {
      if (!cooperativeId) return [];
      const { data, error } = await (supabase.rpc as any)("get_coop_feed_disbursements", {
        _cooperative_id: cooperativeId,
        _date_from: dateRange?.from || null,
        _date_to: dateRange?.to || null,
      });
      if (error) throw error;
      return (data || []) as CoopFeedDisbursement[];
    },
    enabled: !!cooperativeId,
  });
};

export const useAddCoopFeedDisbursement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      cooperativeId: string;
      farmId: string;
      coopFeedInventoryId: string;
      quantityKg: number;
      notes?: string;
    }) => {
      const { data, error } = await (supabase.rpc as any)("record_coop_feed_disbursement", {
        _cooperative_id: params.cooperativeId,
        _farm_id: params.farmId,
        _coop_feed_inventory_id: params.coopFeedInventoryId,
        _quantity_kg: params.quantityKg,
        _notes: params.notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["coop-feed-inventory", variables.cooperativeId] });
      queryClient.invalidateQueries({ queryKey: ["coop-feed-disbursements", variables.cooperativeId] });
    },
  });
};

export const useCorrectCoopFeedDisbursement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      originalId: string;
      newQuantityKg: number;
      reason: string;
    }) => {
      const { data, error } = await (supabase.rpc as any)("correct_coop_feed_disbursement", {
        _original_id: params.originalId,
        _new_quantity_kg: params.newQuantityKg,
        _reason: params.reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coop-feed-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["coop-feed-disbursements"] });
      queryClient.invalidateQueries({ queryKey: ["coop-soa"] });
    },
  });
};
