import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditLogEntry {
  id: string;
  user_id: string;
  access_type: string;
  records_accessed: number;
  regions_accessed: string[];
  user_role: string | null;
  metadata: Record<string, unknown> | null;
  accessed_at: string;
}

export const useGovAnalyticsAuditLog = (limit: number = 100) => {
  return useQuery({
    queryKey: ["gov-analytics-audit-log", limit],
    queryFn: async () => {
      // Use raw query since types haven't been regenerated yet
      const { data, error } = await supabase
        .from("gov_analytics_access_audit_log" as "gov_farm_analytics")
        .select("*")
        .order("accessed_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as unknown as AuditLogEntry[];
    },
    staleTime: 1000 * 60 * 1, // 1 minute
  });
};
