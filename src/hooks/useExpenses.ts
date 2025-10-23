import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Expense {
  id: string;
  farm_id: string;
  user_id: string;
  category: string;
  amount: number;
  description: string | null;
  expense_date: string;
  payment_method: string | null;
  receipt_url: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface ExpenseSummary {
  thisMonth: number;
  lastMonth: number;
  thisYear: number;
  topCategory: { category: string; amount: number } | null;
  averageDaily: number;
}

interface AddExpenseData {
  farm_id: string;
  category: string;
  amount: number;
  description?: string;
  expense_date: string;
  payment_method?: string;
}

export function useExpenses(farmId: string) {
  return useQuery({
    queryKey: ["expenses", farmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farm_expenses")
        .select("*")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .order("expense_date", { ascending: false });

      if (error) throw error;
      return data as Expense[];
    },
    enabled: !!farmId,
  });
}

export function useExpenseSummary(farmId: string) {
  return useQuery({
    queryKey: ["expense-summary", farmId],
    queryFn: async () => {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const thisYearStart = new Date(now.getFullYear(), 0, 1);

      const { data, error } = await supabase
        .from("farm_expenses")
        .select("*")
        .eq("farm_id", farmId)
        .eq("is_deleted", false);

      if (error) throw error;

      const expenses = data as Expense[];

      // Calculate this month total
      const thisMonthExpenses = expenses.filter(
        (e) => new Date(e.expense_date) >= thisMonthStart
      );
      const thisMonth = thisMonthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

      // Calculate last month total
      const lastMonthExpenses = expenses.filter(
        (e) =>
          new Date(e.expense_date) >= lastMonthStart &&
          new Date(e.expense_date) <= lastMonthEnd
      );
      const lastMonth = lastMonthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

      // Calculate this year total
      const thisYearExpenses = expenses.filter(
        (e) => new Date(e.expense_date) >= thisYearStart
      );
      const thisYear = thisYearExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

      // Calculate top category this month
      const categoryTotals = thisMonthExpenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
        return acc;
      }, {} as Record<string, number>);

      const topCategory = Object.entries(categoryTotals).length
        ? Object.entries(categoryTotals).reduce((top, [cat, amt]) =>
            amt > top.amount ? { category: cat, amount: amt } : top
          , { category: "", amount: 0 })
        : null;

      // Calculate average daily spending this month
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const averageDaily = thisMonth / daysInMonth;

      return {
        thisMonth,
        lastMonth,
        thisYear,
        topCategory,
        averageDaily,
      } as ExpenseSummary;
    },
    enabled: !!farmId,
  });
}

export function useAddExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddExpenseData) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data: expense, error } = await supabase
        .from("farm_expenses")
        .insert({
          ...data,
          user_id: user.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return expense;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["expenses", variables.farm_id] });
      queryClient.invalidateQueries({ queryKey: ["expense-summary", variables.farm_id] });
      toast.success("Expense added successfully");
    },
    onError: (error, variables) => {
      console.error("Error adding expense:", error);
      toast.error("Failed to add expense. Please try again when online.");
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Expense> & { id: string }) => {
      const { data: expense, error } = await supabase
        .from("farm_expenses")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return expense;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["expenses", data.farm_id] });
      queryClient.invalidateQueries({ queryKey: ["expense-summary", data.farm_id] });
      toast.success("Expense updated successfully");
    },
    onError: (error) => {
      console.error("Error updating expense:", error);
      toast.error("Failed to update expense");
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, farmId }: { id: string; farmId: string }) => {
      const { error } = await supabase
        .from("farm_expenses")
        .update({ is_deleted: true })
        .eq("id", id);

      if (error) throw error;
      return { id, farmId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["expenses", data.farmId] });
      queryClient.invalidateQueries({ queryKey: ["expense-summary", data.farmId] });
      toast.success("Expense deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting expense:", error);
      toast.error("Failed to delete expense");
    },
  });
}
