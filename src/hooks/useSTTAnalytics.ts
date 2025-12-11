import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";

interface STTAnalyticsSummary {
  total_transcriptions: number;
  success_count: number;
  error_count: number;
  rate_limited_count: number;
  success_rate: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  avg_audio_size_bytes: number;
  avg_transcription_length: number;
}

interface DailyBreakdown {
  day: string;
  total: number;
  success_count: number;
  avg_latency_ms: number;
  success_rate: number;
}

interface ModelBreakdown {
  model_provider: string;
  model_version: string;
  total: number;
  success_count: number;
  avg_latency_ms: number;
  success_rate: number;
}

interface ErrorBreakdown {
  error_message: string;
  count: number;
}

interface STTAnalyticsData {
  summary: STTAnalyticsSummary;
  daily_breakdown: DailyBreakdown[];
  model_breakdown: ModelBreakdown[];
  error_breakdown: ErrorBreakdown[];
  unique_users: number;
}

export function useSTTAnalytics(startDate?: Date, endDate?: Date) {
  const start = startDate || subDays(new Date(), 30);
  const end = endDate || new Date();

  return useQuery({
    queryKey: ["stt-analytics", format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd")],
    queryFn: async (): Promise<STTAnalyticsData> => {
      const { data, error } = await supabase.rpc("get_stt_analytics", {
        start_date: format(start, "yyyy-MM-dd"),
        end_date: format(end, "yyyy-MM-dd"),
      });

      if (error) {
        console.error("Failed to fetch STT analytics:", error);
        throw error;
      }

      return data as unknown as STTAnalyticsData;
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useCorrectionStats() {
  return useQuery({
    queryKey: ["stt-correction-stats"],
    queryFn: async () => {
      const { count: totalCorrections, error: countError } = await supabase
        .from("transcription_corrections")
        .select("*", { count: "exact", head: true });

      if (countError) throw countError;

      const { data: recentCorrections, error: recentError } = await supabase
        .from("transcription_corrections")
        .select("original_text, corrected_text, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (recentError) throw recentError;

      return {
        totalCorrections: totalCorrections || 0,
        recentCorrections: recentCorrections || [],
      };
    },
    staleTime: 60 * 1000,
  });
}
