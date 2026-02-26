import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subMonths, format, startOfMonth } from "date-fns";
import { getEffectiveWeight } from "@/lib/animalWeightUtils";
import { getCachedHerdValuation, updateHerdValuationCache } from "@/lib/dataCache";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * Unified herd valuation data with clear separation between
 * real-time calculations and historical snapshots
 */
export interface UnifiedHerdValuation {
  // Real-time current value (source of truth)
  currentValue: number;
  animalCount: number;
  animalsWithWeight: number;
  marketPrice: number;
  priceSource: string;
  priceDate: string;
  
  // Historical data (from snapshots)
  previousMonthValue: number;
  changePercent: number;
  changeAmount: number;
  monthlyTrend: Array<{ month: string; value: number; count: number }>;
  
  // Data quality metrics
  hasCompleteData: boolean;
  missingWeightCount: number;
  valuationSource: 'realtime' | 'snapshot';
}

export interface HerdValuationTrendPoint {
  month: string;
  value: number;
  count: number;
}

/**
 * Single Source of Truth hook for herd valuation
 * 
 * Cache-first pattern: IndexedDB → Supabase → update cache
 * Current value: Always calculated real-time from animals × market price
 * Historical data: Uses biological_asset_valuations snapshots
 */
export function useHerdValuationUnified(
  farmId: string | undefined,
  livestockType: string = "cattle",
  monthsBack: number = 3
) {
  const isOnline = useOnlineStatus();

  return useQuery({
    queryKey: ["herd-valuation-unified", farmId, livestockType, monthsBack],
    queryFn: async (): Promise<UnifiedHerdValuation> => {
      if (!farmId) return getEmptyValuation();

      // 1. Check IndexedDB cache first
      const cached = await getCachedHerdValuation(farmId);
      if (cached) {
        if (!isOnline) return cached.data as UnifiedHerdValuation;
        return cached.data as UnifiedHerdValuation;
      }

      // 2. If offline with no cache, return empty
      if (!isOnline) return getEmptyValuation();

      // 3. Online: parallel fetch
      const result = await fetchAndComputeValuation(farmId, livestockType, monthsBack);

      // 4. Update cache
      await updateHerdValuationCache(farmId, result);

      return result;
    },
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch all data and compute valuation (extracted for clarity)
 */
async function fetchAndComputeValuation(
  farmId: string,
  livestockType: string,
  monthsBack: number
): Promise<UnifiedHerdValuation> {
  const [animalsResult, priceResult, snapshotsResult] = await Promise.all([
    supabase
      .from("animals")
      .select("id, current_weight_kg, entry_weight_kg, entry_weight_unknown, birth_weight_kg, livestock_type")
      .eq("farm_id", farmId)
      .eq("is_deleted", false)
      .is("exit_date", null),
    
    supabase.rpc("get_market_price", {
      p_livestock_type: livestockType,
      p_farm_id: farmId,
    }),
    
    supabase
      .from("biological_asset_valuations")
      .select("animal_id, estimated_value, valuation_date")
      .eq("farm_id", farmId)
      .gte("valuation_date", format(subMonths(new Date(), monthsBack), "yyyy-MM-dd"))
      .order("valuation_date", { ascending: true }),
  ]);

  if (animalsResult.error) throw animalsResult.error;

  const animals = animalsResult.data || [];
  const priceData = priceResult.data?.[0];
  const snapshots = snapshotsResult.data || [];

  const marketPrice = priceData?.price || 300;
  const priceSource = priceData?.source || "system_default";
  const priceDate = priceData?.effective_date || format(new Date(), "yyyy-MM-dd");

  let currentValue = 0;
  let animalsWithWeight = 0;
  const totalAnimalCount = animals.length;

  animals.forEach((animal) => {
    const effectiveWeight = getEffectiveWeight(animal);
    if (effectiveWeight) {
      currentValue += effectiveWeight * marketPrice;
      animalsWithWeight++;
    }
  });

  const missingWeightCount = totalAnimalCount - animalsWithWeight;
  const hasCompleteData = missingWeightCount === 0 && totalAnimalCount > 0;

  const monthlyTrend = buildMonthlyTrend(snapshots, monthsBack);
  const previousMonthValue = getPreviousMonthValue(snapshots);
  
  const changeAmount = previousMonthValue > 0 ? currentValue - previousMonthValue : 0;
  const changePercent = previousMonthValue > 0
    ? ((currentValue - previousMonthValue) / previousMonthValue) * 100
    : 0;

  return {
    currentValue,
    animalCount: totalAnimalCount,
    animalsWithWeight,
    marketPrice,
    priceSource,
    priceDate,
    previousMonthValue,
    changePercent,
    changeAmount,
    monthlyTrend,
    hasCompleteData,
    missingWeightCount,
    valuationSource: 'realtime',
  };
}

/**
 * Build monthly trend data from snapshots
 */
function buildMonthlyTrend(
  snapshots: Array<{ animal_id: string; estimated_value: number | null; valuation_date: string }>,
  monthsBack: number
): HerdValuationTrendPoint[] {
  const monthlyData = new Map<string, Map<string, number>>();
  
  snapshots.forEach((v) => {
    const monthKey = format(new Date(v.valuation_date), "yyyy-MM");
    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, new Map());
    }
    monthlyData.get(monthKey)!.set(v.animal_id, v.estimated_value || 0);
  });

  const allAnimalValues = new Map<string, number>();
  const result: HerdValuationTrendPoint[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthDate = subMonths(new Date(), i);
    const monthKey = format(monthDate, "yyyy-MM");
    const monthLabel = format(monthDate, "MMM yyyy");

    if (monthlyData.has(monthKey)) {
      monthlyData.get(monthKey)!.forEach((value, animalId) => {
        allAnimalValues.set(animalId, value);
      });
    }

    let totalValue = 0;
    allAnimalValues.forEach((value) => {
      totalValue += value;
    });

    result.push({ month: monthLabel, value: totalValue, count: allAnimalValues.size });
  }

  return result;
}

/**
 * Get previous month's total value from snapshots
 */
function getPreviousMonthValue(
  snapshots: Array<{ animal_id: string; estimated_value: number | null; valuation_date: string }>
): number {
  const lastMonth = subMonths(startOfMonth(new Date()), 1);
  const lastMonthEnd = startOfMonth(new Date());

  const prevMonthValues = new Map<string, number>();
  
  snapshots
    .filter((v) => {
      const date = new Date(v.valuation_date);
      return date >= lastMonth && date < lastMonthEnd;
    })
    .forEach((v) => {
      prevMonthValues.set(v.animal_id, v.estimated_value || 0);
    });

  let total = 0;
  prevMonthValues.forEach((value) => {
    total += value;
  });

  return total;
}

/**
 * Return empty valuation structure
 */
function getEmptyValuation(): UnifiedHerdValuation {
  return {
    currentValue: 0,
    animalCount: 0,
    animalsWithWeight: 0,
    marketPrice: 300,
    priceSource: "system_default",
    priceDate: format(new Date(), "yyyy-MM-dd"),
    previousMonthValue: 0,
    changePercent: 0,
    changeAmount: 0,
    monthlyTrend: [],
    hasCompleteData: false,
    missingWeightCount: 0,
    valuationSource: 'realtime',
  };
}
