

# Fix: Feed Toggle Not Showing on Dashboard

## Root Cause

Two issues prevent the feed overlay from appearing:

### Issue 1: Cache short-circuit skips feed data
In `useCombinedDashboardData.ts` (line 105-108), when the IndexedDB cache is "fresh," the hook returns early **before** the feed query ever runs (line 173). The cached data path (`buildCombinedDataFromCache`) does not include `feedTotalKg`, so all feed values are 0, and `hasFeedData` evaluates to `false` -- hiding the toggle.

### Issue 2: `averageMilk` not passed to the chart
`FarmDashboard.tsx` does not pass `averageMilk` to `LazyMilkProductionChart`, so the average reference line never appears.

---

## Fix Plan

### A. Include feed data in cache path (`useCombinedDashboardData.ts`)

1. Store `feedByDate` data in the IndexedDB cache alongside `dailyMilk`.
2. In `buildCombinedDataFromCache`, populate `feedTotalKg` from the cached feed data.
3. When the cache is fresh and has feed data, the toggle will appear immediately without a server fetch.

### B. Always fetch feed even when using cache (simpler alternative)

Move the feed query **before** the cache-fresh early-return, or always run the feed query regardless of cache freshness. This is simpler since feed data is lightweight and not part of the heavy RPC call.

**Recommended: Option B** -- add a separate feed fetch that runs regardless of cache state, then merge feed totals into the `combinedData` already set from cache.

### C. Pass `averageMilk` to the chart (`FarmDashboard.tsx`)

Compute `averageMilk` from `combinedData` and pass it as a prop, or use `stats.avgDailyMilk` which is already available.

---

## Technical Changes

### File: `src/components/farm-dashboard/hooks/useCombinedDashboardData.ts`

- Move the feed query (lines 173-190) to run independently after the cache check, not inside the RPC result block.
- After fetching feed data, merge `feedTotalKg` and `feedAnimalCount` into the current `combinedData` state (whether from cache or server).
- This ensures feed data is always available when the chart renders.

### File: `src/components/FarmDashboard.tsx`

- Compute `averageMilk` from `stats.avgDailyMilk` (already returned by the hook).
- Pass `averageMilk={stats.avgDailyMilk}` to `LazyMilkProductionChart`.

### Files Modified

| File | Change |
|------|--------|
| `useCombinedDashboardData.ts` | Move feed fetch outside cache-fresh gate so it always runs |
| `FarmDashboard.tsx` | Pass `averageMilk={stats.avgDailyMilk}` prop to chart |

