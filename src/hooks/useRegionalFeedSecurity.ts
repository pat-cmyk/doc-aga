import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RegionalFeedSecurityData {
  region: string;
  province: string;
  total_farms: number;
  critical_feed_farms: number;
  low_feed_farms: number;
  adequate_feed_farms: number;
  total_roughage_kg: number;
  total_concentrate_kg: number;
  avg_feed_stock_days: number | null;
  critical_percentage: number;
  low_percentage: number;
}

export interface FeedSecuritySummary {
  totalFarms: number;
  criticalFarms: number;
  lowFarms: number;
  adequateFarms: number;
  overallCriticalPercentage: number;
  overallLowPercentage: number;
  regions: RegionalFeedSecurityData[];
}

export const useRegionalFeedSecurity = (
  region?: string,
  province?: string,
  municipality?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery<FeedSecuritySummary>({
    queryKey: ["regional-feed-security", region || "all", province || "all", municipality || "all"],
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_regional_feed_security", {
        region_filter: region || null,
        province_filter: province || null,
        municipality_filter: municipality || null,
      });

      if (error) throw error;

      const regions: RegionalFeedSecurityData[] = (data || []).map((row: any) => ({
        region: row.region,
        province: row.province,
        total_farms: Number(row.total_farms) || 0,
        critical_feed_farms: Number(row.critical_feed_farms) || 0,
        low_feed_farms: Number(row.low_feed_farms) || 0,
        adequate_feed_farms: Number(row.adequate_feed_farms) || 0,
        total_roughage_kg: Number(row.total_roughage_kg) || 0,
        total_concentrate_kg: Number(row.total_concentrate_kg) || 0,
        avg_feed_stock_days: row.avg_feed_stock_days ? Number(row.avg_feed_stock_days) : null,
        critical_percentage: Number(row.critical_percentage) || 0,
        low_percentage: Number(row.low_percentage) || 0,
      }));

      // Calculate totals
      const totalFarms = regions.reduce((sum, r) => sum + r.total_farms, 0);
      const criticalFarms = regions.reduce((sum, r) => sum + r.critical_feed_farms, 0);
      const lowFarms = regions.reduce((sum, r) => sum + r.low_feed_farms, 0);
      const adequateFarms = regions.reduce((sum, r) => sum + r.adequate_feed_farms, 0);

      const overallCriticalPercentage = totalFarms > 0 ? (criticalFarms / totalFarms) * 100 : 0;
      const overallLowPercentage = totalFarms > 0 ? (lowFarms / totalFarms) * 100 : 0;

      return {
        totalFarms,
        criticalFarms,
        lowFarms,
        adequateFarms,
        overallCriticalPercentage,
        overallLowPercentage,
        regions,
      };
    },
  });
};
