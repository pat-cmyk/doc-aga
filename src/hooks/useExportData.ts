/**
 * @online-only — Aggregates all data needed for government dashboard exports.
 * Combines preloaded livestock data (from GovernmentDashboard) with
 * programs/insights and farmer voice data fetched on-demand.
 *
 * React Query deduplication ensures no redundant network calls when child
 * components have already fetched the same data with identical query keys.
 */
import { useMemo } from "react";
import { format } from "date-fns";
import { useGrantAnalytics } from "./useGrantAnalytics";
import { useRegionalInvestment } from "./useRegionalInvestment";
import { useVeterinaryExpenseHeatmap } from "./useVeterinaryExpenseHeatmap";
import { useGovernmentMilkAnalytics } from "./useGovernmentMilkAnalytics";
import { useRegionalFeedSecurity } from "./useRegionalFeedSecurity";
import { useGovernmentFeedback } from "./useGovernmentFeedback";
import type { DataCategory } from "@/types/government";
import type { FullExportData } from "@/lib/exportUtils";

// Re-export so consumers can import from either location
export type { FullExportData };

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ExportScope = "full" | "livestock" | "farmer-voice" | "programs";

export interface ExportFilters {
  dateRange: { start: Date; end: Date };
  comparisonDateRange?: { start: Date; end: Date };
  region?: string;
  province?: string;
  municipality?: string;
  comparisonRegion?: string;
  dataCategory: DataCategory;
  comparisonMode: boolean;
}

/**
 * Data already fetched at the GovernmentDashboard page level.
 * Passed in so we avoid duplicate queries for livestock analytics.
 *
 * Using `any` for the complex preloaded shapes intentionally — the
 * canonical types live in each hook file and the export utilities
 * will narrow them at consumption time.
 */
