/**
 * @online-only — Cross-farm grant effectiveness metrics.
 * Must NOT cache locally (RLS boundary). See docs/ssot-architecture.md §3.5.
 *
 * Uses server-side RPC `get_grant_effectiveness()` to avoid:
 *   1. PostgREST URL overflow with .in() on 600+ UUIDs
 *   2. Mortality always 0% (old hook filtered exit_date IS NULL then checked for deaths)
 *   3. 4 sequential queries (now single round-trip)
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataCategory } from "@/types/government";

export interface AcquisitionMetrics {
  count: number;
  avgHealthEvents: number;
  avgMilkProduction: number;
  mortalityRate: number;
  breedingSuccessRate: number;
}

export interface GrantSourceMetrics extends AcquisitionMetrics {
  source: string;
}

export interface GrantEffectivenessData {
  grantAnimals: AcquisitionMetrics;
  purchasedAnimals: AcquisitionMetrics;
  bornOnFarmAnimals: AcquisitionMetrics;
  byGrantSource: GrantSourceMetrics[];
}

const EMPTY_METRICS: AcquisitionMetrics = {
  count: 0,
  avgHealthEvents: 0,
  avgMilkProduction: 0,
  mortalityRate: 0,
  breedingSuccessRate: 0,
};

const EMPTY_RESULT: GrantEffectivenessData = {
  grantAnimals: EMPTY_METRICS,
  purchasedAnimals: EMPTY_METRICS,
  bornOnFarmAnimals: EMPTY_METRICS,
  byGrantSource: [],
};

export const useGrantEffectiveness = (
  region?: string,
  province?: string,
  municipality?: string,
  dataCategory: DataCategory = 'live',
  options?: { enabled?: boolean }
) => {
  return useQuery<GrantEffectivenessData>({
    queryKey: ["grant-effectiveness", region || "all", province || "all", municipality || "all", dataCategory],
    enabled: options?.enabled ?? true,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_grant_effectiveness", {
        p_region: region || null,
        p_province: province || null,
        p_municipality: municipality || null,
        p_data_category: dataCategory,
      });

      if (error) {
        console.error("get_grant_effectiveness RPC error:", error);
        throw error;
      }

      if (!data) return EMPTY_RESULT;

      // RPC returns JSON matching our interface shape — parse camelCase keys
      const parsed = typeof data === "string" ? JSON.parse(data) : data;

      return {
        grantAnimals: parseMetrics(parsed.grantAnimals),
        purchasedAnimals: parseMetrics(parsed.purchasedAnimals),
        bornOnFarmAnimals: parseMetrics(parsed.bornOnFarmAnimals),
        byGrantSource: (parsed.byGrantSource || []).map((s: any) => ({
          source: s.source || "Unknown Source",
          ...parseMetrics(s),
        })),
      };
    },
  });
};

/** Safely parse metrics from RPC JSON, coercing nulls to 0 */
function parseMetrics(raw: any): AcquisitionMetrics {
  if (!raw) return EMPTY_METRICS;
  return {
    count: Number(raw.count) || 0,
    avgHealthEvents: Number(raw.avgHealthEvents) || 0,
    avgMilkProduction: Number(raw.avgMilkProduction) || 0,
    mortalityRate: Number(raw.mortalityRate) || 0,
    breedingSuccessRate: Number(raw.breedingSuccessRate) || 0,
  };
}
