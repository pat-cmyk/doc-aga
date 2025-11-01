import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MonthlyHeadcount {
  month: string;
  [key: string]: string | number;
}

/**
 * Hook to fetch and manage monthly animal headcount by stage
 * Uses pre-calculated monthly stats when available
 */
export const useHeadcountData = (
  farmId: string,
  monthlyStartDate: Date,
  monthlyEndDate: Date,
  stageKeysArray: string[]
) => {
  const [monthlyHeadcount, setMonthlyHeadcount] = useState<MonthlyHeadcount[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHeadcountData = useCallback(async () => {
    setLoading(true);
    try {

      // Fetch pre-aggregated monthly stats
      const { data: monthlyStats } = await supabase
        .from("monthly_farm_stats")
        .select("*")
        .eq("farm_id", farmId)
        .gte("month_date", monthlyStartDate.toISOString().split("T")[0])
        .lte("month_date", monthlyEndDate.toISOString().split("T")[0])
        .order("month_date", { ascending: true });

      const monthlyMap: Record<string, MonthlyHeadcount> = {};

      if (monthlyStats && monthlyStats.length > 0) {
        monthlyStats.forEach(stat => {
          const statDate = new Date(stat.month_date);
          const monthKey = statDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          
          if (!monthlyMap[monthKey]) {
            monthlyMap[monthKey] = { month: monthKey };
            stageKeysArray.forEach(stage => {
              monthlyMap[monthKey][stage] = 0;
            });
          }

          const stageCounts = stat.stage_counts as Record<string, number>;
          Object.entries(stageCounts).forEach(([stage, count]) => {
            monthlyMap[monthKey][stage] = count;
          });
        });
      } else {
        // Fallback: aggregate from daily_farm_stats
        if (process.env.NODE_ENV === 'development') {
          console.log("No monthly stats found, aggregating from daily stats");
        }

        const { data: dailyStats } = await supabase
          .from("daily_farm_stats")
          .select("*")
          .eq("farm_id", farmId)
          .gte("stat_date", monthlyStartDate.toISOString().split("T")[0])
          .lte("stat_date", monthlyEndDate.toISOString().split("T")[0])
          .order("stat_date", { ascending: true });

        if (dailyStats && dailyStats.length > 0) {
          // Group daily stats by month
          const monthlyGroups: Record<string, Array<Record<string, number>>> = {};
          
          dailyStats.forEach(stat => {
            const statDate = new Date(stat.stat_date);
            const monthKey = statDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            
            if (!monthlyGroups[monthKey]) {
              monthlyGroups[monthKey] = [];
            }
            
            const stageCounts = stat.stage_counts as Record<string, number>;
            monthlyGroups[monthKey].push(stageCounts);
          });
          
          // Use last day's counts as representative of each month
          Object.keys(monthlyGroups).forEach(monthKey => {
            if (!monthlyMap[monthKey]) {
              monthlyMap[monthKey] = { month: monthKey };
              stageKeysArray.forEach(stage => {
                monthlyMap[monthKey][stage] = 0;
              });
            }
            
            // Use the last day's counts for the month
            const lastDayCounts = monthlyGroups[monthKey][monthlyGroups[monthKey].length - 1];
            Object.entries(lastDayCounts).forEach(([stage, count]) => {
              monthlyMap[monthKey][stage] = count;
            });
          });
        }
      }

      const sortedMonths = Object.keys(monthlyMap).sort((a, b) => {
        return new Date(a).getTime() - new Date(b).getTime();
      });

      setMonthlyHeadcount(sortedMonths.map(month => monthlyMap[month]));
    } catch (error) {
      console.error("Error loading headcount data:", error);
    } finally {
      setLoading(false);
    }
  }, [farmId, monthlyStartDate, monthlyEndDate, stageKeysArray]);

  useEffect(() => {
    loadHeadcountData();
  }, [loadHeadcountData]);

  return { monthlyHeadcount, loading, reload: loadHeadcountData };
};
