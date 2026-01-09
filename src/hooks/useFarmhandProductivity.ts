import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, subDays, format } from "date-fns";

export interface FarmhandDailyStats {
  date: string;
  activitiesCount: number;
}

export interface FarmhandProductivity {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  role: string;
  todayCount: number;
  weekCount: number;
  lastActivityAt: string | null;
  dailyStats: FarmhandDailyStats[];
  isActive: boolean;
}

export function useFarmhandProductivity(farmId: string | null) {
  return useQuery<FarmhandProductivity[]>({
    queryKey: ["farmhand-productivity", farmId],
    queryFn: async () => {
      if (!farmId) throw new Error("Farm ID required");

      const today = new Date();
      const weekAgo = subDays(today, 7);
      const todayStr = format(today, 'yyyy-MM-dd');

      // Fetch memberships with profiles
      const { data: memberships } = await supabase
        .from("farm_memberships")
        .select(`
          user_id,
          role_in_farm,
          profiles!farm_memberships_user_id_fkey(
            full_name,
            avatar_url
          )
        `)
        .eq("farm_id", farmId)
        .not("user_id", "is", null);

      if (!memberships || memberships.length === 0) return [];

      const userIds = memberships.map(m => m.user_id!);

      // Fetch milking records for the week
      const { data: milkingRecords } = await supabase
        .from("milking_records")
        .select("created_by, record_date, created_at")
        .in("created_by", userIds)
        .gte("record_date", format(weekAgo, 'yyyy-MM-dd'))
        .lte("record_date", todayStr);

      // Fetch feeding records for the week
      const { data: feedingRecords } = await supabase
        .from("feeding_records")
        .select("created_by, record_datetime, created_at")
        .in("created_by", userIds)
        .gte("record_datetime", weekAgo.toISOString())
        .lte("record_datetime", endOfDay(today).toISOString());

      // Fetch health records for the week
      const { data: healthRecords } = await supabase
        .from("health_records")
        .select("created_by, visit_date, created_at")
        .in("created_by", userIds)
        .gte("visit_date", format(weekAgo, 'yyyy-MM-dd'))
        .lte("visit_date", todayStr);

      // Build productivity data for each farmhand
      const result: FarmhandProductivity[] = memberships.map(member => {
        const userId = member.user_id!;
        const profile = member.profiles as any;

        // Count today's activities
        const todayMilking = (milkingRecords || []).filter(
          r => r.created_by === userId && r.record_date === todayStr
        ).length;
        const todayFeeding = (feedingRecords || []).filter(
          r => r.created_by === userId && 
               format(new Date(r.record_datetime), 'yyyy-MM-dd') === todayStr
        ).length;
        const todayHealth = (healthRecords || []).filter(
          r => r.created_by === userId && r.visit_date === todayStr
        ).length;
        const todayCount = todayMilking + todayFeeding + todayHealth;

        // Count week's activities
        const weekMilking = (milkingRecords || []).filter(r => r.created_by === userId).length;
        const weekFeeding = (feedingRecords || []).filter(r => r.created_by === userId).length;
        const weekHealth = (healthRecords || []).filter(r => r.created_by === userId).length;
        const weekCount = weekMilking + weekFeeding + weekHealth;

        // Build daily stats for sparkline
        const dailyStats: FarmhandDailyStats[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = format(subDays(today, i), 'yyyy-MM-dd');
          const dayMilking = (milkingRecords || []).filter(
            r => r.created_by === userId && r.record_date === date
          ).length;
          const dayFeeding = (feedingRecords || []).filter(
            r => r.created_by === userId && 
                 format(new Date(r.record_datetime), 'yyyy-MM-dd') === date
          ).length;
          const dayHealth = (healthRecords || []).filter(
            r => r.created_by === userId && r.visit_date === date
          ).length;
          
          dailyStats.push({
            date,
            activitiesCount: dayMilking + dayFeeding + dayHealth
          });
        }

        // Get last activity timestamp
        const allTimes: number[] = [];
        (milkingRecords || []).forEach(r => {
          if (r.created_by === userId) allTimes.push(new Date(r.created_at).getTime());
        });
        (feedingRecords || []).forEach(r => {
          if (r.created_by === userId) allTimes.push(new Date(r.created_at).getTime());
        });
        (healthRecords || []).forEach(r => {
          if (r.created_by === userId) allTimes.push(new Date(r.created_at).getTime());
        });

        const lastActivityAt = allTimes.length > 0 
          ? new Date(Math.max(...allTimes)).toISOString()
          : null;

        // Determine if active today (has activity in last 4 hours)
        const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
        const isActive = lastActivityAt ? new Date(lastActivityAt).getTime() > fourHoursAgo : false;

        return {
          userId,
          userName: profile?.full_name || 'Unknown',
          avatarUrl: profile?.avatar_url || null,
          role: member.role_in_farm,
          todayCount,
          weekCount,
          lastActivityAt,
          dailyStats,
          isActive
        };
      });

      // Sort by today's activity count descending
      return result.sort((a, b) => b.todayCount - a.todayCount);
    },
    enabled: !!farmId,
    staleTime: 60000,
    refetchInterval: 120000
  });
}
