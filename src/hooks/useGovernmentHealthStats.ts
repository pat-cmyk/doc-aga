import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataCategory } from "@/types/government";

export interface GovernmentHealthStats {
  // Preventive Health
  scheduled_vaccinations: number;
  completed_vaccinations: number;
  overdue_vaccinations: number;
  scheduled_deworming: number;
  completed_deworming: number;
  vaccination_compliance_rate: number;
  
  // Heat Detection
  heat_events_count: number;
  avg_cycle_length_days: number;
  animals_in_optimal_window: number;
  
  // Animal Exits
  total_exits: number;
  exits_sold: number;
  exits_died: number;
  exits_culled: number;
  exits_transferred: number;
  exits_slaughtered: number;
  mortality_rate: number;
  total_sales_revenue: number;
  
  // Body Condition Scores
  avg_bcs_score: number;
  animals_underweight: number;
  animals_optimal: number;
  animals_overweight: number;
  bcs_assessments_count: number;
}

interface UseGovernmentHealthStatsOptions {
  enabled?: boolean;
}

export function useGovernmentHealthStats(
  startDate: string,
  endDate: string,
  region?: string | null,
  province?: string | null,
  municipality?: string | null,
  dataCategory: DataCategory = 'live',
  options: UseGovernmentHealthStatsOptions = {}
) {
  return useQuery({
    queryKey: ['government-health-stats', startDate, endDate, region, province, municipality, dataCategory],
    queryFn: async (): Promise<GovernmentHealthStats | null> => {
      const { data, error } = await supabase.rpc('get_government_health_stats', {
        start_date: startDate,
        end_date: endDate,
        region_filter: region || null,
        province_filter: province || null,
        municipality_filter: municipality || null,
        data_category_filter: dataCategory === 'all' ? null : dataCategory,
      });

      if (error) {
        console.error('Error fetching government health stats:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return null;
      }

      // Map RPC response to expected interface (RPC uses abbreviated column names)
      const row = data[0] as Record<string, unknown>;
      return {
        // Vaccination stats - RPC returns vaccination_count and vaccination_rate
        scheduled_vaccinations: Number(row.vaccination_count) || 0,
        completed_vaccinations: Number(row.vaccination_count) || 0,
        overdue_vaccinations: 0, // Not available from simplified RPC
        scheduled_deworming: 0, // Not available from simplified RPC
        completed_deworming: 0, // Not available from simplified RPC
        vaccination_compliance_rate: Number(row.vaccination_rate) || 0,
        // Heat detection - RPC returns heat_detection_count, avg_cycle_length, optimal_breeding_window_count
        heat_events_count: Number(row.heat_detection_count) || 0,
        avg_cycle_length_days: Number(row.avg_cycle_length) || 0,
        animals_in_optimal_window: Number(row.optimal_breeding_window_count) || 0,
        // Mortality/exits - RPC returns mortality_count and mortality_rate
        total_exits: Number(row.mortality_count) || 0,
        exits_sold: 0, // Not available from simplified RPC
        exits_died: Number(row.mortality_count) || 0,
        exits_culled: 0, // Not available from simplified RPC
        exits_transferred: 0, // Not available from simplified RPC
        exits_slaughtered: 0, // Not available from simplified RPC
        mortality_rate: Number(row.mortality_rate) || 0,
        total_sales_revenue: 0, // Not available from simplified RPC
        // BCS - RPC returns avg_bcs and bcs counts
        avg_bcs_score: Number(row.avg_bcs) || 0,
        animals_underweight: Number(row.animals_underweight) || 0,
        animals_optimal: Number(row.animals_optimal) || 0,
        animals_overweight: Number(row.animals_overweight) || 0,
        bcs_assessments_count: Number(row.bcs_assessments_count) || 0,
      };
    },
    enabled: options.enabled !== false,
    staleTime: 5 * 60 * 1000,
  });
}
