import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataCategory } from "@/types/government";

export interface MonthlyPCRSData {
  total: number;
  critical: number;
  high: number;
  moderate: number;
  low: number;
}

export interface RegionalPCRSData {
  region: string;
  province: string;
  total_pregnant: number;
  critical_count: number;
  high_count: number;
  moderate_count: number;
  low_count: number;
  avg_risk_score: number;
  monthly_breakdown: Record<string, MonthlyPCRSData>;
}

export interface PCRSSummary {
  totalPregnant: number;
  totalCritical: number;
  totalHigh: number;
  totalModerate: number;
  totalLow: number;
  avgRiskScore: number;
  regions: RegionalPCRSData[];
  monthlyTotals: Record<string, MonthlyPCRSData>;
  highRiskRegions: RegionalPCRSData[];
}

export const useRegionalPCRS = (
  region?: string,
  province?: string,
  municipality?: string,
  dataCategory: DataCategory = 'live',
  options?: { enabled?: boolean }
) => {
  return useQuery<PCRSSummary>({
    queryKey: ["regional-pcrs", region || "all", province || "all", municipality || "all", dataCategory],
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      console.log('[PCRS] Fetching regional PCRS summary...');
      
      const { data, error } = await supabase.rpc("get_regional_pcrs_summary", {
        region_filter: region || null,
        province_filter: province || null,
        municipality_filter: municipality || null,
        data_category_filter: dataCategory === 'all' ? null : dataCategory,
      });

      if (error) {
        console.error('[PCRS] Error fetching PCRS summary:', error);
        throw error;
      }

      const regions: RegionalPCRSData[] = (data || []).map((row: any) => ({
        region: row.region,
        province: row.province,
        total_pregnant: Number(row.total_pregnant) || 0,
        critical_count: Number(row.critical_count) || 0,
        high_count: Number(row.high_count) || 0,
        moderate_count: Number(row.moderate_count) || 0,
        low_count: Number(row.low_count) || 0,
        avg_risk_score: Number(row.avg_risk_score) || 0,
        monthly_breakdown: row.monthly_breakdown || {},
      }));

      // Calculate totals
      const totalPregnant = regions.reduce((sum, r) => sum + r.total_pregnant, 0);
      const totalCritical = regions.reduce((sum, r) => sum + r.critical_count, 0);
      const totalHigh = regions.reduce((sum, r) => sum + r.high_count, 0);
      const totalModerate = regions.reduce((sum, r) => sum + r.moderate_count, 0);
      const totalLow = regions.reduce((sum, r) => sum + r.low_count, 0);

      // Calculate weighted average risk score
      const avgRiskScore = totalPregnant > 0 
        ? regions.reduce((sum, r) => sum + (r.avg_risk_score * r.total_pregnant), 0) / totalPregnant
        : 0;

      // Aggregate monthly totals across all regions
      const monthlyTotals: Record<string, MonthlyPCRSData> = {};
      regions.forEach(r => {
        Object.entries(r.monthly_breakdown).forEach(([month, data]) => {
          const monthData = data as MonthlyPCRSData;
          if (!monthlyTotals[month]) {
            monthlyTotals[month] = { total: 0, critical: 0, high: 0, moderate: 0, low: 0 };
          }
          monthlyTotals[month].total += monthData.total;
          monthlyTotals[month].critical += monthData.critical;
          monthlyTotals[month].high += monthData.high;
          monthlyTotals[month].moderate += monthData.moderate;
          monthlyTotals[month].low += monthData.low;
        });
      });

      // High risk regions (avg score >= 50)
      const highRiskRegions = regions.filter(r => r.avg_risk_score >= 50);

      console.log(`[PCRS] Found ${totalPregnant} pregnant animals, ${totalCritical} critical, ${highRiskRegions.length} high-risk regions`);

      return {
        totalPregnant,
        totalCritical,
        totalHigh,
        totalModerate,
        totalLow,
        avgRiskScore: Math.round(avgRiskScore * 10) / 10,
        regions,
        monthlyTotals,
        highRiskRegions,
      };
    },
  });
};
