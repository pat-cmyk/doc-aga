import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CombinedDailyData {
  date: string;
  rawDate: string; // YYYY-MM-DD format for click handling
  milkTotal: number;
  prevDayMilk?: number;
  animalsCount?: number;
  revenue?: number;
  [key: string]: string | number | undefined;
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
  const [averageMilk, setAverageMilk] = useState(0);

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

      // Fetch animal counts and revenue per day from milking_records
      const { data: milkDetails } = await supabase
        .from("milking_records")
        .select("record_date, animal_id, liters, is_sold, sale_amount, animals!inner(farm_id)")
        .eq("animals.farm_id", farmId)
        .gte("record_date", startDate.toISOString().split("T")[0])
        .lte("record_date", endDate.toISOString().split("T")[0]);

      // Aggregate animal counts and revenue by date
      const detailsByDate: Record<string, { animals: Set<string>; revenue: number; milkTotal: number }> = {};
      milkDetails?.forEach((record: any) => {
        const date = record.record_date;
        if (!detailsByDate[date]) {
          detailsByDate[date] = { animals: new Set(), revenue: 0, milkTotal: 0 };
        }
        detailsByDate[date].animals.add(record.animal_id);
        detailsByDate[date].milkTotal += Number(record.liters);
        if (record.is_sold && record.sale_amount) {
          detailsByDate[date].revenue += Number(record.sale_amount);
        }
      });

      const combinedDataMap: Record<string, CombinedDailyData> = {};
      const allStageKeys = new Set<string>();
      const datesWithStats = new Set<string>();

      // Initialize data structure
      dateArray.forEach(date => {
        combinedDataMap[date] = {
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          rawDate: date,
          milkTotal: 0,
          animalsCount: detailsByDate[date]?.animals.size || 0,
          revenue: detailsByDate[date]?.revenue || 0,
        };
      });

      // Apply pre-calculated stats where available
      if (dailyStats && dailyStats.length > 0) {
        dailyStats.forEach(stat => {
          const date = stat.stat_date;
          if (combinedDataMap[date]) {
            combinedDataMap[date].milkTotal = Number(stat.total_milk_liters);
            datesWithStats.add(date);
            
            const stageCounts = stat.stage_counts as Record<string, number>;
            Object.entries(stageCounts).forEach(([stage, count]) => {
              combinedDataMap[date][stage] = count;
              allStageKeys.add(stage);
            });
          }
        });
      }

      // Find dates missing from daily_farm_stats (typically today/recent days)
      const missingDates = dateArray.filter(date => !datesWithStats.has(date));
      
      if (missingDates.length > 0) {
        // Use the detailed milk records we already fetched
        missingDates.forEach(date => {
          if (detailsByDate[date]) {
            combinedDataMap[date].milkTotal = detailsByDate[date].milkTotal;
          }
        });
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`Fetched real-time milk data for ${missingDates.length} missing dates`);
        }
      }

      // Calculate previous day milk for comparison
      const sortedDates = [...dateArray].sort();
      sortedDates.forEach((date, index) => {
        if (index > 0) {
          const prevDate = sortedDates[index - 1];
          combinedDataMap[date].prevDayMilk = combinedDataMap[prevDate]?.milkTotal || 0;
        }
      });

      const finalData = dateArray.map(date => combinedDataMap[date]);
      
      // Calculate average
      const totalMilk = finalData.reduce((sum, d) => sum + (d.milkTotal || 0), 0);
      const daysWithMilk = finalData.filter(d => (d.milkTotal || 0) > 0).length;
      const avg = daysWithMilk > 0 ? totalMilk / daysWithMilk : 0;
      
      setCombinedData(finalData);
      setStageKeys(Array.from(allStageKeys));
      setAverageMilk(avg);
    } catch (error) {
      console.error("Error loading milk data:", error);
    } finally {
      setLoading(false);
    }
  }, [farmId, startDate, endDate, dateArray]);

  useEffect(() => {
    loadMilkData();
  }, [loadMilkData]);

  return { combinedData, stageKeys, loading, averageMilk, reload: loadMilkData };
};
