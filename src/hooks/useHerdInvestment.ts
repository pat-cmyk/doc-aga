import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HerdInvestment {
  totalPurchasePrice: number;
  totalAnimalExpenses: number;
  totalInvestment: number;
  purchasedCount: number;
  grantCount: number;
  bornOnFarmCount: number;
  animalsWithPriceData: number;
  averagePurchasePrice: number;
}

export interface HerdInvestmentTrend {
  previousMonthInvestment: number;
  changePercent: number;
}

export const useHerdInvestment = (farmId: string) => {
  return useQuery<HerdInvestment>({
    queryKey: ["herd-investment", farmId],
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Get animals with acquisition data
      const { data: animals, error: animalsError } = await supabase
        .from("animals")
        .select("id, acquisition_type, purchase_price, grant_source")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .is("exit_date", null);

      if (animalsError) throw animalsError;

      // Get all animal-linked expenses for this farm
      const { data: expenses, error: expensesError } = await supabase
        .from("farm_expenses")
        .select("amount, animal_id")
        .eq("farm_id", farmId)
        .not("animal_id", "is", null)
        .eq("is_deleted", false);

      if (expensesError) throw expensesError;

      // Calculate totals
      let totalPurchasePrice = 0;
      let purchasedCount = 0;
      let grantCount = 0;
      let bornOnFarmCount = 0;
      let animalsWithPriceData = 0;

      animals?.forEach((animal) => {
        if (animal.acquisition_type === "purchased") {
          purchasedCount++;
          if (animal.purchase_price) {
            totalPurchasePrice += animal.purchase_price;
            animalsWithPriceData++;
          }
        } else if (animal.acquisition_type === "grant") {
          grantCount++;
        } else if (animal.acquisition_type === "born_on_farm") {
          bornOnFarmCount++;
        }
      });

      const totalAnimalExpenses = expenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;

      return {
        totalPurchasePrice,
        totalAnimalExpenses,
        totalInvestment: totalPurchasePrice + totalAnimalExpenses,
        purchasedCount,
        grantCount,
        bornOnFarmCount,
        animalsWithPriceData,
        averagePurchasePrice: purchasedCount > 0 ? totalPurchasePrice / purchasedCount : 0,
      };
    },
  });
};

export const useHerdInvestmentTrend = (farmId: string) => {
  return useQuery<HerdInvestmentTrend | null>({
    queryKey: ["herd-investment-trend", farmId],
    enabled: !!farmId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      // Get previous month's expense total for comparison
      const now = new Date();
      const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const { data: lastMonthExpenses, error } = await supabase
        .from("farm_expenses")
        .select("amount")
        .eq("farm_id", farmId)
        .not("animal_id", "is", null)
        .eq("is_deleted", false)
        .gte("expense_date", firstOfLastMonth.toISOString().split("T")[0])
        .lt("expense_date", firstOfThisMonth.toISOString().split("T")[0]);

      if (error) return null;

      const previousMonthInvestment = lastMonthExpenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;

      return {
        previousMonthInvestment,
        changePercent: 0, // Would need current month calculation for proper comparison
      };
    },
  });
};