export interface PreloadedData {
  stats: any; // GovStatsWithGrowth | null
  comparisonStats?: any;
  timeseriesData?: any[];
  comparisonTimeseriesData?: any[];
  heatmapData?: any[];
  comparisonHeatmapData?: any[];
  farmerQueries?: Array<{ created_at: string; question: string }>;
  comparisonFarmerQueries?: Array<{ created_at: string; question: string }>;
  breedingStats?: any;
  healthStats?: any;
  pcrsData?: any;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Aggregates all government dashboard data needed for export.
 *
 * @param scope      Which sections to include in the export.
 * @param filters    Active dashboard filters (dates, location, category).
 * @param preloaded  Livestock data already fetched by GovernmentDashboard.
 * @param enabled    Master switch — when false no additional fetches run.
 */
export function useExportData(
  scope: ExportScope,
  filters: ExportFilters,
  preloadedData: PreloadedData,
  enabled: boolean,
) {
  // Determine which data categories need fetching
  const needsPrograms = enabled && (scope === "full" || scope === "programs");
  const needsFarmerVoice = enabled && (scope === "full" || scope === "farmer-voice");

  // ---------------------------------------------------------------------------
  // Programs & Insights hooks
  // React Query deduplication means these reuse cached data when child
  // components have already fetched with the same queryKey.
  // ---------------------------------------------------------------------------

  const { data: grantAnalytics, isLoading: grantsLoading } = useGrantAnalytics(
    filters.region,
    filters.province,
    filters.municipality,
    filters.dataCategory,
    { enabled: needsPrograms },
  );

  const { data: regionalInvestment, isLoading: investmentLoading } = useRegionalInvestment(
    filters.region,
    filters.province,
    filters.municipality,
    filters.dataCategory,
    { enabled: needsPrograms },
  );

  const { data: veterinaryExpenses, isLoading: vetLoading } = useVeterinaryExpenseHeatmap(
    filters.region,
    filters.province,
    filters.municipality,
    filters.dataCategory,
    { enabled: needsPrograms },
  );

  const { data: milkAnalytics, isLoading: milkLoading } = useGovernmentMilkAnalytics(
    filters.dateRange.start,
    filters.dateRange.end,
    filters.region,
    filters.province,
    filters.municipality,
    filters.dataCategory,
    { enabled: needsPrograms },
  );

  const { data: feedSecurity, isLoading: feedSecurityLoading } = useRegionalFeedSecurity(
    filters.region,
    filters.province,
    filters.municipality,
    filters.dataCategory,
    { enabled: needsPrograms },
  );

  // ---------------------------------------------------------------------------
  // Farmer Voice hook
  // useGovernmentFeedback does not accept an `enabled` option — it always
  // fires its useQuery. To avoid unnecessary network calls we pass
  // `undefined` filters when farmer voice data is not needed; the hook
  // still runs but hits the React Query cache from previous calls (or
  // produces a lightweight unfiltered fetch that is effectively a no-op
  // when the dashboard has already loaded the same key).
  // ---------------------------------------------------------------------------

  const feedbackFilters = needsFarmerVoice
    ? {
        dateFrom: format(filters.dateRange.start, "yyyy-MM-dd"),
        dateTo: format(filters.dateRange.end, "yyyy-MM-dd"),
        region: filters.region,
        dataCategory: filters.dataCategory,
      }
    : undefined;

  const {
    feedbackList,
    stats: feedbackStats,
    isLoading: feedbackLoading,
  } = useGovernmentFeedback(feedbackFilters);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  const isLoading = useMemo(() => {
    if (!enabled) return false;

    // Livestock-only scope uses exclusively preloaded data — nothing to wait for
    if (scope === "livestock") return false;

    if (scope === "farmer-voice") return feedbackLoading;

    if (scope === "programs") {
      return grantsLoading || investmentLoading || vetLoading || milkLoading || feedSecurityLoading;
    }

    // scope === "full"
    return (
      feedbackLoading ||
      grantsLoading ||
      investmentLoading ||
      vetLoading ||
      milkLoading ||
      feedSecurityLoading
    );
  }, [
    enabled,
    scope,
    feedbackLoading,
    grantsLoading,
    investmentLoading,
    vetLoading,
    milkLoading,
    feedSecurityLoading,
  ]);

  const isReady = enabled && !isLoading;

  // ---------------------------------------------------------------------------
  // Compose the full export payload
  // ---------------------------------------------------------------------------

  const data = useMemo((): FullExportData | null => {
    if (!enabled) return null;

    return {
      // Preloaded livestock data
      stats: preloadedData.stats,
      comparisonStats: filters.comparisonMode ? preloadedData.comparisonStats : undefined,
      timeseriesData: preloadedData.timeseriesData,
      comparisonTimeseriesData: filters.comparisonMode
        ? preloadedData.comparisonTimeseriesData
        : undefined,
      heatmapData: preloadedData.heatmapData,
      comparisonHeatmapData: filters.comparisonMode
        ? preloadedData.comparisonHeatmapData
        : undefined,
      farmerQueries: preloadedData.farmerQueries,
      comparisonFarmerQueries: filters.comparisonMode
        ? preloadedData.comparisonFarmerQueries
        : undefined,
      breedingStats: preloadedData.breedingStats,
      healthStats: preloadedData.healthStats,
      pcrsData: preloadedData.pcrsData,

      // Filter context
      dateRange: filters.dateRange,
      comparisonDateRange: filters.comparisonMode ? filters.comparisonDateRange : undefined,
      region: filters.region,
      comparisonRegion: filters.comparisonMode ? filters.comparisonRegion : undefined,
      province: filters.province,
      municipality: filters.municipality,
      dataCategory: filters.dataCategory,

      // Programs data (fetched by this hook)
      grantAnalytics: grantAnalytics ?? undefined,
      regionalInvestment: regionalInvestment ?? undefined,
      veterinaryExpenses: veterinaryExpenses ?? undefined,
      milkAnalytics: milkAnalytics ?? undefined,
      feedSecurity: feedSecurity ?? undefined,

      // Farmer voice data (fetched by this hook)
      feedbackList: feedbackList ?? undefined,
      feedbackStats: feedbackStats ?? undefined,
    };
  }, [
    enabled,
    preloadedData,
    filters.comparisonMode,
    filters.comparisonDateRange,
    filters.comparisonRegion,
    filters.dateRange,
    filters.region,
    filters.province,
    filters.municipality,
    filters.dataCategory,
    grantAnalytics,
    regionalInvestment,
    veterinaryExpenses,
    milkAnalytics,
    feedSecurity,
    feedbackList,
    feedbackStats,
  ]);

  return { data, isLoading, isReady };
}
