import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GrantSourceBreakdown {
  grantSource: string;
  count: number;
  percentage: number;
}

export interface AcquisitionBreakdown {
  purchased: number;
  grant: number;
  bornOnFarm: number;
  unknown: number;
  total: number;
}

export interface RegionalGrantData {
  region: string;
  grantCount: number;
  purchasedCount: number;
  avgPurchasePrice: number;
}

export interface GrantAnalytics {
  totalGrantAnimals: number;
  totalPurchasedAnimals: number;
  totalBornOnFarm: number;
  grantPercentage: number;
  avgPurchasePrice: number;
  grantSourceBreakdown: GrantSourceBreakdown[];
  acquisitionBreakdown: AcquisitionBreakdown;
}

export const useGrantAnalytics = (
  region?: string,
  province?: string,
  municipality?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery<GrantAnalytics>({
    queryKey: ["grant-analytics", region || "all", province || "all", municipality || "all"],
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Build query with location filters
      let query = supabase
        .from("animals")
        .select(`
          id,
          acquisition_type,
          purchase_price,
          grant_source,
          farms!inner(region, province, municipality)
        `)
        .eq("is_deleted", false)
        .is("exit_date", null);

      if (region) {
        query = query.eq("farms.region", region);
      }
      if (province) {
        query = query.eq("farms.province", province);
      }
      if (municipality) {
        query = query.eq("farms.municipality", municipality);
      }

      const { data: animals, error } = await query;

      if (error) throw error;

      // Calculate acquisition breakdown
      let purchased = 0;
      let grant = 0;
      let bornOnFarm = 0;
      let unknown = 0;
      let totalPurchasePrice = 0;
      let purchasedWithPrice = 0;

      const grantSources: Record<string, number> = {};

      animals?.forEach((animal) => {
        const type = animal.acquisition_type;
        if (type === "purchased") {
          purchased++;
          if (animal.purchase_price) {
            totalPurchasePrice += animal.purchase_price;
            purchasedWithPrice++;
          }
        } else if (type === "grant") {
          grant++;
          const source = animal.grant_source || "Unknown Source";
          grantSources[source] = (grantSources[source] || 0) + 1;
        } else if (type === "born_on_farm") {
          bornOnFarm++;
        } else {
          unknown++;
        }
      });

      const total = animals?.length || 0;
      const avgPurchasePrice = purchasedWithPrice > 0 ? totalPurchasePrice / purchasedWithPrice : 0;

      // Build grant source breakdown
      const grantSourceBreakdown: GrantSourceBreakdown[] = Object.entries(grantSources)
        .map(([source, count]) => ({
          grantSource: source,
          count,
          percentage: grant > 0 ? (count / grant) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      return {
        totalGrantAnimals: grant,
        totalPurchasedAnimals: purchased,
        totalBornOnFarm: bornOnFarm,
        grantPercentage: total > 0 ? (grant / total) * 100 : 0,
        avgPurchasePrice,
        grantSourceBreakdown,
        acquisitionBreakdown: {
          purchased,
          grant,
          bornOnFarm,
          unknown,
          total,
        },
      };
    },
  });
};

export const useRegionalGrantDistribution = (options?: { enabled?: boolean }) => {
  return useQuery<RegionalGrantData[]>({
    queryKey: ["regional-grant-distribution"],
    enabled: options?.enabled ?? true,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data: animals, error } = await supabase
        .from("animals")
        .select(`
          acquisition_type,
          purchase_price,
          farms!inner(region)
        `)
        .eq("is_deleted", false)
        .is("exit_date", null);

      if (error) throw error;

      // Group by region
      const regionData: Record<string, { grant: number; purchased: number; totalPrice: number; priceCount: number }> = {};

      animals?.forEach((animal) => {
        const region = (animal.farms as any)?.region || "Unknown";
        if (!regionData[region]) {
          regionData[region] = { grant: 0, purchased: 0, totalPrice: 0, priceCount: 0 };
        }

        if (animal.acquisition_type === "grant") {
          regionData[region].grant++;
        } else if (animal.acquisition_type === "purchased") {
          regionData[region].purchased++;
          if (animal.purchase_price) {
            regionData[region].totalPrice += animal.purchase_price;
            regionData[region].priceCount++;
          }
        }
      });

      return Object.entries(regionData)
        .map(([region, data]) => ({
          region,
          grantCount: data.grant,
          purchasedCount: data.purchased,
          avgPurchasePrice: data.priceCount > 0 ? data.totalPrice / data.priceCount : 0,
        }))
        .sort((a, b) => b.grantCount - a.grantCount);
    },
  });
};
