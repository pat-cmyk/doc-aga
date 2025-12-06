import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  options: UseGovernmentHealthStatsOptions = {}
) {
  return useQuery({
    queryKey: ['government-health-stats', startDate, endDate, region, province, municipality],
    queryFn: async (): Promise<GovernmentHealthStats | null> => {
      const { data, error } = await supabase.rpc('get_government_health_stats', {
        start_date: startDate,
        end_date: endDate,
        region_filter: region || null,
        province_filter: province || null,
        municipality_filter: municipality || null,
      });

      if (error) {
        console.error('Error fetching government health stats:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return null;
      }

      const row = data[0];
      return {
        scheduled_vaccinations: Number(row.scheduled_vaccinations) || 0,
        completed_vaccinations: Number(row.completed_vaccinations) || 0,
        overdue_vaccinations: Number(row.overdue_vaccinations) || 0,
        scheduled_deworming: Number(row.scheduled_deworming) || 0,
        completed_deworming: Number(row.completed_deworming) || 0,
        vaccination_compliance_rate: Number(row.vaccination_compliance_rate) || 0,
        heat_events_count: Number(row.heat_events_count) || 0,
        avg_cycle_length_days: Number(row.avg_cycle_length_days) || 0,
        animals_in_optimal_window: Number(row.animals_in_optimal_window) || 0,
        total_exits: Number(row.total_exits) || 0,
        exits_sold: Number(row.exits_sold) || 0,
        exits_died: Number(row.exits_died) || 0,
        exits_culled: Number(row.exits_culled) || 0,
        exits_transferred: Number(row.exits_transferred) || 0,
        exits_slaughtered: Number(row.exits_slaughtered) || 0,
        mortality_rate: Number(row.mortality_rate) || 0,
        total_sales_revenue: Number(row.total_sales_revenue) || 0,
        avg_bcs_score: Number(row.avg_bcs_score) || 0,
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
