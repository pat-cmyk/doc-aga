/**
 * @online-only — Admin-level error monitoring (cross-farm, super-admin RPCs).
 * Must NOT cache locally (RLS boundary) — same rule as useSystemHealth.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { showErrorToastLegacy } from "@/lib/errorHandling";
import { reportSilentError } from "@/lib/errorMonitor";

export type ErrorLogStatus = "new" | "investigating" | "resolved" | "ignored";
export type ErrorLogSeverity = "toast" | "crash" | "silent" | "server";

export interface ErrorLogGroup {
  id: string;
  fingerprint: string;
  severity: ErrorLogSeverity;
  message: string;
  stack: string | null;
  translated_title: string | null;
  context: Record<string, unknown>;
  user_id: string | null;
  farm_id: string | null;
  farm_name: string | null;
  affected_user_count: number;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  status: ErrorLogStatus;
  linked_ticket_id: string | null;
  linked_ticket_number: string | null;
}

export interface ErrorMonitoringSummary {
  counts: {
    new: number;
    investigating: number;
    crashes_24h: number;
    total_24h: number;
  };
  groups: ErrorLogGroup[];
  last_updated: string;
}

// types.ts is Lovable-generated and stale until regeneration; narrow typed
// cast for the new error-monitoring RPCs only (per CLAUDE.md — no `as any`).
type ErrorAdminRpc = (
  fn: "get_error_monitoring_summary" | "update_error_log_status" | "set_error_log_ticket",
  params?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: ErrorAdminRpc = (fn, params) =>
  (supabase.rpc as unknown as ErrorAdminRpc)(fn, params);

export function useErrorLogs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: summary, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-error-logs"],
    queryFn: async () => {
      const { data, error } = await rpc("get_error_monitoring_summary");
      if (error) {
        reportSilentError(error, "error monitoring summary query");
        throw new Error(error.message);
      }
      return data as unknown as ErrorMonitoringSummary;
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ErrorLogStatus }) => {
      const { error } = await rpc("update_error_log_status", { _id: id, _status: status });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-error-logs"] });
    },
    // Intentional: showErrorToastLegacy routes through translateError → captureError,
    // so failed admin mutations appear in the error log themselves.
    onError: (err: Error) => {
      showErrorToastLegacy(toast, err, "updating error status");
    },
  });

  const linkTicket = useMutation({
    mutationFn: async ({ id, ticketId }: { id: string; ticketId: string }) => {
      const { error } = await rpc("set_error_log_ticket", { _id: id, _ticket_id: ticketId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-error-logs"] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    // Intentional: showErrorToastLegacy routes through translateError → captureError,
    // so failed admin mutations appear in the error log themselves.
    onError: (err: Error) => {
      showErrorToastLegacy(toast, err, "linking ticket");
    },
  });

  return {
    summary,
    groups: summary?.groups ?? [],
    counts: summary?.counts ?? { new: 0, investigating: 0, crashes_24h: 0, total_24h: 0 },
    isLoading,
    error,
    refetch,
    updateStatus,
    linkTicket,
  };
}
