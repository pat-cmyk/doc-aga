import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DashboardStats } from "./useDashboardStats";
import type { CombinedDailyData } from "./useMilkData";
import type { MonthlyHeadcount } from "./useHeadcountData";

interface CombinedDashboardData {
  stats: DashboardStats;
  dailyData: Array<{
    date: string;
    milkTotal: number;
    stageCounts: Record<string, number>;
  }>;
  monthlyData: Array<{
    monthDate: string;
    stageCounts: Record<string, number>;
  }>;
  stageKeys: string[];
}

/**
 * Optimized hook that fetches all dashboard data in a single RPC call
 * Reduces waterfall queries from 10+ to 1 for FarmDashboard
 */
export const useCombinedDashboardData = (
  farmId: string,
  startDate: Date,
  endDate: Date,
  monthlyStartDate: Date,
  monthlyEndDate: Date,
  dateArray: string[]
) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalAnimals: 0,
    avgDailyMilk: 0,
    pregnantCount: 0,
    pendingConfirmation: 0,
    recentHealthEvents: 0
  });
  const [combinedData, setCombinedData] = useState<CombinedDailyData[]>([]);
  const [monthlyHeadcount, setMonthlyHeadcount] = useState<MonthlyHeadcount[]>([]);
  const [stageKeys, setStageKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_combined_dashboard_data', {
        p_farm_id: farmId,
        p_start_date: startDate.toISOString().split('T')[0],
        p_end_date: endDate.toISOString().split('T')[0],
        p_monthly_start_date: monthlyStartDate.toISOString().split('T')[0],
        p_monthly_end_date: monthlyEndDate.toISOString().split('T')[0]
      });

      if (rpcError) throw rpcError;

      if (data) {
        // Cast the RPC result to the expected type (via unknown to satisfy TypeScript)
        const result = data as unknown as CombinedDashboardData;
        
        // Process stats
        setStats(result.stats || {
          totalAnimals: 0,
          avgDailyMilk: 0,
          pregnantCount: 0,
          pendingConfirmation: 0,
          recentHealthEvents: 0
        });

        // Process daily data
        const dailyDataMap: Record<string, CombinedDailyData> = {};
        dateArray.forEach(date => {
          dailyDataMap[date] = {
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            milkTotal: 0
          };
        });

        (result.dailyData || []).forEach((item: any) => {
          const date = item.date;
          if (dailyDataMap[date]) {
            dailyDataMap[date].milkTotal = Number(item.milkTotal || 0);
            const stageCounts = item.stageCounts || {};
            Object.entries(stageCounts).forEach(([stage, count]) => {
              dailyDataMap[date][stage] = count as number;
            });
          }
        });

        setCombinedData(dateArray.map(date => dailyDataMap[date]));

        // Process monthly data
        const monthlyMap: Record<string, MonthlyHeadcount> = {};
        (result.monthlyData || []).forEach((item: any) => {
          const statDate = new Date(item.monthDate);
          const monthKey = statDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          
          if (!monthlyMap[monthKey]) {
            monthlyMap[monthKey] = { month: monthKey };
          }

          const stageCounts = item.stageCounts || {};
          Object.entries(stageCounts).forEach(([stage, count]) => {
            monthlyMap[monthKey][stage] = count as number;
          });
        });

        const sortedMonths = Object.keys(monthlyMap).sort((a, b) => {
          return new Date(a).getTime() - new Date(b).getTime();
        });

        setMonthlyHeadcount(sortedMonths.map(month => monthlyMap[month]));
        setStageKeys(result.stageKeys || []);
      }
    } catch (err) {
      console.error("Error loading combined dashboard data:", err);
      setError(err instanceof Error ? err : new Error("Failed to load dashboard data"));
    } finally {
      setLoading(false);
    }
  }, [farmId, startDate, endDate, monthlyStartDate, monthlyEndDate, dateArray]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { stats, combinedData, monthlyHeadcount, stageKeys, loading, error, reload: loadData };
};
