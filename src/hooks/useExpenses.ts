import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getCacheManager, isCacheManagerReady } from "@/lib/cacheManager";

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
  allocation_type: 'Operational' | 'Capital' | 'Personal' | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

interface AddExpenseData {
  farm_id: string;
  category: string;
  amount: number;
  description?: string;
  expense_date: string;
  payment_method?: string;
  allocation_type?: 'Operational' | 'Personal';
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
    onSuccess: async (_, variables) => {
      if (isCacheManagerReady()) {
        await getCacheManager().invalidateForMutation('expense', variables.farm_id);
      } else {
        queryClient.invalidateQueries({ queryKey: ["expenses", variables.farm_id] });
        queryClient.invalidateQueries({ queryKey: ["expense-summary", variables.farm_id] });
        queryClient.invalidateQueries({ queryKey: ["profitability", variables.farm_id] });
      }
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
    onSuccess: async (data) => {
      if (isCacheManagerReady()) {
        await getCacheManager().invalidateForMutation('expense', data.farm_id);
      } else {
        queryClient.invalidateQueries({ queryKey: ["expenses", data.farm_id] });
        queryClient.invalidateQueries({ queryKey: ["expense-summary", data.farm_id] });
        queryClient.invalidateQueries({ queryKey: ["profitability", data.farm_id] });
      }
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
    onSuccess: async (data) => {
      if (isCacheManagerReady()) {
        await getCacheManager().invalidateForMutation('expense', data.farmId);
      } else {
        queryClient.invalidateQueries({ queryKey: ["expenses", data.farmId] });
        queryClient.invalidateQueries({ queryKey: ["expense-summary", data.farmId] });
        queryClient.invalidateQueries({ queryKey: ["profitability", data.farmId] });
      }
      toast.success("Expense deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting expense:", error);
      toast.error("Failed to delete expense");
    },
  });
}
