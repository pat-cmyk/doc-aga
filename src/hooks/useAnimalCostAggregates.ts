/**
 * @cache-status MANAGED — Cache-first via IndexedDB (animalCostCache, 15 min TTL)
 * Routes through CacheManager 'expense' type for invalidation
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getCachedAnimalCosts, updateAnimalCostCache } from "@/lib/dataCache";

export interface AnimalCostAggregate {
  animalId: string;
  animalName: string | null;
  earTag: string | null;
  purchasePrice: number | null;
  totalExpenses: number;
  totalCost: number;
}

export interface CategoryExpenseBreakdown {
  category: string;
  totalAmount: number;
  count: number;
}

export interface FarmCostAnalysis {
  totalAnimals: number;
  animalsWithExpenses: number;
  totalAnimalExpenses: number;
  averageCostPerAnimal: number;
  topExpensiveAnimals: AnimalCostAggregate[];
  categoryBreakdown: CategoryExpenseBreakdown[];
}

const EMPTY_ANALYSIS: FarmCostAnalysis = {
  totalAnimals: 0,
  animalsWithExpenses: 0,
  totalAnimalExpenses: 0,
  averageCostPerAnimal: 0,
  topExpensiveAnimals: [],
  categoryBreakdown: [],
};

export const useAnimalCostAggregates = (farmId: string) => {
  const isOnline = useOnlineStatus();

  return useQuery<FarmCostAnalysis>({
    queryKey: ["animal-cost-aggregates", farmId],
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // 1. Check IndexedDB cache first
      const cached = await getCachedAnimalCosts(farmId);
      if (cached) return cached.data as FarmCostAnalysis;

      // 2. If offline with no cache, return empty
      if (!isOnline) return EMPTY_ANALYSIS;

      // 3. Fetch from Supabase
      const { data: animals, error: animalsError } = await supabase
        .from("animals")
        .select("id, name, ear_tag, purchase_price")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .is("exit_date", null);

      if (animalsError) throw animalsError;

      const { data: expenses, error: expensesError } = await supabase
        .from("farm_expenses")
        .select("animal_id, amount, category")
        .eq("farm_id", farmId)
        .not("animal_id", "is", null)
        .eq("is_deleted", false);

      if (expensesError) throw expensesError;

      // Build expense map by animal
      const expensesByAnimal: Record<string, number> = {};
      const categoryTotals: Record<string, { amount: number; count: number }> = {};

      expenses?.forEach((expense) => {
        if (expense.animal_id) {
          expensesByAnimal[expense.animal_id] = (expensesByAnimal[expense.animal_id] || 0) + (expense.amount || 0);
        }
        if (expense.category) {
          if (!categoryTotals[expense.category]) {
            categoryTotals[expense.category] = { amount: 0, count: 0 };
          }
          categoryTotals[expense.category].amount += expense.amount || 0;
          categoryTotals[expense.category].count++;
        }
      });

      const animalCosts: AnimalCostAggregate[] = animals?.map((animal) => ({
        animalId: animal.id,
        animalName: animal.name,
        earTag: animal.ear_tag,
        purchasePrice: animal.purchase_price,
        totalExpenses: expensesByAnimal[animal.id] || 0,
        totalCost: (animal.purchase_price || 0) + (expensesByAnimal[animal.id] || 0),
      })) || [];

      const topExpensiveAnimals = [...animalCosts]
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, 5);

      const categoryBreakdown: CategoryExpenseBreakdown[] = Object.entries(categoryTotals)
        .map(([category, data]) => ({
          category,
          totalAmount: data.amount,
          count: data.count,
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount);

      const totalAnimalExpenses = expenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;
      const animalsWithExpenses = Object.keys(expensesByAnimal).length;
      const totalAnimals = animals?.length || 0;

      const result: FarmCostAnalysis = {
        totalAnimals,
        animalsWithExpenses,
        totalAnimalExpenses,
        averageCostPerAnimal: totalAnimals > 0 ? totalAnimalExpenses / totalAnimals : 0,
        topExpensiveAnimals,
        categoryBreakdown,
      };

      // 4. Update cache
      await updateAnimalCostCache(farmId, result);

      return result;
    },
  });
};
