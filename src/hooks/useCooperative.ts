import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCooperativeMemberFarms = (cooperativeId: string | null) => {
  return useQuery({
    queryKey: ["cooperative-member-farms", cooperativeId],
    queryFn: async () => {
      if (!cooperativeId) return [];
      const { data, error } = await supabase.rpc("get_cooperative_member_farms", {
        _cooperative_id: cooperativeId,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!cooperativeId,
  });
};

export const useCooperativeHerdSummary = (cooperativeId: string | null) => {
  return useQuery({
    queryKey: ["cooperative-herd-summary", cooperativeId],
    queryFn: async () => {
      if (!cooperativeId) return null;
      const { data, error } = await supabase.rpc("get_cooperative_herd_summary", {
        _cooperative_id: cooperativeId,
      });
      if (error) throw error;
      return data as {
        total_animals: number;
        by_species: { species: string; count: number }[];
        by_breed: { breed: string; count: number }[];
        by_gender: { gender: string; count: number }[];
      };
    },
    enabled: !!cooperativeId,
  });
};

export const useCooperativeMilkProduction = (cooperativeId: string | null, days: number = 30) => {
  return useQuery({
    queryKey: ["cooperative-milk-production", cooperativeId, days],
    queryFn: async () => {
      if (!cooperativeId) return null;
      const { data, error } = await supabase.rpc("get_cooperative_milk_production", {
        _cooperative_id: cooperativeId,
        _days: days,
      });
      if (error) throw error;
      return data as {
        total_liters: number;
        daily: { date: string; liters: number }[];
        by_farm: { farm_id: string; farm_name: string; total_liters: number }[];
      };
    },
    enabled: !!cooperativeId,
  });
};

export const useCooperativeHealthOverview = (cooperativeId: string | null) => {
  return useQuery({
    queryKey: ["cooperative-health-overview", cooperativeId],
    queryFn: async () => {
      if (!cooperativeId) return null;
      const { data, error } = await supabase.rpc("get_cooperative_health_overview", {
        _cooperative_id: cooperativeId,
      });
      if (error) throw error;
      return data as {
        total_records_30d: number;
        by_diagnosis: { diagnosis: string; count: number }[];
        mortality_30d: number;
      };
    },
    enabled: !!cooperativeId,
  });
};

export const useCooperativeFinancialSummary = (cooperativeId: string | null, days: number = 30) => {
  return useQuery({
    queryKey: ["cooperative-financial-summary", cooperativeId, days],
    queryFn: async () => {
      if (!cooperativeId) return null;
      const { data, error } = await supabase.rpc("get_cooperative_financial_summary", {
        _cooperative_id: cooperativeId,
        _days: days,
      });
      if (error) throw error;
      return data as {
        total_revenue: number;
        total_expenses: number;
        revenue_by_farm: { farm_id: string; farm_name: string; total: number }[];
      };
    },
    enabled: !!cooperativeId,
  });
};

export const useCooperativePendingInvitations = (cooperativeId: string | null) => {
  return useQuery({
    queryKey: ["cooperative-pending-invitations", cooperativeId],
    queryFn: async () => {
      if (!cooperativeId) return [];
      const { data, error } = await supabase
        .from("cooperative_memberships")
        .select("*, farms(name)")
        .eq("cooperative_id", cooperativeId)
        .eq("invitation_status", "pending")
        .order("invited_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!cooperativeId,
  });
};
