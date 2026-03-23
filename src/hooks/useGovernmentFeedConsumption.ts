/**
 * @online-only Government feed consumption hook - aggregates cross-farm feed data.
 * Online-only by design: caching cross-farm data locally would violate
 * RLS boundaries and data freshness requirements.
 *
 * Data source: daily_farm_stats.total_feed_kg (maintained by
 * aggregate_feed_to_daily_stats trigger on feeding_records).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { DataCategory } from "@/types/government";

export interface FeedConsumptionDataPoint {
  report_date: string;
  total_feed_kg: number;
  total_farms_feeding: number;
  total_animals_fed: number;
}

export interface FeedConsumptionSummary {
  totalFeedKg: number;
  totalFarmsFeeding: number;
  totalAnimalsFed: number;
  avgDailyFeedKg: number;
  dataPoints: FeedConsumptionDataPoint[];
}

export const useGovernmentFeedConsumption = (
  startDate: Date,
  endDate: Date,
  region?: string,
  province?: string,
  municipality?: string,
  dataCategory: DataCategory = "live",
  options?: { enabled?: boolean }
) => {
  return useQuery<FeedConsumptionSummary>({
    queryKey: [
      "government-feed-consumption",
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
      region || "all",
      province || "all",
      municipality || "all",
      dataCategory,
    ],
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_government_feed_consumption" as any,
        {
          start_date: format(startDate, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd"),
          region_filter: region || null,
          province_filter: province || null,
          municipality_filter: municipality || null,
          data_category_filter: dataCategory === "all" ? null : dataCategory,
        }
      );

      if (error) throw error;

      const dataPoints: FeedConsumptionDataPoint[] = (data || []).map(
        (row: any) => ({
          report_date: row.report_date,
          total_feed_kg: Number(row.total_feed_kg) || 0,
          total_farms_feeding: Number(row.total_farms_feeding) || 0,
          total_animals_fed: Number(row.total_animals_fed) || 0,
        })
      );

      const totalFeedKg = dataPoints.reduce(
        (sum, d) => sum + d.total_feed_kg,
        0
      );
      const daysWithData = dataPoints.length;
      const avgDailyFeedKg = daysWithData > 0 ? totalFeedKg / daysWithData : 0;

      // Use max farms/animals across days (not sum, since same farms report daily)
      const totalFarmsFeeding = dataPoints.length > 0
        ? Math.max(...dataPoints.map((d) => d.total_farms_feeding))
        : 0;
      const totalAnimalsFed = dataPoints.length > 0
        ? Math.max(...dataPoints.map((d) => d.total_animals_fed))
        : 0;

      return {
        totalFeedKg,
        totalFarmsFeeding,
        totalAnimalsFed,
        avgDailyFeedKg,
        dataPoints,
      };
    },
  });
};
