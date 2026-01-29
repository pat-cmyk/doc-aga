import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, differenceInDays, format } from "date-fns";

export interface ProfitabilityData {
  operationalCosts: number;
  cashRevenue: number;
  unrealizedGain: number;
  totalInput: number;
  totalOutput: number;
  netPosition: number;
  isProfitable: boolean;
  milkRevenue: number;
  animalSalesRevenue: number;
  otherRevenue: number;
}

interface DateRange {
  start: Date;
  end: Date;
}

export function useProfitability(farmId: string | undefined, dateRange?: DateRange) {
  return useQuery({
    queryKey: ["profitability", farmId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async (): Promise<ProfitabilityData> => {
      if (!farmId) {
        return {
          operationalCosts: 0,
          cashRevenue: 0,
          unrealizedGain: 0,
          totalInput: 0,
          totalOutput: 0,
          netPosition: 0,
          isProfitable: true,
          milkRevenue: 0,
          animalSalesRevenue: 0,
          otherRevenue: 0,
        };
      }

      const now = new Date();
      
      // Use provided date range or default to current month
      const periodStart = dateRange?.start || now;
      const periodEnd = dateRange?.end || now;
      
      // Calculate the period length for comparison
      const periodLengthDays = differenceInDays(periodEnd, periodStart) + 1;
      
      // Calculate comparison period (same length, immediately before)
      const comparisonEnd = subDays(periodStart, 1);
      const comparisonStart = subDays(comparisonEnd, periodLengthDays - 1);

      const periodStartStr = format(periodStart, "yyyy-MM-dd");
      const periodEndStr = format(periodEnd, "yyyy-MM-dd");
      const comparisonStartStr = format(comparisonStart, "yyyy-MM-dd");
      const comparisonEndStr = format(comparisonEnd, "yyyy-MM-dd");

      // 1. Get operational costs for current period
      const { data: expenses, error: expensesError } = await supabase
        .from("farm_expenses")
        .select("amount, allocation_type")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .gte("expense_date", periodStartStr)
        .lte("expense_date", periodEndStr);

      if (expensesError) {
        console.error("Error fetching expenses:", expensesError);
        throw expensesError;
      }

      const operationalCosts = (expenses || [])
        .filter((e) => e.allocation_type === "Operational" || !e.allocation_type)
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      // 2. Get revenues for current period
      const { data: revenues, error: revenuesError } = await supabase
        .from("farm_revenues")
        .select("amount, source")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .gte("transaction_date", periodStartStr)
        .lte("transaction_date", periodEndStr);

      if (revenuesError) {
        console.error("Error fetching revenues:", revenuesError);
        throw revenuesError;
      }

      let milkRevenue = 0;
      let animalSalesRevenue = 0;
      let otherRevenue = 0;

      (revenues || []).forEach((r) => {
        const amount = Number(r.amount) || 0;
        if (r.source === "Milk Sale") {
          milkRevenue += amount;
        } else if (r.source === "Animal Sale") {
          animalSalesRevenue += amount;
        } else {
          otherRevenue += amount;
        }
      });

      const cashRevenue = milkRevenue + animalSalesRevenue + otherRevenue;

      // 3. Calculate unrealized gain from herd value growth
      // Get current period valuations (latest per animal)
      const { data: currentValuations } = await supabase
        .from("biological_asset_valuations")
        .select("animal_id, estimated_value, valuation_date")
        .eq("farm_id", farmId)
        .gte("valuation_date", periodStartStr)
        .lte("valuation_date", periodEndStr)
        .order("valuation_date", { ascending: false });

      // Get latest valuation per animal for current period
      const currentAnimalValues = new Map<string, number>();
      (currentValuations || []).forEach((v) => {
        if (!currentAnimalValues.has(v.animal_id)) {
          currentAnimalValues.set(v.animal_id, v.estimated_value || 0);
        }
      });

      // Get comparison period valuations (latest per animal)
      const { data: comparisonValuations } = await supabase
        .from("biological_asset_valuations")
        .select("animal_id, estimated_value, valuation_date")
        .eq("farm_id", farmId)
        .gte("valuation_date", comparisonStartStr)
        .lte("valuation_date", comparisonEndStr)
        .order("valuation_date", { ascending: false });

      const comparisonAnimalValues = new Map<string, number>();
      (comparisonValuations || []).forEach((v) => {
        if (!comparisonAnimalValues.has(v.animal_id)) {
          comparisonAnimalValues.set(v.animal_id, v.estimated_value || 0);
        }
      });

      // Calculate unrealized gain (increase in value for animals present in both periods)
      let unrealizedGain = 0;
      currentAnimalValues.forEach((currentValue, animalId) => {
        const previousValue = comparisonAnimalValues.get(animalId) || 0;
        unrealizedGain += currentValue - previousValue;
      });

      // Calculate totals
      const totalInput = operationalCosts;
      const totalOutput = cashRevenue + Math.max(unrealizedGain, 0); // Only count positive growth
      const netPosition = totalOutput - totalInput;
      const isProfitable = netPosition >= 0;

      return {
        operationalCosts,
        cashRevenue,
        unrealizedGain,
        totalInput,
        totalOutput,
        netPosition,
        isProfitable,
        milkRevenue,
        animalSalesRevenue,
        otherRevenue,
      };
    },
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000,
  });
}
