import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface Notification {
  id: string;
  user_id: string;
  farm_id: string | null;
  type: string;
  title: string | null;
  body: string | null;
  read: boolean;
  created_at: string;
}

interface UseNotificationsOptions {
  /** Show all notifications (for admin/government users) */
  showAll?: boolean;
}

export const useNotifications = (farmId?: string | null, options?: UseNotificationsOptions) => {
  const queryClient = useQueryClient();
  const { showAll = false } = options || {};

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", farmId, showAll],
    queryFn: async () => {
      let query = supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });

      // If not showing all notifications, filter by farm
      if (!showAll && farmId) {
        // Show notifications for this farm OR global notifications (null farm_id)
        query = query.or(`farm_id.eq.${farmId},farm_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Notification[];
    },
  });

  // Subscribe to realtime notifications
  useEffect(() => {
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  return {
    notifications: notifications || [],
    isLoading,
    unreadCount,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    clearAll: clearAllMutation.mutate,
  };
};
