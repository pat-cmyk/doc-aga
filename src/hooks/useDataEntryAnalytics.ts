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
