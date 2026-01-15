import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subMonths, differenceInDays } from "date-fns";

export interface FinancialHealthData {
  // Core metrics
  earnedThisMonth: number;
  spentThisMonth: number;
  netProfit: number;
  
  // Trends
  earnedChange: number; // percentage change from last month
  spentChange: number;
  
  // Daily metrics
  dailyProfit: number;
  daysInMonth: number;
  daysPassed: number;
  
  // Status
  isProfitable: boolean;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  
  // Breakeven
  breakevenProgress: number; // percentage (0-100+)
  
  // Top sources
  topRevenueSource: string | null;
  topExpenseCategory: string | null;
}

export function useFinancialHealth(farmId: string) {
  return useQuery({
    queryKey: ["financial-health", farmId],
    queryFn: async (): Promise<FinancialHealthData> => {
      const now = new Date();
      const thisMonthStart = startOfMonth(now);
      const thisMonthEnd = endOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));
      
      const daysPassed = differenceInDays(now, thisMonthStart) + 1;
      const daysInMonth = differenceInDays(thisMonthEnd, thisMonthStart) + 1;

      // Fetch this month's revenues
      const { data: thisMonthRevenues } = await supabase
        .from("farm_revenues")
        .select("amount, source")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .gte("transaction_date", thisMonthStart.toISOString().split("T")[0])
        .lte("transaction_date", thisMonthEnd.toISOString().split("T")[0]);

      // Fetch last month's revenues
      const { data: lastMonthRevenues } = await supabase
        .from("farm_revenues")
        .select("amount")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .gte("transaction_date", lastMonthStart.toISOString().split("T")[0])
        .lte("transaction_date", lastMonthEnd.toISOString().split("T")[0]);

      // Fetch this month's expenses (operational only)
      const { data: thisMonthExpenses } = await supabase
        .from("farm_expenses")
        .select("amount, category, allocation_type")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .neq("allocation_type", "Personal")
        .gte("expense_date", thisMonthStart.toISOString().split("T")[0])
        .lte("expense_date", thisMonthEnd.toISOString().split("T")[0]);

      // Fetch last month's expenses
      const { data: lastMonthExpenses } = await supabase
        .from("farm_expenses")
        .select("amount, allocation_type")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .neq("allocation_type", "Personal")
        .gte("expense_date", lastMonthStart.toISOString().split("T")[0])
        .lte("expense_date", lastMonthEnd.toISOString().split("T")[0]);

      // Calculate totals
      const earnedThisMonth = thisMonthRevenues?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
      const earnedLastMonth = lastMonthRevenues?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
      const spentThisMonth = thisMonthExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const spentLastMonth = lastMonthExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      // Calculate trends
      const earnedChange = earnedLastMonth > 0 
        ? ((earnedThisMonth - earnedLastMonth) / earnedLastMonth) * 100 
        : 0;
      const spentChange = spentLastMonth > 0 
        ? ((spentThisMonth - spentLastMonth) / spentLastMonth) * 100 
        : 0;

      // Net and daily
      const netProfit = earnedThisMonth - spentThisMonth;
      const dailyProfit = daysPassed > 0 ? netProfit / daysPassed : 0;
      const isProfitable = netProfit >= 0;

      // Breakeven progress (how much of expenses are covered by revenue)
      const breakevenProgress = spentThisMonth > 0 
        ? (earnedThisMonth / spentThisMonth) * 100 
        : earnedThisMonth > 0 ? 100 : 0;

      // Determine status
      let status: 'excellent' | 'good' | 'warning' | 'critical';
      if (netProfit > 0 && breakevenProgress >= 120) {
        status = 'excellent';
      } else if (netProfit >= 0 && breakevenProgress >= 100) {
        status = 'good';
      } else if (breakevenProgress >= 70) {
        status = 'warning';
      } else {
        status = 'critical';
      }

      // Find top revenue source
      const revenueBySource: Record<string, number> = {};
      thisMonthRevenues?.forEach(r => {
        revenueBySource[r.source] = (revenueBySource[r.source] || 0) + Number(r.amount);
      });
      const topRevenueSource = Object.entries(revenueBySource)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

      // Find top expense category
      const expenseByCategory: Record<string, number> = {};
      thisMonthExpenses?.forEach(e => {
        expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + Number(e.amount);
      });
      const topExpenseCategory = Object.entries(expenseByCategory)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

      return {
        earnedThisMonth,
        spentThisMonth,
        netProfit,
        earnedChange,
        spentChange,
        dailyProfit,
        daysInMonth,
        daysPassed,
        isProfitable,
        status,
        breakevenProgress,
        topRevenueSource,
        topExpenseCategory,
      };
    },
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000,
  });
}
