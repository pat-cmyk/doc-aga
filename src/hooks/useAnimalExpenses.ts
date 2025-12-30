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
      const { data, error } = await supabase
        .from("farm_expenses")
        .select("category, amount")
        .eq("animal_id", animalId)
        .eq("is_deleted", false);

      if (error) throw error;

      const summary: AnimalExpenseSummary = {
        totalExpenses: 0,
        categoryBreakdown: {},
        expenseCount: data?.length || 0,
      };

      data?.forEach((expense) => {
        summary.totalExpenses += expense.amount;
        summary.categoryBreakdown[expense.category] =
          (summary.categoryBreakdown[expense.category] || 0) + expense.amount;
      });

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
