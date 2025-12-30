import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RegionalInvestmentData {
  totalHerdInvestment: number;
  totalAnimalExpenses: number;
  averageInvestmentPerFarm: number;
  averageInvestmentPerAnimal: number;
  farmCount: number;
  animalCount: number;
  purchasedAnimalCount: number;
  avgPurchasePrice: number;
}

export const useRegionalInvestment = (
  region?: string,
  province?: string,
  municipality?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery<RegionalInvestmentData>({
    queryKey: ["regional-investment", region || "all", province || "all", municipality || "all"],
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Get farms matching the location filter
      let farmsQuery = supabase
        .from("farms")
        .select("id")
        .eq("is_deleted", false);

      if (region) {
        farmsQuery = farmsQuery.eq("region", region);
      }
      if (province) {
        farmsQuery = farmsQuery.eq("province", province);
      }
      if (municipality) {
        farmsQuery = farmsQuery.eq("municipality", municipality);
      }

      const { data: farms, error: farmsError } = await farmsQuery;

      if (farmsError) throw farmsError;

      const farmIds = farms?.map((f) => f.id) || [];
      const farmCount = farmIds.length;

      if (farmCount === 0) {
        return {
          totalHerdInvestment: 0,
          totalAnimalExpenses: 0,
          averageInvestmentPerFarm: 0,
          averageInvestmentPerAnimal: 0,
          farmCount: 0,
          animalCount: 0,
          purchasedAnimalCount: 0,
          avgPurchasePrice: 0,
        };
      }

      // Get animals with purchase prices
      const { data: animals, error: animalsError } = await supabase
        .from("animals")
        .select("id, purchase_price, acquisition_type")
        .in("farm_id", farmIds)
        .eq("is_deleted", false)
        .is("exit_date", null);

      if (animalsError) throw animalsError;

      // Get animal-linked expenses
      const { data: expenses, error: expensesError } = await supabase
        .from("farm_expenses")
        .select("amount")
        .in("farm_id", farmIds)
        .not("animal_id", "is", null)
        .eq("is_deleted", false);

      if (expensesError) throw expensesError;

      // Calculate totals
      let totalPurchasePrice = 0;
      let purchasedCount = 0;

      animals?.forEach((animal) => {
        if (animal.acquisition_type === "purchased" && animal.purchase_price) {
          totalPurchasePrice += animal.purchase_price;
          purchasedCount++;
        }
      });

      const totalAnimalExpenses = expenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;
      const animalCount = animals?.length || 0;
      const totalHerdInvestment = totalPurchasePrice + totalAnimalExpenses;

      return {
        totalHerdInvestment,
        totalAnimalExpenses,
        averageInvestmentPerFarm: farmCount > 0 ? totalHerdInvestment / farmCount : 0,
        averageInvestmentPerAnimal: animalCount > 0 ? totalHerdInvestment / animalCount : 0,
        farmCount,
        animalCount,
        purchasedAnimalCount: purchasedCount,
        avgPurchasePrice: purchasedCount > 0 ? totalPurchasePrice / purchasedCount : 0,
      };
    },
  });
};
