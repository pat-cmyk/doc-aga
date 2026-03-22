import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import type { AuditReportData } from "@/types/auditReport";

export const useAuditReport = (
  farmId: string | undefined,
  startDate: Date,
  endDate: Date,
  enabled: boolean
) => {
  return useQuery<AuditReportData>({
    queryKey: [
      "audit-report",
      farmId,
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
    ],
    enabled: enabled && !!farmId,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_farm_audit_report", {
        p_farm_id: farmId!,
        p_start_date: format(startDate, "yyyy-MM-dd"),
        p_end_date: format(endDate, "yyyy-MM-dd"),
      });

      if (error) throw error;
      return data as unknown as AuditReportData;
    },
  });
};
