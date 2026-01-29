import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AnimalExpense {
  id: string;
  animal_id: string;
  farm_id: string;
  category: string;
  amount: number;
  description: string | null;
  expense_date: string;
  payment_method: string | null;
  created_at: string;
}

export interface AnimalExpenseSummary {
  totalExpenses: number;
  categoryBreakdown: Record<string, number>;
  expenseCount: number;
  feedConsumptionCost: number;
  manualExpenses: number;
}

export interface AddAnimalExpenseData {
  animal_id: string;
  farm_id: string;
  category: string;
  amount: number;
  description?: string;
  expense_date: string;
  payment_method?: string;
}

export function useAnimalExpenses(animalId: string) {
  return useQuery({
    queryKey: ["animal-expenses", animalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farm_expenses")
        .select("*")
        .eq("animal_id", animalId)
        .eq("is_deleted", false)
        .order("expense_date", { ascending: false });

      if (error) throw error;
      return data as AnimalExpense[];
    },
    enabled: !!animalId,
  });
}

export function useAnimalExpenseSummary(animalId: string) {
  return useQuery({
    queryKey: ["animal-expense-summary", animalId],
    queryFn: async () => {
      // Get manual expenses from farm_expenses
      const { data: expenseData, error: expenseError } = await supabase
        .from("farm_expenses")
        .select("category, amount")
        .eq("animal_id", animalId)
        .eq("is_deleted", false);

      if (expenseError) throw expenseError;

      // Get feed consumption costs from feeding_records
      const { data: feedingData, error: feedingError } = await supabase
        .from("feeding_records")
        .select("kilograms, cost_per_kg_at_time")
        .eq("animal_id", animalId)
        .not("cost_per_kg_at_time", "is", null);

      if (feedingError) throw feedingError;

      // Calculate manual expenses
      let manualExpenses = 0;
      const categoryBreakdown: Record<string, number> = {};

      expenseData?.forEach((expense) => {
        manualExpenses += expense.amount;
        categoryBreakdown[expense.category] =
          (categoryBreakdown[expense.category] || 0) + expense.amount;
      });

      // Calculate feed consumption cost
      const feedConsumptionCost = feedingData?.reduce(
        (sum, record) => sum + ((record.kilograms || 0) * (record.cost_per_kg_at_time || 0)),
        0
      ) || 0;

      const summary: AnimalExpenseSummary = {
        totalExpenses: manualExpenses + feedConsumptionCost,
        categoryBreakdown,
        expenseCount: expenseData?.length || 0,
        feedConsumptionCost,
        manualExpenses,
      };

      return summary;
    },
    enabled: !!animalId,
  });
}

export function useAddAnimalExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expenseData: AddAnimalExpenseData) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("farm_expenses")
        .insert({
          ...expenseData,
          user_id: user.user.id,
          allocation_type: "Operational",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["animal-expenses", variables.animal_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["animal-expense-summary", variables.animal_id],
      });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

export function useDeleteAnimalExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      expenseId,
      animalId,
    }: {
      expenseId: string;
      animalId: string;
    }) => {
      const { error } = await supabase
        .from("farm_expenses")
        .update({ is_deleted: true })
        .eq("id", expenseId);

      if (error) throw error;
      return { expenseId, animalId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["animal-expenses", variables.animalId],
      });
      queryClient.invalidateQueries({
        queryKey: ["animal-expense-summary", variables.animalId],
      });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}
