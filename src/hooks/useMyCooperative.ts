/**
 * @online-only Farmer-side cooperative hooks.
 * Read-only access to the farmer's coop membership, deliveries, feed receipts.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MyCoopMembership {
  cooperative_id: string;
  cooperative_name: string;
  invitation_status: string;
  accepted_at: string | null;
}

export interface MyMilkDelivery {
  id: string;
  receiving_date: string;
  session: string;
  volume_liters: number;
  species: string;
  milk_quality: string;
  price_per_liter: number;
  total_value: number;
  status: string;
  entry_type: string;
  original_receiving_id: string | null;
  created_at: string;
}

export interface MyFeedReceipt {
  id: string;
  disbursement_date: string;
  feed_type: string;
  category: string;
  quantity_kg: number;
  cost_per_kg: number;
  total_cost: number;
  status: string;
  entry_type: string;
  original_disbursement_id: string | null;
  created_at: string;
}

export const useMyCoopMembership = (farmId: string | null) => {
  return useQuery({
    queryKey: ["my-coop-membership", farmId],
    queryFn: async () => {
      if (!farmId) return null;
      const { data, error } = await supabase.rpc("get_my_coop_membership", {
        _farm_id: farmId,
      });
      if (error) throw error;
      if (!data || (Array.isArray(data) && data.length === 0)) return null;
      return (Array.isArray(data) ? data[0] : data) as MyCoopMembership;
    },
    enabled: !!farmId,
  });
};

export const useMyMilkDeliveries = (
  farmId: string | null,
  dateRange?: { from: string; to: string } | null
) => {
  return useQuery({
    queryKey: ["my-coop-milk-deliveries", farmId, dateRange],
    queryFn: async () => {
      if (!farmId) return [];
      const { data, error } = await supabase.rpc("get_my_coop_milk_deliveries", {
        _farm_id: farmId,
        _date_from: dateRange?.from || null,
        _date_to: dateRange?.to || null,
      });
      if (error) throw error;
      return (data || []) as MyMilkDelivery[];
    },
    enabled: !!farmId,
  });
};

export const useMyFeedReceipts = (
  farmId: string | null,
  dateRange?: { from: string; to: string } | null
) => {
  return useQuery({
    queryKey: ["my-coop-feed-receipts", farmId, dateRange],
    queryFn: async () => {
      if (!farmId) return [];
      const { data, error } = await supabase.rpc("get_my_coop_feed_receipts", {
        _farm_id: farmId,
        _date_from: dateRange?.from || null,
        _date_to: dateRange?.to || null,
      });
      if (error) throw error;
      return (data || []) as MyFeedReceipt[];
    },
    enabled: !!farmId,
  });
};

export const useMyCoopSOA = (farmId: string | null) => {
  return useQuery({
    queryKey: ["my-coop-soa", farmId],
    queryFn: async () => {
      if (!farmId) return [];
      const { data, error } = await supabase.rpc("get_my_coop_soa", {
        _farm_id: farmId,
      });
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        cooperative_name: string;
        period_start: string;
        period_end: string;
        total_milk_liters: number;
        total_milk_value: number;
        total_feed_kg: number;
        total_feed_cost: number;
        net_balance: number;
        status: string;
        revision_number: number;
        finalized_at: string | null;
        settled_at: string | null;
        notes: string | null;
      }>;
    },
    enabled: !!farmId,
  });
};
