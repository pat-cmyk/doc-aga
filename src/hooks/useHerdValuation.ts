import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, subMonths, format } from "date-fns";

export interface HerdValuationPoint {
  month: string;
  totalValue: number;
  animalCount: number;
}

export interface HerdValuationSummary {
  currentValue: number;
  previousMonthValue: number;
  changePercent: number;
  animalCount: number;
}

export function useHerdValuation(farmId: string | undefined) {
  return useQuery({
    queryKey: ["herd-valuation", farmId],
    queryFn: async (): Promise<HerdValuationPoint[]> => {
      if (!farmId) return [];

      // Get last 6 months of data
      const sixMonthsAgo = subMonths(new Date(), 6);

      // Get all valuations for farm animals
      const { data: valuations, error } = await supabase
        .from("biological_asset_valuations")
        .select(`
          id,
          animal_id,
          estimated_value,
          valuation_date,
          weight_kg,
          market_price_per_kg
        `)
        .eq("farm_id", farmId)
        .gte("valuation_date", format(sixMonthsAgo, "yyyy-MM-dd"))
        .order("valuation_date", { ascending: true });

      if (error) {
        console.error("Error fetching herd valuations:", error);
        throw error;
      }

      // Group by month and get latest valuation per animal for each month
      const monthlyData = new Map<string, Map<string, number>>();

      (valuations || []).forEach((v) => {
        const monthKey = format(new Date(v.valuation_date), "yyyy-MM");
        
        if (!monthlyData.has(monthKey)) {
          monthlyData.set(monthKey, new Map());
        }
        
        const monthAnimals = monthlyData.get(monthKey)!;
        // Keep latest valuation for each animal in the month
        monthAnimals.set(v.animal_id, v.estimated_value || 0);
      });

      // Build cumulative data - carry forward latest known values
      const allAnimalValues = new Map<string, number>();
      const result: HerdValuationPoint[] = [];
      
      // Generate all months in range
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthKey = format(monthDate, "yyyy-MM");
        const monthLabel = format(monthDate, "MMM yyyy");
        
        // Update with any new valuations for this month
        if (monthlyData.has(monthKey)) {
          monthlyData.get(monthKey)!.forEach((value, animalId) => {
            allAnimalValues.set(animalId, value);
          });
        }
        
        // Calculate total from all known animal values
        let totalValue = 0;
        allAnimalValues.forEach((value) => {
          totalValue += value;
        });
        
        result.push({
          month: monthLabel,
          totalValue,
          animalCount: allAnimalValues.size,
        });
      }

      return result;
    },
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000,
  });
}

export interface HerdValuationSummaryWithPrice extends HerdValuationSummary {
  marketPrice: number;
  priceSource: string;
  priceDate: string;
}

export function useHerdValuationSummary(farmId: string | undefined, livestockType?: string) {
  return useQuery({
    queryKey: ["herd-valuation-summary", farmId, livestockType],
    queryFn: async (): Promise<HerdValuationSummaryWithPrice> => {
      if (!farmId) {
        return { 
          currentValue: 0, 
          previousMonthValue: 0, 
          changePercent: 0, 
          animalCount: 0,
          marketPrice: 300,
          priceSource: "system_default",
          priceDate: format(new Date(), "yyyy-MM-dd"),
        };
      }

      // Get farm's primary livestock type if not provided
      const effectiveLivestockType = livestockType || "cattle";

      // Get dynamic market price using RPC
      const { data: priceData } = await supabase
        .rpc("get_market_price", {
          p_livestock_type: effectiveLivestockType,
          p_farm_id: farmId,
        });

      const marketPrice = priceData?.[0]?.price || 300;
      const priceSource = priceData?.[0]?.source || "system_default";
      const priceDate = priceData?.[0]?.effective_date || format(new Date(), "yyyy-MM-dd");

      // Get active animals with their latest weights
      const { data: animals, error: animalsError } = await supabase
        .from("animals")
        .select("id, current_weight_kg, livestock_type")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .is("exit_date", null);

      if (animalsError) {
        console.error("Error fetching animals:", animalsError);
        throw animalsError;
      }

      let currentValue = 0;
      let animalCount = 0;

      // For mixed herds, we'd ideally get price per livestock type
      // For now, use the primary livestock type price
      (animals || []).forEach((animal) => {
        if (animal.current_weight_kg) {
          currentValue += animal.current_weight_kg * marketPrice;
          animalCount++;
        }
      });

      // Get previous month's total
      const lastMonth = subMonths(startOfMonth(new Date()), 1);
      const lastMonthEnd = startOfMonth(new Date());

      const { data: prevValuations } = await supabase
        .from("biological_asset_valuations")
        .select("animal_id, estimated_value")
        .eq("farm_id", farmId)
        .gte("valuation_date", format(lastMonth, "yyyy-MM-dd"))
        .lt("valuation_date", format(lastMonthEnd, "yyyy-MM-dd"));

      // Get latest valuation per animal for previous month
      const prevAnimalValues = new Map<string, number>();
      (prevValuations || []).forEach((v) => {
        prevAnimalValues.set(v.animal_id, v.estimated_value || 0);
      });

      let previousMonthValue = 0;
      prevAnimalValues.forEach((value) => {
        previousMonthValue += value;
      });

      const changePercent = previousMonthValue > 0
        ? ((currentValue - previousMonthValue) / previousMonthValue) * 100
        : 0;

      return {
        currentValue,
        previousMonthValue,
        changePercent,
        animalCount,
        marketPrice,
        priceSource,
        priceDate,
      };
    },
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000,
  });
}
