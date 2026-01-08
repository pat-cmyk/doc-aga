import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  getCachedDashboardStats,
  updateDashboardStatsCache,
  isDashboardCacheFresh,
  type DashboardStatsCache,
} from "@/lib/dataCache";
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
 * Offline-first hook that fetches all dashboard data
 * 
 * Strategy:
 * 1. Read from IndexedDB cache immediately for instant display
 * 2. If online, fetch from server in background
 * 3. Merge server data with local pending records
 * 4. Update IndexedDB with merged result
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
  const isOnline = useOnlineStatus();

  // Convert cached dailyMilk to chart-compatible format
  const buildCombinedDataFromCache = useCallback((
    cachedDailyMilk: Record<string, number>,
    cachedStageCounts: Record<string, number>
  ): CombinedDailyData[] => {
    return dateArray.map(date => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      rawDate: date,
      milkTotal: cachedDailyMilk[date] || 0,
      ...cachedStageCounts, // Spread stage counts as properties
    }));
  }, [dateArray]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // ========== STEP 1: Read from IndexedDB cache immediately ==========
      const cachedStats = await getCachedDashboardStats(farmId);
      
      if (cachedStats) {
        console.log('[Dashboard] Showing cached data immediately');
        setStats(cachedStats.stats);
        setCombinedData(buildCombinedDataFromCache(cachedStats.dailyMilk, cachedStats.stageCounts));
        // Cast monthlyData to MonthlyHeadcount[] since the structure matches
        setMonthlyHeadcount(cachedStats.monthlyData as MonthlyHeadcount[]);
        setStageKeys(cachedStats.stageKeys);
        setLoading(false); // Show cached data immediately
      }

      // ========== STEP 2: Check if we need to fetch from server ==========
      const cacheIsFresh = await isDashboardCacheFresh(farmId);
      
      if (!isOnline) {
        // Offline: use cache only
        if (!cachedStats) {
          setError(new Error("No cached data available offline"));
        }
        setLoading(false);
        return;
      }

      // If cache is fresh and we have data, skip server fetch (but data is already displayed from step 1)
      if (cacheIsFresh && cachedStats) {
        console.log('[Dashboard] Cache is fresh, skipping server fetch');
        return; // Already set loading=false above when showing cached data
      }

      // ========== STEP 3: Fetch from server in background ==========
      console.log('[Dashboard] Fetching fresh data from server...');

      // Self-healing: ensure farm stats exist for the requested period
      try {
        await supabase.rpc('ensure_farm_stats', {
          p_farm_id: farmId,
          p_start_date: monthlyStartDate.toISOString().split('T')[0],
          p_end_date: endDate.toISOString().split('T')[0]
        });
      } catch (ensureErr) {
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
        const result = data as unknown as CombinedDashboardData;
        
        // Process server stats
        const serverStats = result.stats || {
          totalAnimals: 0,
          avgDailyMilk: 0,
          pregnantCount: 0,
          pendingConfirmation: 0,
          recentHealthEvents: 0
        };

        // Process server daily data into dailyMilk map
        const serverDailyMilk: Record<string, number> = {};
        const serverStageCounts: Record<string, number> = {};
        
        (result.dailyData || []).forEach((item: any) => {
          const date = item.date;
          serverDailyMilk[date] = Number(item.milkTotal || 0);
          
          // Aggregate stage counts
          const stageCounts = item.stageCounts || {};
          Object.entries(stageCounts).forEach(([stage, count]) => {
            serverStageCounts[stage] = (serverStageCounts[stage] || 0) + (count as number);
          });
        });

        // ========== STEP 4: Merge server with local pending data ==========
        // For today's date, prefer local cache if it has pending data (higher value wins)
        const today = new Date().toISOString().split('T')[0];
        const mergedDailyMilk = { ...serverDailyMilk };
        
        if (cachedStats?.dailyMilk[today] && cachedStats.syncStatus === 'pending') {
          // Use MAX of server and local for today (handles both online adds and offline queued)
          mergedDailyMilk[today] = Math.max(
            serverDailyMilk[today] || 0,
            cachedStats.dailyMilk[today] || 0
          );
        }

        // Build combined data for charts
        const dailyDataMap: Record<string, CombinedDailyData> = {};
        dateArray.forEach(date => {
          dailyDataMap[date] = {
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            rawDate: date,
            milkTotal: mergedDailyMilk[date] || 0,
          };
        });

        // Add stage counts to daily data
        (result.dailyData || []).forEach((item: any) => {
          const date = item.date;
          if (dailyDataMap[date]) {
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

        const processedMonthlyData = sortedMonths.map(month => monthlyMap[month]);
        
        setStats(serverStats);
        setMonthlyHeadcount(processedMonthlyData as MonthlyHeadcount[]);
        setStageKeys(result.stageKeys || []);

        // ========== STEP 5: Update IndexedDB with merged data ==========
        await updateDashboardStatsCache(farmId, {
          stats: serverStats,
          dailyMilk: mergedDailyMilk,
          stageCounts: serverStageCounts,
          monthlyData: processedMonthlyData,
          stageKeys: result.stageKeys || [],
        });
      }

      // Fetch previous period data for trends
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      const prevStartDate = new Date(prevEndDate);
      prevStartDate.setDate(prevStartDate.getDate() - daysDiff);

      const [prevAnimals, prevMilk, prevPregnant, prevHealth] = await Promise.all([
        supabase
          .from("animals")
          .select("*", { count: "exact", head: true })
          .eq("farm_id", farmId)
          .eq("is_deleted", false)
          .lte("created_at", prevEndDate.toISOString()),
        
        supabase
          .from("daily_farm_stats")
          .select("total_milk_liters")
          .eq("farm_id", farmId)
          .gte("stat_date", prevStartDate.toISOString().split("T")[0])
          .lte("stat_date", prevEndDate.toISOString().split("T")[0]),
        
        supabase
          .from("ai_records")
          .select("animal_id, animals!inner(farm_id), confirmed_at")
          .eq("animals.farm_id", farmId)
          .eq("pregnancy_confirmed", true)
          .lte("confirmed_at", prevEndDate.toISOString()),
        
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
      // Only set error if we have no cached data
      const cachedStats = await getCachedDashboardStats(farmId);
      if (!cachedStats) {
        setError(err instanceof Error ? err : new Error("Failed to load dashboard data"));
      }
    } finally {
      setLoading(false);
    }
  }, [farmId, startDate, endDate, monthlyStartDate, monthlyEndDate, dateArray, isOnline, buildCombinedDataFromCache]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { stats, trends, combinedData, monthlyHeadcount, stageKeys, loading, error, reload: loadData };
};
