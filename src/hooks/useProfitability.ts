import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

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

export function useProfitability(farmId: string | undefined) {
  return useQuery({
    queryKey: ["profitability", farmId],
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

      const currentMonthStart = startOfMonth(new Date());
      const currentMonthEnd = endOfMonth(new Date());
      const lastMonthStart = startOfMonth(subMonths(new Date(), 1));
      const lastMonthEnd = endOfMonth(subMonths(new Date(), 1));

      // 1. Get operational costs for current month
      const { data: expenses, error: expensesError } = await supabase
        .from("farm_expenses")
        .select("amount, allocation_type")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .gte("expense_date", format(currentMonthStart, "yyyy-MM-dd"))
        .lte("expense_date", format(currentMonthEnd, "yyyy-MM-dd"));

      if (expensesError) {
        console.error("Error fetching expenses:", expensesError);
        throw expensesError;
      }

      const operationalCosts = (expenses || [])
        .filter((e) => e.allocation_type === "Operational" || !e.allocation_type)
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      // 2. Get revenues for current month
      const { data: revenues, error: revenuesError } = await supabase
        .from("farm_revenues")
        .select("amount, source")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .gte("transaction_date", format(currentMonthStart, "yyyy-MM-dd"))
        .lte("transaction_date", format(currentMonthEnd, "yyyy-MM-dd"));

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
      // Get current month valuations (latest per animal)
      const { data: currentValuations } = await supabase
        .from("biological_asset_valuations")
        .select("animal_id, estimated_value, valuation_date")
        .eq("farm_id", farmId)
        .gte("valuation_date", format(currentMonthStart, "yyyy-MM-dd"))
        .lte("valuation_date", format(currentMonthEnd, "yyyy-MM-dd"))
        .order("valuation_date", { ascending: false });

      // Get latest valuation per animal for current month
      const currentAnimalValues = new Map<string, number>();
      (currentValuations || []).forEach((v) => {
        if (!currentAnimalValues.has(v.animal_id)) {
          currentAnimalValues.set(v.animal_id, v.estimated_value || 0);
        }
      });

      // Get last month's valuations (latest per animal)
      const { data: lastMonthValuations } = await supabase
        .from("biological_asset_valuations")
        .select("animal_id, estimated_value, valuation_date")
        .eq("farm_id", farmId)
        .gte("valuation_date", format(lastMonthStart, "yyyy-MM-dd"))
        .lte("valuation_date", format(lastMonthEnd, "yyyy-MM-dd"))
        .order("valuation_date", { ascending: false });

      const lastMonthAnimalValues = new Map<string, number>();
      (lastMonthValuations || []).forEach((v) => {
        if (!lastMonthAnimalValues.has(v.animal_id)) {
          lastMonthAnimalValues.set(v.animal_id, v.estimated_value || 0);
        }
      });

      // Calculate unrealized gain (increase in value for animals present in both months)
      let unrealizedGain = 0;
      currentAnimalValues.forEach((currentValue, animalId) => {
        const previousValue = lastMonthAnimalValues.get(animalId) || 0;
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
