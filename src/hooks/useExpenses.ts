import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/errorHandling";
import { getCacheManager, isCacheManagerReady } from "@/lib/cacheManager";
import { getCachedExpenses, updateExpensesCache } from "@/lib/dataCache";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { format } from "date-fns";
import { DateRange } from "@/components/finance/FinanceDateRangePicker";

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

export function useExpenses(farmId: string, dateRange?: DateRange) {
  const isOnline = useOnlineStatus();

  return useQuery({
    queryKey: ["expenses", farmId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async () => {
      // 1. Try IndexedDB cache first
      const cached = await getCachedExpenses(farmId);

      // 2. If offline, serve from cache with client-side date filtering
      if (!isOnline) {
        if (cached) {
          let items = cached.data as Expense[];
          if (dateRange) {
            const startStr = format(dateRange.start, "yyyy-MM-dd");
            const endStr = format(dateRange.end, "yyyy-MM-dd");
            items = items.filter(
              (e) => e.expense_date >= startStr && e.expense_date <= endStr
            );
          }
          return items;
        }
        return [] as Expense[];
      }

      // 3. Online: fetch from Supabase
      let query = supabase
        .from("farm_expenses")
        .select("*")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .order("expense_date", { ascending: false });

      if (dateRange) {
        query = query
          .gte("expense_date", format(dateRange.start, "yyyy-MM-dd"))
          .lte("expense_date", format(dateRange.end, "yyyy-MM-dd"));
      }

      const { data, error } = await query;
      if (error) throw error;

      const expenses = data as Expense[];

      // 4. Update cache with unfiltered data (only when no date filter to avoid partial cache)
      if (!dateRange) {
        await updateExpensesCache(farmId, expenses);
      }

      return expenses;
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
    onError: (error) => {
      showErrorToast(error, "adding expense");
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
      showErrorToast(error, "updating expense");
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
      showErrorToast(error, "deleting expense");
    },
  });
}
