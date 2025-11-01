import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CombinedDailyData {
  date: string;
  milkTotal: number;
  [key: string]: string | number;
}

/**
 * Hook to fetch and manage daily milk production data with animal stage counts
 * Uses pre-calculated stats when available, falls back to real-time calculation
 */
export const useMilkData = (
  farmId: string,
  startDate: Date,
  endDate: Date,
  dateArray: string[]
) => {
  const [combinedData, setCombinedData] = useState<CombinedDailyData[]>([]);
  const [stageKeys, setStageKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMilkData = useCallback(async () => {
    setLoading(true);
    try {

      // Fetch pre-aggregated data from daily_farm_stats
      const { data: dailyStats } = await supabase
        .from("daily_farm_stats")
        .select("*")
        .eq("farm_id", farmId)
        .gte("stat_date", startDate.toISOString().split("T")[0])
        .lte("stat_date", endDate.toISOString().split("T")[0])
        .order("stat_date", { ascending: true });

      const combinedDataMap: Record<string, CombinedDailyData> = {};
      const allStageKeys = new Set<string>();

      // Initialize data structure
      dateArray.forEach(date => {
        combinedDataMap[date] = {
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          milkTotal: 0
        };
      });

      if (dailyStats && dailyStats.length > 0) {
        // Use pre-calculated data
        dailyStats.forEach(stat => {
          const date = stat.stat_date;
          if (combinedDataMap[date]) {
            combinedDataMap[date].milkTotal = Number(stat.total_milk_liters);
            
            const stageCounts = stat.stage_counts as Record<string, number>;
            Object.entries(stageCounts).forEach(([stage, count]) => {
              combinedDataMap[date][stage] = count;
              allStageKeys.add(stage);
            });
          }
        });
      } else {
        // Fallback: Calculate from milking_records
        if (process.env.NODE_ENV === 'development') {
          console.log("No pre-calculated stats found, using fallback calculation");
        }
        
        const { data: milkRecords } = await supabase
          .from("milking_records")
          .select("liters, record_date, animals!inner(farm_id)")
          .eq("animals.farm_id", farmId)
          .gte("record_date", startDate.toISOString().split("T")[0])
          .lte("record_date", endDate.toISOString().split("T")[0]);

        milkRecords?.forEach(record => {
          const date = record.record_date;
          if (combinedDataMap[date]) {
            combinedDataMap[date].milkTotal += Number(record.liters);
          }
        });
      }

      const finalData = dateArray.map(date => combinedDataMap[date]);
      setCombinedData(finalData);
      setStageKeys(Array.from(allStageKeys));
    } catch (error) {
      console.error("Error loading milk data:", error);
    } finally {
      setLoading(false);
    }
  }, [farmId, startDate, endDate, dateArray]);

  useEffect(() => {
    loadMilkData();
  }, [loadMilkData]);

  return { combinedData, stageKeys, loading, reload: loadMilkData };
};
