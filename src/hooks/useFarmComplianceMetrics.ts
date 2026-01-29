import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface FarmComplianceData {
  region: string;
  province: string;
  total_farms: number;
  farms_with_milking_logs: number;
  farms_with_feeding_logs: number;
  farms_with_health_logs: number;
  avg_milking_completion: number;
  avg_feeding_completion: number;
  high_compliance_farms: number;
  low_compliance_farms: number;
  compliance_rate: number;
}

export interface ComplianceSummary {
  totalFarms: number;
  highComplianceFarms: number;
  lowComplianceFarms: number;
  overallComplianceRate: number;
  avgMilkingCompletion: number;
  avgFeedingCompletion: number;
  regions: FarmComplianceData[];
}

export const useFarmComplianceMetrics = (
  startDate: Date,
  endDate: Date,
  region?: string,
  province?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery<ComplianceSummary>({
    queryKey: [
      "farm-compliance-metrics",
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
      region || "all",
      province || "all",
    ],
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_farm_compliance_metrics", {
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        region_filter: region || null,
        province_filter: province || null,
      });

      if (error) throw error;

      const regions: FarmComplianceData[] = (data || []).map((row: any) => ({
        region: row.region,
        province: row.province,
        total_farms: Number(row.total_farms) || 0,
        farms_with_milking_logs: Number(row.farms_with_milking_logs) || 0,
        farms_with_feeding_logs: Number(row.farms_with_feeding_logs) || 0,
        farms_with_health_logs: Number(row.farms_with_health_logs) || 0,
        avg_milking_completion: Number(row.avg_milking_completion) || 0,
        avg_feeding_completion: Number(row.avg_feeding_completion) || 0,
        high_compliance_farms: Number(row.high_compliance_farms) || 0,
        low_compliance_farms: Number(row.low_compliance_farms) || 0,
        compliance_rate: Number(row.compliance_rate) || 0,
      }));

      // Calculate totals
      const totalFarms = regions.reduce((sum, r) => sum + r.total_farms, 0);
      const highComplianceFarms = regions.reduce((sum, r) => sum + r.high_compliance_farms, 0);
      const lowComplianceFarms = regions.reduce((sum, r) => sum + r.low_compliance_farms, 0);
      
      const overallComplianceRate = totalFarms > 0
        ? (highComplianceFarms + (totalFarms - highComplianceFarms - lowComplianceFarms)) / totalFarms * 100
        : 0;

      const avgMilkingCompletion = regions.length > 0
        ? regions.reduce((sum, r) => sum + r.avg_milking_completion, 0) / regions.length
        : 0;

      const avgFeedingCompletion = regions.length > 0
        ? regions.reduce((sum, r) => sum + r.avg_feeding_completion, 0) / regions.length
        : 0;

      return {
        totalFarms,
        highComplianceFarms,
        lowComplianceFarms,
        overallComplianceRate,
        avgMilkingCompletion,
        avgFeedingCompletion,
        regions,
      };
    },
  });
};
