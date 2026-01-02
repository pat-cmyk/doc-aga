import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DashboardStats, DashboardStatsTrends } from "./useDashboardStats";
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
  const [trends, setTrends] = useState<DashboardStatsTrends | null>(null);
  const [combinedData, setCombinedData] = useState<CombinedDailyData[]>([]);
  const [monthlyHeadcount, setMonthlyHeadcount] = useState<MonthlyHeadcount[]>([]);
  const [stageKeys, setStageKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Self-healing: ensure farm stats exist for the requested period
      // This fills any gaps automatically (max 30 days backfill)
      try {
        await supabase.rpc('ensure_farm_stats', {
          p_farm_id: farmId,
          p_start_date: monthlyStartDate.toISOString().split('T')[0],
          p_end_date: endDate.toISOString().split('T')[0]
        });
      } catch (ensureErr) {
        // Non-critical - continue even if backfill fails
        console.warn("Stats backfill skipped:", ensureErr);
      }

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
            rawDate: date,
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

      // Fetch previous period data for trends (previous 30 days before current period)
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      const prevStartDate = new Date(prevEndDate);
      prevStartDate.setDate(prevStartDate.getDate() - daysDiff);

      // Fetch previous period stats
      const [prevAnimals, prevMilk, prevPregnant, prevHealth] = await Promise.all([
        // Previous animal count (animals that existed at prevEndDate)
        supabase
          .from("animals")
          .select("*", { count: "exact", head: true })
          .eq("farm_id", farmId)
          .eq("is_deleted", false)
          .lte("created_at", prevEndDate.toISOString()),
        
        // Previous avg milk
        supabase
          .from("daily_farm_stats")
          .select("total_milk_liters")
          .eq("farm_id", farmId)
          .gte("stat_date", prevStartDate.toISOString().split("T")[0])
          .lte("stat_date", prevEndDate.toISOString().split("T")[0]),
        
        // Previous pregnant count
        supabase
          .from("ai_records")
          .select("animal_id, animals!inner(farm_id), confirmed_at")
          .eq("animals.farm_id", farmId)
          .eq("pregnancy_confirmed", true)
          .lte("confirmed_at", prevEndDate.toISOString()),
        
        // Previous health events
        supabase
          .from("health_records")
          .select("*, animals!inner(farm_id)", { count: "exact", head: true })
          .eq("animals.farm_id", farmId)
          .gte("visit_date", prevStartDate.toISOString().split("T")[0])
          .lte("visit_date", prevEndDate.toISOString().split("T")[0])
      ]);

      const prevAvgMilk = prevMilk.data && prevMilk.data.length > 0
        ? prevMilk.data.reduce((sum, s) => sum + Number(s.total_milk_liters || 0), 0) / prevMilk.data.length
        : 0;

      setTrends({
        prevTotalAnimals: prevAnimals.count || 0,
        prevAvgDailyMilk: prevAvgMilk,
        prevPregnantCount: prevPregnant.data?.length || 0,
        prevHealthEvents: prevHealth.count || 0
      });

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

  return { stats, trends, combinedData, monthlyHeadcount, stageKeys, loading, error, reload: loadData };
};
