
# Government Dashboard Simplification -- SSOT-Compliant Restructuring

## Objective
Eliminate data duplication, enforce filter consistency, and create a coherent narrative across all 3 government dashboard tabs -- while maximizing reuse of existing RPCs, hooks, and components.

---

## Current State Summary

| Tab | Sections | Components | Hooks Used |
|-----|----------|------------|------------|
| Livestock Analytics | 4 | ~15 | useGovernmentStats, useBreedingStats, useGovernmentHealthStats, useGovernmentStatsTimeseries, useHealthHeatmap, useGrantAnalytics |
| Farmer Voice | 6 sub-tabs | ~8 | useGovernmentFeedback (called independently per sub-component, NO global filters) |
| Programs & Insights | 6 | ~10 | useGrantAnalytics, useGrantEffectiveness, useGovernmentMilkAnalytics, useRegionalPCRS, useRegionalDataQuality, useRegionalFeedSecurity, useFarmComplianceMetrics, useRegionalMarketPrices, useFarmerQueries |

---

## Identified Duplications (with SSOT hook tracing)

| Duplication | Livestock Source | Programs Source | Resolution |
|-------------|-----------------|-----------------|------------|
| Milk Production | `GovTrendCharts` (chart 4) uses `useGovernmentStatsTimeseries` -> `total_milk_liters` | `MilkProductionBySpeciesChart` uses `useGovernmentMilkAnalytics` -> species-level breakdown | **Keep Programs version only** (it is the superset with species + revenue). Remove chart 4 from GovTrendCharts. |
| Doc Aga Queries | `GovTrendCharts` (chart 3, `queries` line) uses `useGovernmentStatsTimeseries` -> `doc_aga_queries` | `FarmerQueriesTopics` uses `useFarmerQueries` -> topic-level breakdown | **Keep Programs version only** (it is the superset with topic categorization). Remove queries line from chart 3 in GovTrendCharts. |
| Grant Overview Cards | `GovDashboardOverview` cards 5-6 use `useGrantAnalytics` | `RegionalInvestmentCards` + `GrantDistributionCard` use `useGrantAnalytics` + `useGrantEffectiveness` | **Remove cards 5-6 from GovDashboardOverview** (they preview data fully explored in Programs). Reduces overview to 4 census-focused cards. |
| Expected Deliveries | `ExpectedDeliveriesTimeline` uses `useBreedingStats` -> `expected_deliveries_by_month` | `RegionalPCRSCard` uses `useRegionalPCRS` -> monthly breakdown with risk tiers | **Merge PCRS risk overlay into ExpectedDeliveriesTimeline**. Remove standalone PCRS card from Programs. |

---

## Plan: File-Level Changes

### Phase 1: Clean Up Livestock Analytics Tab (remove leaked metrics)

**File: `src/components/government/GovDashboardOverview.tsx`**
- Remove cards 5 ("Grant Recipients") and 6 ("Avg Purchase Price") -- lines ~217-258
- Remove the `useGrantAnalytics` import and hook call (line 4, 19)
- Change grid from `lg:grid-cols-6` to `lg:grid-cols-4`
- Result: 4 clean census cards (Active Farms, Active Animals, Daily Logs, Health Events)

**File: `src/components/government/GovTrendCharts.tsx`**
- Remove chart 3's `queries` line (keep Health Events only, rename card to "Health Events Trend")
- Remove chart 4 entirely ("Total Milk Production") -- the Programs tab's `MilkProductionBySpeciesChart` already shows this with species breakdown via `useGovernmentMilkAnalytics`
- Change grid from `md:grid-cols-2` (4 charts) to keep only: Farm Growth, Livestock Composition, Health Events (3 charts)
- No new hooks needed -- just removing redundant chart renders

### Phase 2: Merge PCRS Risk Into Expected Deliveries Timeline

**File: `src/components/government/ExpectedDeliveriesTimeline.tsx`**
- Add optional `riskData` prop sourced from the existing `useRegionalPCRS` hook's `monthlyTotals`
- When `riskData` is present, render the existing `TierBadge` component (already built in `RegionalPCRSCard.tsx`) alongside each month's species counts
- Reuse `PCRS_TIERS` from `src/lib/urgencyGlossary.ts` (already imported) and `getPCRSTier` (already imported)
- No new RPC needed -- just passing data from existing `useRegionalPCRS` down

**File: `src/pages/GovernmentDashboard.tsx`**
- Add `useRegionalPCRS` hook call in the Livestock tab data fetching section (reusing existing hook)
- Pass `pcrsData.monthlyTotals` to `ExpectedDeliveriesTimeline` as the new `riskData` prop
- Remove `RegionalPCRSCard` from the Programs tab's "Data Quality and Risk Management" section

### Phase 3: Flatten Farmer Voice Tab + Connect Global Filters

