/**
 * @online-only — Admin-facing query of recent abandoned voice attempts.
 * Reads through SECURITY DEFINER RPC `get_recent_abandoned_voice_attempts`.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";

export interface AbandonedVoiceAttempt {
  id: string;
  record_type: string;
  transcript_preview: string | null;
  parsed_fields: Record<string, unknown> | null;
  outcome: "cancelled" | "timeout";
  cancel_reason: string | null;
  followed_by_manual_within_5m: boolean;
  started_at: string;
  ended_at: string | null;
  user_display_name: string;
  farm_name: string | null;
}

export interface AbandonedVoiceAttemptsResponse {
  rows: AbandonedVoiceAttempt[];
}

export function useAbandonedVoiceAttempts(limit = 20, daysBack = 30) {
  return useQuery({
    queryKey: ["abandoned-voice-attempts", limit, daysBack],
    queryFn: async () => {
      const startDate = subDays(new Date(), daysBack).toISOString().split("T")[0];
      const { data, error } = await supabase.rpc(
        // @ts-expect-error — new RPC not yet in generated types
        "get_recent_abandoned_voice_attempts",
        { _limit: limit, _start_date: startDate },
      );
      if (error) throw error;
      return data as unknown as AbandonedVoiceAttemptsResponse;
    },
    staleTime: 1000 * 60 * 2,
  });
}
