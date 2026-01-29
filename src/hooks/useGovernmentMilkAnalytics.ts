import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface MilkAnalyticsDataPoint {
  report_date: string;
  cattle_milk_liters: number;
  goat_milk_liters: number;
  carabao_milk_liters: number;
  total_milk_liters: number;
  cattle_farms_milking: number;
  goat_farms_milking: number;
  carabao_farms_milking: number;
  avg_cattle_price: number | null;
  avg_goat_price: number | null;
  avg_carabao_price: number | null;
}

export interface MilkAnalyticsSummary {
  totalCattleMilk: number;
  totalGoatMilk: number;
  totalCarabaoMilk: number;
  totalMilk: number;
  avgCattlePrice: number | null;
  avgGoatPrice: number | null;
  avgCarabaoPrice: number | null;
  cattleRevenueEstimate: number;
  goatRevenueEstimate: number;
  carabaoRevenueEstimate: number;
  totalRevenueEstimate: number;
  dataPoints: MilkAnalyticsDataPoint[];
}

export const useGovernmentMilkAnalytics = (
  startDate: Date,
  endDate: Date,
  region?: string,
  province?: string,
  municipality?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery<MilkAnalyticsSummary>({
    queryKey: [
      "government-milk-analytics",
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
      region || "all",
      province || "all",
      municipality || "all",
    ],
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_government_milk_analytics", {
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        region_filter: region || null,
        province_filter: province || null,
        municipality_filter: municipality || null,
      });

      if (error) throw error;

      const dataPoints: MilkAnalyticsDataPoint[] = (data || []).map((row: any) => ({
        report_date: row.report_date,
        cattle_milk_liters: Number(row.cattle_milk_liters) || 0,
        goat_milk_liters: Number(row.goat_milk_liters) || 0,
        carabao_milk_liters: Number(row.carabao_milk_liters) || 0,
        total_milk_liters: Number(row.total_milk_liters) || 0,
        cattle_farms_milking: Number(row.cattle_farms_milking) || 0,
        goat_farms_milking: Number(row.goat_farms_milking) || 0,
        carabao_farms_milking: Number(row.carabao_farms_milking) || 0,
        avg_cattle_price: row.avg_cattle_price ? Number(row.avg_cattle_price) : null,
        avg_goat_price: row.avg_goat_price ? Number(row.avg_goat_price) : null,
        avg_carabao_price: row.avg_carabao_price ? Number(row.avg_carabao_price) : null,
      }));

      // Calculate totals
      const totalCattleMilk = dataPoints.reduce((sum, d) => sum + d.cattle_milk_liters, 0);
      const totalGoatMilk = dataPoints.reduce((sum, d) => sum + d.goat_milk_liters, 0);
      const totalCarabaoMilk = dataPoints.reduce((sum, d) => sum + d.carabao_milk_liters, 0);
      const totalMilk = totalCattleMilk + totalGoatMilk + totalCarabaoMilk;

      // Get average prices (use last available or calculate mean)
      const avgCattlePrice = dataPoints.find(d => d.avg_cattle_price)?.avg_cattle_price || null;
      const avgGoatPrice = dataPoints.find(d => d.avg_goat_price)?.avg_goat_price || null;
      const avgCarabaoPrice = dataPoints.find(d => d.avg_carabao_price)?.avg_carabao_price || null;

      // Calculate revenue estimates
      const cattleRevenueEstimate = avgCattlePrice ? totalCattleMilk * avgCattlePrice : 0;
      const goatRevenueEstimate = avgGoatPrice ? totalGoatMilk * avgGoatPrice : 0;
      const carabaoRevenueEstimate = avgCarabaoPrice ? totalCarabaoMilk * avgCarabaoPrice : 0;

      return {
        totalCattleMilk,
        totalGoatMilk,
        totalCarabaoMilk,
        totalMilk,
        avgCattlePrice,
        avgGoatPrice,
        avgCarabaoPrice,
        cattleRevenueEstimate,
        goatRevenueEstimate,
        carabaoRevenueEstimate,
        totalRevenueEstimate: cattleRevenueEstimate + goatRevenueEstimate + carabaoRevenueEstimate,
        dataPoints,
      };
    },
  });
};
