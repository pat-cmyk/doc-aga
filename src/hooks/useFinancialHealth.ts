import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, subDays, format } from "date-fns";

export interface FinancialHealthData {
  // Core metrics
  earnedThisMonth: number;
  spentThisMonth: number;
  netProfit: number;
  
  // Trends
  earnedChange: number; // percentage change from previous period
  spentChange: number;
  
  // Daily metrics
  dailyProfit: number;
  daysInPeriod: number;
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

interface DateRange {
  start: Date;
  end: Date;
}

export function useFinancialHealth(farmId: string, dateRange?: DateRange) {
  return useQuery({
    queryKey: ["financial-health", farmId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async (): Promise<FinancialHealthData> => {
      const now = new Date();
      
      // Use provided date range or default to current month logic
      const periodStart = dateRange?.start || now;
      const periodEnd = dateRange?.end || now;
      
      // Calculate the period length in days
      const periodLengthDays = differenceInDays(periodEnd, periodStart) + 1;
      
      // Calculate comparison period (same length, immediately before)
      const comparisonEnd = subDays(periodStart, 1);
      const comparisonStart = subDays(comparisonEnd, periodLengthDays - 1);
      
      // Days passed calculation - if period end is in the future, use today
      const effectiveEnd = periodEnd > now ? now : periodEnd;
      const daysPassed = Math.max(1, differenceInDays(effectiveEnd, periodStart) + 1);

      const periodStartStr = format(periodStart, "yyyy-MM-dd");
      const periodEndStr = format(periodEnd, "yyyy-MM-dd");
      const comparisonStartStr = format(comparisonStart, "yyyy-MM-dd");
      const comparisonEndStr = format(comparisonEnd, "yyyy-MM-dd");

      // Fetch current period revenues
      const { data: currentRevenues } = await supabase
        .from("farm_revenues")
        .select("amount, source")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .gte("transaction_date", periodStartStr)
        .lte("transaction_date", periodEndStr);

      // Fetch comparison period revenues
      const { data: comparisonRevenues } = await supabase
        .from("farm_revenues")
        .select("amount")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .gte("transaction_date", comparisonStartStr)
        .lte("transaction_date", comparisonEndStr);

      // Fetch current period expenses (operational only)
      const { data: currentExpenses } = await supabase
        .from("farm_expenses")
        .select("amount, category, allocation_type")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .neq("allocation_type", "Personal")
        .gte("expense_date", periodStartStr)
        .lte("expense_date", periodEndStr);

      // Fetch comparison period expenses
      const { data: comparisonExpenses } = await supabase
        .from("farm_expenses")
        .select("amount, allocation_type")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .neq("allocation_type", "Personal")
        .gte("expense_date", comparisonStartStr)
        .lte("expense_date", comparisonEndStr);

      // Calculate totals
      const earnedThisMonth = currentRevenues?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
      const earnedLastPeriod = comparisonRevenues?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
      const spentThisMonth = currentExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const spentLastPeriod = comparisonExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      // Calculate trends
      const earnedChange = earnedLastPeriod > 0 
        ? ((earnedThisMonth - earnedLastPeriod) / earnedLastPeriod) * 100 
        : 0;
      const spentChange = spentLastPeriod > 0 
        ? ((spentThisMonth - spentLastPeriod) / spentLastPeriod) * 100 
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
      currentRevenues?.forEach(r => {
        revenueBySource[r.source] = (revenueBySource[r.source] || 0) + Number(r.amount);
      });
      const topRevenueSource = Object.entries(revenueBySource)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

      // Find top expense category
      const expenseByCategory: Record<string, number> = {};
      currentExpenses?.forEach(e => {
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
        daysInPeriod: periodLengthDays,
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
