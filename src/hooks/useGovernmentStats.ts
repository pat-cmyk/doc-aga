import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";

export interface TimeseriesDataPoint {
  date: string;
  farm_count: number;
  active_animal_count: number;
  health_event_count: number;
  doc_aga_query_count: number;
  avg_milk_liters: number;
}

export interface GovStats {
  farm_count: number;
  active_animal_count: number;
  daily_log_count: number;
  health_event_count: number;
  avg_milk_liters: number;
  doc_aga_query_count: number;
}

export interface GovStatsWithGrowth extends GovStats {
  farmGrowth: number;
  logGrowth: number;
  healthGrowth: number;
}

export const useGovernmentStats = (
  startDate: Date,
  endDate: Date,
  region?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery<GovStatsWithGrowth>({
    queryKey: ["government-stats", format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), region || "all"],
    enabled: options?.enabled ?? true,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      // Get current period stats
      const { data: currentData, error: currentError } = await supabase.rpc(
        "get_government_stats",
        {
          start_date: format(startDate, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd"),
          region_filter: region || null,
        }
      );

      if (currentError) throw currentError;

      // Get previous period stats for comparison
      const daysDiff = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const prevStartDate = subDays(startDate, daysDiff);
      const prevEndDate = subDays(endDate, daysDiff);

      const { data: prevData, error: prevError } = await supabase.rpc(
        "get_government_stats",
        {
          start_date: format(prevStartDate, "yyyy-MM-dd"),
          end_date: format(prevEndDate, "yyyy-MM-dd"),
          region_filter: region || null,
        }
      );

      if (prevError) throw prevError;

      const current = currentData as unknown as GovStats;
      const previous = prevData as unknown as GovStats;

      const calculateGrowth = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      return {
        ...current,
        farmGrowth: calculateGrowth(current.farm_count, previous.farm_count),
        logGrowth: calculateGrowth(
          current.daily_log_count,
          previous.daily_log_count
        ),
        healthGrowth: calculateGrowth(
          current.health_event_count,
          previous.health_event_count
        ),
      } as GovStatsWithGrowth;
    },
  });
};

export interface HeatmapData {
  municipality: string;
  region: string;
  health_event_count: number;
  total_animals: number;
  prevalence_rate: number;
  symptom_types: string[];
}

export const useHealthHeatmap = (daysBack: number = 7, region?: string, options?: { enabled?: boolean }) => {
  return useQuery<HeatmapData[]>({
    queryKey: ["health-heatmap", daysBack, region || "all"],
    enabled: options?.enabled ?? true,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_health_heatmap_data", {
        days_back: daysBack,
        region_filter: region || null,
      });

      if (error) throw error;
      return data as HeatmapData[];
    },
  });
};

export const useFarmerQueries = (startDate: Date, endDate: Date, options?: { enabled?: boolean }) => {
  return useQuery<{ created_at: string; id: string; question: string }[]>({
    queryKey: ["farmer-queries", format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    enabled: options?.enabled ?? true,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doc_aga_queries")
        .select("question, created_at, id")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};

export const useGovernmentStatsTimeseries = (
  startDate: Date,
  endDate: Date,
  region?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery<TimeseriesDataPoint[]>({
    queryKey: ["government-stats-timeseries", format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), region || "all"],
    enabled: options?.enabled ?? true,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_government_stats_timeseries",
        {
          start_date: format(startDate, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd"),
          region_filter: region || null,
        }
      );

      if (error) throw error;
      return data as TimeseriesDataPoint[];
    },
  });
};
