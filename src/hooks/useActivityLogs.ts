import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActivityLog {
  id: string;
  user_id: string;
  activity_type: string;
  activity_category: string;
  description: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, any>;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

interface UseActivityLogsParams {
  userId?: string;
  activityType?: string;
  activityCategory?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}

export const useActivityLogs = (params: UseActivityLogsParams = {}) => {
  return useQuery<ActivityLog[]>({
    queryKey: ["activity-logs", params],
    queryFn: async () => {
      let query = supabase
        .from("user_activity_logs")
        .select(`
          *,
          profiles!user_activity_logs_user_id_fkey(
            email,
            full_name
          )
        `)
        .order("created_at", { ascending: false });

      if (params.userId) {
        query = query.eq("user_id", params.userId);
      }

      if (params.activityType) {
        query = query.eq("activity_type", params.activityType);
      }

      if (params.activityCategory) {
        query = query.eq("activity_category", params.activityCategory);
      }

      if (params.dateFrom) {
        query = query.gte("created_at", params.dateFrom.toISOString());
      }

      if (params.dateTo) {
        query = query.lte("created_at", params.dateTo.toISOString());
      }

      if (params.limit) {
        query = query.limit(params.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform data to include user info
      return (data || []).map((log: any) => ({
        ...log,
        user_email: log.profiles?.email,
        user_name: log.profiles?.full_name,
      }));
    },
  });
};

// Hook to log custom activities
export const useLogActivity = () => {
  const logActivity = async (
    activityType: string,
    activityCategory: string,
    description: string,
    metadata: Record<string, any> = {}
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.rpc("log_user_activity", {
      _user_id: user.id,
      _activity_type: activityType,
      _activity_category: activityCategory,
      _description: description,
      _metadata: metadata,
    });

    if (error) {
      console.error("Failed to log activity:", error);
    }
  };

  return { logActivity };
};
