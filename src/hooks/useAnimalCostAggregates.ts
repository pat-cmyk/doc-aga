import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export const useAnimalCostAggregates = (farmId: string) => {
  return useQuery<FarmCostAnalysis>({
    queryKey: ["animal-cost-aggregates", farmId],
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Get all active animals with their basic info
      const { data: animals, error: animalsError } = await supabase
        .from("animals")
        .select("id, name, ear_tag, purchase_price")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .is("exit_date", null);

      if (animalsError) throw animalsError;

      // Get all animal-linked expenses
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

      // Calculate per-animal costs
      const animalCosts: AnimalCostAggregate[] = animals?.map((animal) => ({
        animalId: animal.id,
        animalName: animal.name,
        earTag: animal.ear_tag,
        purchasePrice: animal.purchase_price,
        totalExpenses: expensesByAnimal[animal.id] || 0,
        totalCost: (animal.purchase_price || 0) + (expensesByAnimal[animal.id] || 0),
      })) || [];

      // Sort by total cost and get top 5
      const topExpensiveAnimals = [...animalCosts]
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, 5);

      // Calculate category breakdown
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

      return {
        totalAnimals,
        animalsWithExpenses,
        totalAnimalExpenses,
        averageCostPerAnimal: totalAnimals > 0 ? totalAnimalExpenses / totalAnimals : 0,
        topExpensiveAnimals,
        categoryBreakdown,
      };
    },
  });
};