**File: `src/pages/GovernmentDashboard.tsx` (Farmer Voice tab section, lines ~1070-1120)**
- Replace the 6 sub-tabs with a single scrollable layout:
  1. `FarmerVoiceDashboard` stats header (keep)
  2. `FeedbackPriorityQueue` (primary action surface)
  3. Side-by-side: `FeedbackGeoHeatmap` + `SentimentTrendChart`
  4. `FeedbackClusterView`
  5. `SmartInsightsPanel`
- Move Templates and Export to a dropdown menu in the stats header area
- Pass `dateFrom`, `dateTo`, `region` from global filters to each component

**File: `src/components/government/FarmerVoiceDashboard.tsx`**
- Accept optional props: `dateFrom?: string`, `dateTo?: string`, `region?: string`
- Pass these to the existing `useGovernmentFeedback(filters)` call -- the hook already supports `dateFrom`, `dateTo`, `region` in its `FeedbackFilters` interface
- No new RPC needed

**Files: `FeedbackPriorityQueue.tsx`, `SmartInsightsPanel.tsx`, `FeedbackClusterView.tsx`, `FeedbackGeoHeatmap.tsx`, `SentimentTrendChart.tsx`**
- Add optional filter props (`dateFrom`, `dateTo`, `region`) to each component's interface
- Pass these through to the existing `useGovernmentFeedback(filters)` call each component already makes
- The `useGovernmentFeedback` hook already has full filter support (lines 37-51 of the hook) -- we are just not using it from the parent

### Phase 4: Reorganize Programs Tab Sections

**File: `src/pages/GovernmentDashboard.tsx` (Programs tab section, lines ~1122-1296)**
- Reorder sections into 3 clear groups:
  1. **Grant Program Analytics** (keep as-is: `RegionalInvestmentCards`, `GrantDistributionCard`, `GrantEffectivenessPanel`)
  2. **Production Economics** (keep as-is: `MilkProductionBySpeciesChart`, `MarketPriceAnalyticsCard`, `FeedSecurityCard`)
  3. **Platform Adoption** (rename from "Operational Compliance" + "Data Quality"): `FarmerQueriesTopics`, `FarmOperationalHealthCard`, `DataQualityDashboardCard`
- Remove `RegionalPCRSCard` (merged into Livestock tab)
- Remove standalone "Farmer Queries Analysis" Card wrapper (move `FarmerQueriesTopics` into "Platform Adoption" section)

---

## SSOT Compliance Matrix

| Change | Existing Hook Reused | Existing Component Reused | New RPC | New Hook |
|--------|---------------------|--------------------------|---------|----------|
| Remove grant cards from overview | Removes `useGrantAnalytics` call (still used in Programs) | -- | None | None |
| Remove milk/queries from trends | Reduces `useGovernmentStatsTimeseries` consumption | -- | None | None |
| Merge PCRS into deliveries | `useRegionalPCRS` (moved from Programs to Livestock) | `TierBadge`, `PCRS_TIERS` from urgencyGlossary | None | None |
| Connect Farmer Voice filters | `useGovernmentFeedback` (existing filter interface) | All existing sub-components | None | None |
| Flatten Farmer Voice | -- | `ResponseTemplates`, `FeedbackExport` (moved to dropdown) | None | None |
| Regroup Programs sections | All existing hooks retained | All existing components retained | None | None |

**Zero new RPCs. Zero new hooks. Zero new database changes.**

---

## Risk Assessment

- **Low risk**: All changes are layout/composition moves and prop additions
- **No data flow changes**: Every hook continues to call the same RPC it already calls
- **No farmer-facing impact**: All changes are scoped to the government dashboard (Category B hooks, online-only)
- **Filter consistency fix**: Farmer Voice sub-components gain filter support via the existing `FeedbackFilters` interface that `useGovernmentFeedback` already implements

## Files Modified Summary

| File | Type of Change |
|------|---------------|
| `src/components/government/GovDashboardOverview.tsx` | Remove 2 cards + grant hook |
| `src/components/government/GovTrendCharts.tsx` | Remove 1.5 charts (queries line + milk chart) |
| `src/components/government/ExpectedDeliveriesTimeline.tsx` | Add optional PCRS risk overlay prop |
| `src/components/government/FarmerVoiceDashboard.tsx` | Accept filter props |
| `src/components/government/FeedbackPriorityQueue.tsx` | Accept filter props |
| `src/components/government/SmartInsightsPanel.tsx` | Accept filter props |
| `src/components/government/FeedbackClusterView.tsx` | Accept filter props |
| `src/components/government/FeedbackGeoHeatmap.tsx` | Accept filter props |
| `src/components/government/SentimentTrendChart.tsx` | Accept filter props |
| `src/pages/GovernmentDashboard.tsx` | Restructure all 3 tabs, add PCRS hook, flatten Farmer Voice, regroup Programs |

## Governance Updates Required
- `docs/ssot-architecture.md`: Update component inventory table
- `changelog.md`: Log the restructuring
