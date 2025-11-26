import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface BreedingStats {
  total_ai_scheduled: number;
  total_ai_performed: number;
  total_pregnancies_confirmed: number;
  currently_pregnant: number;
  ai_success_rate: number;
  due_this_quarter: number;
  cattle_success_rate: number;
  goat_success_rate: number;
  carabao_success_rate: number;
  sheep_success_rate: number;
  expected_deliveries_by_month: Record<string, {
    total: number;
    by_type: Record<string, number>;
  }>;
}

export const useBreedingStats = (
  startDate: Date,
  endDate: Date,
  region?: string,
  province?: string,
  municipality?: string,
  options = {}
) => {
  return useQuery({
    queryKey: ["breeding-stats", startDate, endDate, region, province, municipality],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_government_breeding_stats", {
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        region_filter: region && region !== "all" ? region : null,
        province_filter: province && province !== "all" ? province : null,
        municipality_filter: municipality && municipality !== "all" ? municipality : null,
      });

      if (error) throw error;
      
      // Return first row or default values
      const stats = data?.[0] || {
        total_ai_scheduled: 0,
        total_ai_performed: 0,
        total_pregnancies_confirmed: 0,
        currently_pregnant: 0,
        ai_success_rate: 0,
        due_this_quarter: 0,
        cattle_success_rate: 0,
        goat_success_rate: 0,
        carabao_success_rate: 0,
        sheep_success_rate: 0,
        expected_deliveries_by_month: {},
      };

      return stats as BreedingStats;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...options,
  });
};
