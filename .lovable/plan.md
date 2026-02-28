

# Fix Farmer Voice Data Category Filtering (Query-Level)

## Problem
The `useGovernmentFeedback` hook has two issues:
1. The main feedback query (line 34) does not include `data_category` in the farms join select, so the client-side filter on line 66 always sees `undefined`
2. It uses client-side filtering instead of the established query-level pattern used by all other government hooks

## Solution
Use the same `farms!inner` + `.eq("farms.data_category", ...)` pattern already proven across the codebase (e.g., `useGrantAnalytics`, `useVeterinaryExpenseHeatmap`, `useGrantEffectiveness`). This filters at the database level, is more efficient, and follows the SSOT architecture.

## Changes (Single File)

### `src/hooks/useGovernmentFeedback.ts`

**Main feedback list query (lines 30-67):**
- Change the join from `farms(name, region, province, municipality, livestock_type)` to `farms!inner(name, region, province, municipality, livestock_type, data_category)`
- Add query-level filter: when `dataCategory` is set and not `'all'`, apply `.eq("farms.data_category", dataCategory)` before executing the query
- Remove the client-side `data_category` filter on line 65-67 (no longer needed)
- Keep the client-side `region` filter as-is (region filtering uses a different pattern here)

**Stats query (lines 76-78):**
- Change from `farms(data_category)` to `farms!inner(data_category)`
- Add query-level `.eq("farms.data_category", dataCategory)` filter when applicable
- Remove client-side `data_category` filter on lines 83-86

This aligns with how `useGrantAnalytics` (line 67), `useVeterinaryExpenseHeatmap` (line 57), and `useGrantEffectiveness` (line 55) all handle the same filter.

### No other files change
All 6 Farmer Voice components already pass `dataCategory` to the hook (wired in the previous change). The `GovernmentDashboard` already passes `dataCategory` to all components.

## Verification
- Switch to Demo Data on the Farmer Voice tab -- should show only feedback from demo farms
- Switch to Live Data -- should show only feedback from live farms  
- Switch to All Data -- should show everything
- Stats cards, Priority Queue, Heatmap, Sentiment, Clusters, and Smart Insights should all reflect the selected category
