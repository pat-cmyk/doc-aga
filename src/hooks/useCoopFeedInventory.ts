/**
 * @online-only Cooperative feed inventory hooks.
 * Manages the hub's own feed stock for the CAIN program.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CoopFeedItem {
  id: string;
  feed_type: string;
  category: string;
  quantity_kg: number;
  cost_per_kg: number;
  total_value: number;
  purchase_date: string | null;
  supplier: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
  last_updated: string;
}

export const useCoopFeedInventory = (cooperativeId: string | null) => {
  return useQuery({
    queryKey: ["coop-feed-inventory", cooperativeId],
    queryFn: async () => {
      if (!cooperativeId) return [];
      const { data, error } = await supabase.rpc("get_coop_feed_inventory", {
        _cooperative_id: cooperativeId,
      });
      if (error) throw error;
      return (data || []) as CoopFeedItem[];
    },
    enabled: !!cooperativeId,
  });
};

export const useAddCoopFeedStock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      cooperativeId: string;
      feedType: string;
      category: string;
      quantityKg: number;
      costPerKg: number;
      purchaseDate?: string;
      supplier?: string;
      batchNumber?: string;
      expiryDate?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc("add_coop_feed_stock", {
        _cooperative_id: params.cooperativeId,
        _feed_type: params.feedType,
        _category: params.category,
        _quantity_kg: params.quantityKg,
        _cost_per_kg: params.costPerKg,
        _purchase_date: params.purchaseDate || null,
        _supplier: params.supplier || null,
        _batch_number: params.batchNumber || null,
        _expiry_date: params.expiryDate || null,
        _notes: params.notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["coop-feed-inventory", variables.cooperativeId] });
    },
  });
};
