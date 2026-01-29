import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface MarketPriceData {
  livestock_type: string;
  region: string;
  avg_price_per_kg: number;
  min_price: number;
  max_price: number;
  price_volatility: number;
  sample_count: number;
  latest_price: number;
  latest_date: string;
  price_trend: "rising" | "falling" | "stable";
}

export interface MarketPriceSummary {
  bySpecies: Record<string, MarketPriceData[]>;
  overallTrends: {
    livestock_type: string;
    avg_price: number;
    trend: "rising" | "falling" | "stable";
    sample_count: number;
  }[];
}

export const useRegionalMarketPrices = (
  startDate: Date,
  endDate: Date,
  region?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery<MarketPriceSummary>({
    queryKey: [
      "regional-market-prices",
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
      region || "all",
    ],
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_regional_market_prices", {
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        region_filter: region || null,
      });

      if (error) throw error;

      const priceData: MarketPriceData[] = (data || []).map((row: any) => ({
        livestock_type: row.livestock_type,
        region: row.region,
        avg_price_per_kg: Number(row.avg_price_per_kg) || 0,
        min_price: Number(row.min_price) || 0,
        max_price: Number(row.max_price) || 0,
        price_volatility: Number(row.price_volatility) || 0,
        sample_count: Number(row.sample_count) || 0,
        latest_price: Number(row.latest_price) || 0,
        latest_date: row.latest_date,
        price_trend: row.price_trend as "rising" | "falling" | "stable",
      }));

      // Group by species
      const bySpecies: Record<string, MarketPriceData[]> = {};
      priceData.forEach((item) => {
        if (!bySpecies[item.livestock_type]) {
          bySpecies[item.livestock_type] = [];
        }
        bySpecies[item.livestock_type].push(item);
      });

      // Calculate overall trends per species
      const overallTrends = Object.entries(bySpecies).map(([type, items]) => {
        const avgPrice = items.reduce((sum, i) => sum + i.avg_price_per_kg, 0) / items.length;
        const totalSamples = items.reduce((sum, i) => sum + i.sample_count, 0);
        
        // Determine overall trend (majority vote)
        const trendCounts = { rising: 0, falling: 0, stable: 0 };
        items.forEach((i) => trendCounts[i.price_trend]++);
        const trend = Object.entries(trendCounts).reduce((a, b) => (b[1] > a[1] ? b : a))[0] as "rising" | "falling" | "stable";

        return {
          livestock_type: type,
          avg_price: avgPrice,
          trend,
          sample_count: totalSamples,
        };
      });

      return {
        bySpecies,
        overallTrends,
      };
    },
  });
};
