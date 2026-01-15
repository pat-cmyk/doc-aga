import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subMonths, startOfYear, format } from "date-fns";

interface TopSource {
  source: string;
  amount: number;
  percentage: number;
}

interface TopCategory {
  category: string;
  amount: number;
  percentage: number;
}

export interface RevenueExpenseComparisonData {
  // Monthly totals
  revenueThisMonth: number;
  expenseThisMonth: number;
  revenueLastMonth: number;
  expenseLastMonth: number;
  
  // Trends (percentage change)
  revenueChange: number;
  expenseChange: number;
  
  // Year totals
  revenueThisYear: number;
  expenseThisYear: number;
  netThisYear: number;
  
  // Top breakdowns (top 3 each)
  topRevenueSources: TopSource[];
  topExpenseCategories: TopCategory[];
}

export function useRevenueExpenseComparison(farmId: string) {
  return useQuery({
    queryKey: ["revenue-expense-comparison", farmId],
    queryFn: async (): Promise<RevenueExpenseComparisonData> => {
      const now = new Date();
      const thisMonthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const thisMonthEnd = format(endOfMonth(now), "yyyy-MM-dd");
      const lastMonthStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
      const lastMonthEnd = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
      const yearStart = format(startOfYear(now), "yyyy-MM-dd");

      // Fetch revenues
      const { data: revenues } = await supabase
        .from("farm_revenues")
        .select("amount, source, transaction_date")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .gte("transaction_date", yearStart);

      // Fetch expenses
      const { data: expenses } = await supabase
        .from("farm_expenses")
        .select("amount, category, expense_date")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .gte("expense_date", yearStart);

      const revenueList = revenues || [];
      const expenseList = expenses || [];

      // Calculate monthly totals
      const revenueThisMonth = revenueList
        .filter(r => r.transaction_date >= thisMonthStart && r.transaction_date <= thisMonthEnd)
        .reduce((sum, r) => sum + Number(r.amount), 0);

      const revenueLastMonth = revenueList
        .filter(r => r.transaction_date >= lastMonthStart && r.transaction_date <= lastMonthEnd)
        .reduce((sum, r) => sum + Number(r.amount), 0);

      const expenseThisMonth = expenseList
        .filter(e => e.expense_date >= thisMonthStart && e.expense_date <= thisMonthEnd)
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const expenseLastMonth = expenseList
        .filter(e => e.expense_date >= lastMonthStart && e.expense_date <= lastMonthEnd)
        .reduce((sum, e) => sum + Number(e.amount), 0);

      // Calculate trends
      const revenueChange = revenueLastMonth > 0 
        ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100 
        : 0;

      const expenseChange = expenseLastMonth > 0 
        ? ((expenseThisMonth - expenseLastMonth) / expenseLastMonth) * 100 
        : 0;

      // Calculate year totals
      const revenueThisYear = revenueList.reduce((sum, r) => sum + Number(r.amount), 0);
      const expenseThisYear = expenseList.reduce((sum, e) => sum + Number(e.amount), 0);
      const netThisYear = revenueThisYear - expenseThisYear;

      // Calculate top revenue sources (this month)
      const revenueBySource: Record<string, number> = {};
      revenueList
        .filter(r => r.transaction_date >= thisMonthStart && r.transaction_date <= thisMonthEnd)
        .forEach(r => {
          revenueBySource[r.source] = (revenueBySource[r.source] || 0) + Number(r.amount);
        });

      const topRevenueSources: TopSource[] = Object.entries(revenueBySource)
        .map(([source, amount]) => ({
          source,
          amount,
          percentage: revenueThisMonth > 0 ? (amount / revenueThisMonth) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);

      // Calculate top expense categories (this month)
      const expenseByCategory: Record<string, number> = {};
      expenseList
        .filter(e => e.expense_date >= thisMonthStart && e.expense_date <= thisMonthEnd)
        .forEach(e => {
          expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + Number(e.amount);
        });

      const topExpenseCategories: TopCategory[] = Object.entries(expenseByCategory)
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: expenseThisMonth > 0 ? (amount / expenseThisMonth) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);

      return {
        revenueThisMonth,
        expenseThisMonth,
        revenueLastMonth,
        expenseLastMonth,
        revenueChange,
        expenseChange,
        revenueThisYear,
        expenseThisYear,
        netThisYear,
        topRevenueSources,
        topExpenseCategories,
      };
    },
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000,
  });
}
