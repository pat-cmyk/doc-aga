import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export interface RevenueSummary {
  thisMonth: number;
  lastMonth: number;
  thisYear: number;
  topSource: { source: string; amount: number } | null;
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

export function useRevenueSummary(farmId: string) {
  return useQuery({
    queryKey: ["revenue-summary", farmId],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const { data: revenues, error } = await supabase
        .from("farm_revenues")
        .select("*")
        .eq("farm_id", farmId)
        .eq("is_deleted", false);

      if (error) throw error;

      const thisMonth = (revenues || [])
        .filter((r) => new Date(r.transaction_date) >= startOfMonth)
        .reduce((sum, r) => sum + Number(r.amount), 0);

      const lastMonth = (revenues || [])
        .filter(
          (r) =>
            new Date(r.transaction_date) >= startOfLastMonth &&
            new Date(r.transaction_date) <= endOfLastMonth
        )
        .reduce((sum, r) => sum + Number(r.amount), 0);

      const thisYear = (revenues || [])
        .filter((r) => new Date(r.transaction_date) >= startOfYear)
        .reduce((sum, r) => sum + Number(r.amount), 0);

      // Calculate top source this month
      const monthlyRevenues = (revenues || []).filter(
        (r) => new Date(r.transaction_date) >= startOfMonth
      );
      const sourceMap = monthlyRevenues.reduce(
        (acc, r) => {
          acc[r.source] = (acc[r.source] || 0) + Number(r.amount);
          return acc;
        },
        {} as Record<string, number>
      );

      const topSource = Object.entries(sourceMap).sort((a, b) => b[1] - a[1])[0];

      return {
        thisMonth,
        lastMonth,
        thisYear,
        topSource: topSource ? { source: topSource[0], amount: topSource[1] } : null,
      } as RevenueSummary;
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["revenues", variables.farm_id] });
      queryClient.invalidateQueries({ queryKey: ["revenue-summary", variables.farm_id] });
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
