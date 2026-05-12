/**
 * @online-only — Admin-facing query of per-farmhand voice usage health for one farm.
 * Reads through SECURITY DEFINER RPC `get_voice_health_by_farm`.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";

export interface VoiceHealthRow {
  user_id: string;
  display_name: string;
  email: string | null;
  attempts_total: number;
  committed_count: number;
  cancelled_count: number;
  timeout_count: number;
  error_count: number;
  abandoned_then_manual_count: number;
  abandonment_pct: number;
  abandoned_then_manual_pct: number;
  avg_latency_ms: number | null;
}

export interface VoiceHealthResponse {
  rows: VoiceHealthRow[];
}

export function useVoiceHealthByFarm(farmId: string | undefined, daysBack = 30) {
  return useQuery({
    queryKey: ["voice-health-by-farm", farmId, daysBack],
    enabled: !!farmId,
    queryFn: async () => {
      const startDate = subDays(new Date(), daysBack).toISOString().split("T")[0];
      const { data, error } = await supabase.rpc(
        // @ts-expect-error — new RPC not yet in generated types
        "get_voice_health_by_farm",
        {
          _farm_id: farmId,
          _start_date: startDate,
          _end_date: new Date().toISOString().split("T")[0],
        },
      );
      if (error) throw error;
      return data as unknown as VoiceHealthResponse;
    },
    staleTime: 1000 * 60 * 5,
  });
}
