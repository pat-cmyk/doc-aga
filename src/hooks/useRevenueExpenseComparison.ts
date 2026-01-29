import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, differenceInDays, format } from "date-fns";

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
  // Period totals
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

interface DateRange {
  start: Date;
  end: Date;
}

export function useRevenueExpenseComparison(farmId: string, dateRange?: DateRange) {
  return useQuery({
    queryKey: ["revenue-expense-comparison", farmId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async (): Promise<RevenueExpenseComparisonData> => {
      const now = new Date();
      
      // Use provided date range or default to current month
      const periodStart = dateRange?.start || now;
      const periodEnd = dateRange?.end || now;
      
      // Calculate the period length in days
      const periodLengthDays = differenceInDays(periodEnd, periodStart) + 1;
      
      // Calculate comparison period (same length, immediately before)
      const comparisonEnd = subDays(periodStart, 1);
      const comparisonStart = subDays(comparisonEnd, periodLengthDays - 1);

      const periodStartStr = format(periodStart, "yyyy-MM-dd");
      const periodEndStr = format(periodEnd, "yyyy-MM-dd");
      const comparisonStartStr = format(comparisonStart, "yyyy-MM-dd");
      const comparisonEndStr = format(comparisonEnd, "yyyy-MM-dd");

      // Calculate year start for YTD totals
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const yearStartStr = format(yearStart, "yyyy-MM-dd");

      // Fetch all revenues for the year (to calculate YTD)
      const { data: revenues } = await supabase
        .from("farm_revenues")
        .select("amount, source, transaction_date")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .gte("transaction_date", yearStartStr);

      // Fetch all expenses for the year
      const { data: expenses } = await supabase
        .from("farm_expenses")
        .select("amount, category, expense_date")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .gte("expense_date", yearStartStr);

      const revenueList = revenues || [];
      const expenseList = expenses || [];

      // Calculate current period totals
      const revenueThisMonth = revenueList
        .filter(r => r.transaction_date >= periodStartStr && r.transaction_date <= periodEndStr)
        .reduce((sum, r) => sum + Number(r.amount), 0);

      const revenueLastMonth = revenueList
        .filter(r => r.transaction_date >= comparisonStartStr && r.transaction_date <= comparisonEndStr)
        .reduce((sum, r) => sum + Number(r.amount), 0);

      const expenseThisMonth = expenseList
        .filter(e => e.expense_date >= periodStartStr && e.expense_date <= periodEndStr)
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const expenseLastMonth = expenseList
        .filter(e => e.expense_date >= comparisonStartStr && e.expense_date <= comparisonEndStr)
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

      // Calculate top revenue sources (for selected period)
      const revenueBySource: Record<string, number> = {};
      revenueList
        .filter(r => r.transaction_date >= periodStartStr && r.transaction_date <= periodEndStr)
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

      // Calculate top expense categories (for selected period)
      const expenseByCategory: Record<string, number> = {};
      expenseList
        .filter(e => e.expense_date >= periodStartStr && e.expense_date <= periodEndStr)
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
