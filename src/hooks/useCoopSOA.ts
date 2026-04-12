/**
 * @online-only Cooperative Statement of Account hooks.
 * Manages bi-monthly SOA computation, finalization, and settlement.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CoopSOAPeriod {
  id: string;
  cooperative_id: string;
  farm_id: string;
  farm_name: string;
  period_start: string;
  period_end: string;
  total_milk_liters: number;
  total_milk_value: number;
  total_feed_kg: number;
  total_feed_cost: number;
  net_balance: number;
  status: "draft" | "finalized" | "settled";
  revision_number: number;
  finalized_at: string | null;
  settled_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface SOAComputeResult {
  farm_id: string;
  period_start: string;
  period_end: string;
  total_milk_liters: number;
  total_milk_value: number;
  total_feed_kg: number;
  total_feed_cost: number;
  net_balance: number;
  milk_line_items: Array<{
    receiving_date: string;
    session: string;
    volume_liters: number;
    species: string;
    price_per_liter: number;
    total_value: number;
    entry_type: string;
  }>;
  feed_line_items: Array<{
    disbursement_date: string;
    feed_type: string;
    category: string;
    quantity_kg: number;
    cost_per_kg: number;
    total_cost: number;
    entry_type: string;
  }>;
}

export const useCoopSOAPeriods = (cooperativeId: string | null) => {
  return useQuery({
    queryKey: ["coop-soa-periods", cooperativeId],
    queryFn: async () => {
      if (!cooperativeId) return [];
      const { data, error } = await (supabase.from as any)("coop_soa_periods")
        .select("*, farms(name)")
        .eq("cooperative_id", cooperativeId)
        .order("period_start", { ascending: false })
        .order("revision_number", { ascending: false });
      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        farm_name: row.farms?.name || "Unknown Farm",
      })) as CoopSOAPeriod[];
    },
    enabled: !!cooperativeId,
  });
};

export const useComputeCoopSOA = () => {
  return useMutation({
    mutationFn: async (params: {
      cooperativeId: string;
      farmId: string;
      periodStart: string;
      periodEnd: string;
    }) => {
      const { data, error } = await (supabase.rpc as any)("compute_coop_soa", {
        _cooperative_id: params.cooperativeId,
        _farm_id: params.farmId,
        _period_start: params.periodStart,
        _period_end: params.periodEnd,
      });
      if (error) throw error;
      return data as unknown as SOAComputeResult;
    },
  });
};

export const useFinalizeCoopSOA = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      cooperativeId: string;
      farmId: string;
      periodStart: string;
      periodEnd: string;
      notes?: string;
    }) => {
      const { data, error } = await (supabase.rpc as any)("finalize_coop_soa", {
        _cooperative_id: params.cooperativeId,
        _farm_id: params.farmId,
        _period_start: params.periodStart,
        _period_end: params.periodEnd,
        _notes: params.notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["coop-soa-periods", variables.cooperativeId] });
    },
  });
};

export const useSettleCoopSOA = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      cooperativeId: string;
      farmId: string;
      periodStart: string;
    }) => {
      const { data, error } = await (supabase.rpc as any)("settle_coop_soa", {
        _cooperative_id: params.cooperativeId,
        _farm_id: params.farmId,
        _period_start: params.periodStart,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["coop-soa-periods", variables.cooperativeId] });
    },
  });
};

/**
 * Get bi-monthly period boundaries for a given date.
 * Returns: { start: 1st or 16th, end: 15th or last day of month }
 */
export function getBimonthlyPeriod(date: Date): { start: string; end: string } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  if (day <= 15) {
    const start = new Date(year, month, 1);
    const end = new Date(year, month, 15);
    return {
      start: formatDateISO(start),
      end: formatDateISO(end),
    };
  } else {
    const start = new Date(year, month, 16);
    const end = new Date(year, month + 1, 0);
    return {
      start: formatDateISO(start),
      end: formatDateISO(end),
    };
  }
}

function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
