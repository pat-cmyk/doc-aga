

# Fix: Entry Methods Dashboard Stuck on Loading

## Root Cause

In `DataEntryAnalytics.tsx`, the dates are computed on every render:

```typescript
const endDate = new Date();          // different milliseconds each render
const startDate = subDays(endDate, 30);
```

These are passed to `useDataEntryAnalytics`, which uses `startDate.toISOString()` in the query key. Since each render produces a new `Date` object with different milliseconds, React Query sees a **new query key every render** and restarts the fetch -- keeping `isLoading` permanently `true`.

This also explains the flood of duplicate RPC calls visible in the network tab (~10 identical requests).

## Fix

**File: `src/components/admin/DataEntryAnalytics.tsx`**

Wrap the date computation in `useMemo`, keyed only on `dateRange`, so the Date objects are stable across renders:

```typescript
import { useMemo } from "react";

// Replace the raw computation:
const { startDate, endDate } = useMemo(() => {
  const end = new Date();
  const start = dateRange === "7d"
    ? subDays(end, 7)
    : dateRange === "30d"
    ? subDays(end, 30)
    : subDays(end, 90);
  return { startDate: start, endDate: end };
}, [dateRange]);
```

This ensures the dates only change when the user switches the date range selector, not on every render cycle.

## Verification

After the fix, the Entry Methods subtab should:
1. Show the 4 summary cards with real data (191 total entries, 0 voice, 191 typed)
2. Render the daily trend line chart and activity type bar chart
3. Display the location breakdown table (Region IV-A: Quezon 110, Laguna 81)
4. Fire only 1 RPC call instead of 10+

