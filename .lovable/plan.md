

# Add Thousand-Separator Number Formatting to Cooperative & Government Dashboards

## Goal
Ensure all numeric displays across the cooperative and government dashboards use comma-separated formatting (e.g., "1,000") with decimals rounded to the nearest whole number for readability.

## Approach
Add a `formatNumber` utility to `src/lib/currency.ts` and apply it across all affected components. This keeps formatting centralized and consistent with the existing `formatPHP` / `formatPHPCompact` pattern.

## Step 1 — Add `formatNumber` utility
Add to `src/lib/currency.ts`:
```ts
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("en-PH");
}
```

## Step 2 — Update Cooperative Dashboard Components

**CooperativeOverview.tsx** (line 46):
- `(milk?.total_liters ?? 0).toFixed(1)` → `formatNumber(milk?.total_liters ?? 0)` + " L"

**CooperativeMilkAnalytics.tsx**:
- Line 31: total liters → `formatNumber(...)`
- Line 47: tooltip formatter → round and format
- Line 69: per-farm liters → `formatNumber(...)`

**CooperativeFinancials.tsx** (lines 36, 46, 56, 72):
- `.toLocaleString()` calls already work but switch to `formatNumber()` for consistency and rounding

**CooperativeHerdSummary.tsx** (lines 35, 55, 81):
- Wrap animal counts with `formatNumber()`

**CooperativeHealthOverview.tsx** (lines 31, 41, 55):
- Wrap record/mortality/diagnosis counts with `formatNumber()`

## Step 3 — Update Government Dashboard Components

**GovDashboardOverview.tsx**:
- Replace all `.toLocaleString()` calls with `formatNumber()` (stats cards and comparison display)

**MilkProductionBySpeciesChart.tsx** (lines 102, 111, 123, 135, 212, 215):
- Replace `.toLocaleString()` with `formatNumber()` for milk totals in summary cards and tooltips

**MilkProductionSummaryCard.tsx** (line 56):
- Replace `.toLocaleString("en-PH", ...)` with `formatNumber()`

**MortalityAnalyticsCard.tsx** (line 65, 107, 134):
- Wrap exit counts with `formatNumber()`

**RegionalInvestmentCards.tsx** (lines 44, 57, 83):
- Replace `.toLocaleString()` with `formatNumber()`

**GovTrendCharts.tsx** (lines 104, 238, 243):
- Replace `.toLocaleString()` with `formatNumber()` in tooltips

**FeedSecuritySummaryCard.tsx** — percentages only, no changes needed (already `.toFixed(0)%`)

## Files Changed (~12 files)
- `src/lib/currency.ts` — add `formatNumber`
- 5 cooperative components
- 6 government components

## Notes
- Percentages (e.g., mortality rate `2.15%`) keep their decimal precision — only counts and volumes get rounded
- Currency displays already use `formatPHP`/`formatPHPCompact` which handle their own formatting — no changes needed there
- The `formatNumber` function uses `Math.round` + `en-PH` locale for consistent comma separators

