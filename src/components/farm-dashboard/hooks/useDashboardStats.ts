import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getLactatingAnimalsOrFilter } from "@/lib/animalQueries";

/**
 * Dashboard statistics including animal counts, milk production, and health events
 */
export interface DashboardStats {
  totalAnimals: number;
  lactatingCount: number;
  avgDailyMilk: number;
  pregnantCount: number;
  pendingConfirmation: number;
  recentHealthEvents: number;
}

export interface DashboardStatsTrends {
  prevTotalAnimals: number;
  prevAvgDailyMilk: number;
  prevPregnantCount: number;
  prevHealthEvents: number;
}

/**
 * Hook to load and manage farm dashboard statistics
 * Fetches total animals, milk production, pregnancy status, and health events
 */
export const useDashboardStats = (farmId: string, startDate: Date, endDate: Date) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalAnimals: 0,
    lactatingCount: 0,
    avgDailyMilk: 0,
    pregnantCount: 0,
    pendingConfirmation: 0,
    recentHealthEvents: 0
  });
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      // Get total animals
      const { count: animalCount } = await supabase
        .from("animals")
        .select("*", { count: "exact", head: true })
        .eq("farm_id", farmId)
        .eq("is_deleted", false);

      // Get lactating animals count
      const { count: lactatingCount } = await supabase
        .from("animals")
        .select("*", { count: "exact", head: true })
        .eq("farm_id", farmId)
        .eq("gender", "Female")
        .is("exit_date", null)
        .eq("is_deleted", false)
        .or(getLactatingAnimalsOrFilter());

      // Get average daily milk - prefer pre-aggregated stats
      const { data: dailyStats } = await supabase
        .from("daily_farm_stats")
        .select("total_milk_liters, stat_date")
        .eq("farm_id", farmId)
        .gte("stat_date", startDate.toISOString().split("T")[0])
        .lte("stat_date", endDate.toISOString().split("T")[0]);

      let avgMilk = 0;
      if (dailyStats && dailyStats.length > 0) {
        const totalMilk = dailyStats.reduce((sum, stat) => sum + Number(stat.total_milk_liters || 0), 0);
        avgMilk = totalMilk / dailyStats.length;
      } else {
        // Fallback to milking_records if no pre-aggregated stats
        const { data: milkingData } = await supabase
          .from("milking_records")
          .select("liters, animals!inner(farm_id)")
          .eq("animals.farm_id", farmId)
          .gte("record_date", startDate.toISOString().split("T")[0])
          .lte("record_date", endDate.toISOString().split("T")[0]);

        avgMilk = milkingData && milkingData.length > 0
          ? milkingData.reduce((sum, r) => sum + Number(r.liters), 0) / milkingData.length
          : 0;
      }

      // Get pregnant animals
      const { data: pregnancyData } = await supabase
        .from("ai_records")
        .select("animal_id, animals!inner(farm_id)")
        .eq("animals.farm_id", farmId)
        .eq("pregnancy_confirmed", true);

      // Get AI performed but pending confirmation
      const { data: pendingAI } = await supabase
        .from("ai_records")
        .select("animal_id, animals!inner(farm_id)")
        .eq("animals.farm_id", farmId)
        .eq("pregnancy_confirmed", false)
        .not("performed_date", "is", null);

      // Get recent health events
      const { count: healthCount } = await supabase
        .from("health_records")
        .select("*, animals!inner(farm_id)", { count: "exact", head: true })
        .eq("animals.farm_id", farmId)
        .gte("visit_date", startDate.toISOString().split("T")[0]);

      setStats({
        totalAnimals: animalCount || 0,
        lactatingCount: lactatingCount || 0,
        avgDailyMilk: avgMilk,
        pregnantCount: pregnancyData?.length || 0,
        pendingConfirmation: pendingAI?.length || 0,
        recentHealthEvents: healthCount || 0
      });
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  }, [farmId, startDate, endDate]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return { stats, loading, reload: loadStats };
};