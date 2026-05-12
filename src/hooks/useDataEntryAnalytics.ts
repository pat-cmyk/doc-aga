/**
 * @online-only — Cross-farm data entry analytics (government-facing).
 * Must NOT cache locally (RLS boundary). See docs/ssot-architecture.md §3.5.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataCategory } from "@/types/government";

export interface DataEntryAnalytics {
  summary: {
    total: number;
    voice_count: number;
    typed_count: number;
    voice_pct: number;
    prev_voice_pct: number;
  };
  daily: Array<{
    day: string;
    total: number;
    voice_count: number;
    typed_count: number;
  }>;
  by_type: Array<{
    activity_type: string;
    total: number;
    voice_count: number;
    voice_pct: number;
  }>;
  by_location: Array<{
    region: string;
    province: string;
    total: number;
    voice_count: number;
    typed_count: number;
    voice_pct: number;
  }>;
  /**
   * Voice attempt lifecycle metrics (added 2026-05). Captures the "speak → see wrong
   * preview → cancel → re-type manually" pattern that input_method alone can't see.
   * Optional for backward compatibility with older migrations.
   */
  voice_attempts?: {
    attempts_total: number;
    committed_count: number;
    cancelled_count: number;
    timeout_count: number;
    error_count: number;
    /** % of attempts that ended in cancel OR timeout */
    abandonment_pct: number;
    /** Number of cancelled attempts followed by a manual entry of the same record_type within 5 min */
    abandoned_then_manual_count: number;
    /** abandoned_then_manual_count / (cancelled + timeout) * 100 */
    abandoned_then_manual_pct: number;
    daily: Array<{
      day: string;
      attempts: number;
      committed: number;
      abandoned: number;
    }>;
  };
}

interface UseDataEntryAnalyticsParams {
  startDate: Date;
  endDate: Date;
  dataCategory: DataCategory;
  region?: string;
  province?: string;
  municipality?: string;
}

export const useDataEntryAnalytics = ({
  startDate,
  endDate,
  dataCategory,
  region,
  province,
  municipality,
}: UseDataEntryAnalyticsParams) => {
  return useQuery({
    queryKey: [
      "data-entry-analytics",
      startDate.toISOString(),
      endDate.toISOString(),
      dataCategory,
      region,
      province,
      municipality,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_data_entry_analytics", {
        _start_date: startDate.toISOString().split("T")[0],
        _end_date: endDate.toISOString().split("T")[0],
        _data_category: dataCategory,
        _region: region || null,
        _province: province || null,
        _municipality: municipality || null,
      });

      if (error) throw error;
      return data as unknown as DataEntryAnalytics;
    },
    staleTime: 1000 * 60 * 5,
  });
};
