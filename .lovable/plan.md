

# Wire Farmer Voice Tab to Live/Demo Data Toggle

## Problem
The Farmer Voice tab ignores the global Live/Demo/All data category toggle. All 6 sub-components (`FarmerVoiceDashboard`, `FeedbackPriorityQueue`, `FeedbackGeoHeatmap`, `SentimentTrendChart`, `FeedbackClusterView`, `SmartInsightsPanel`) only receive `dateFrom`, `dateTo`, and `region` -- they never receive or pass `dataCategory`. The underlying `useGovernmentFeedback` hook queries `farmer_feedback` joined with `farms` but does not filter on `farms.data_category`.

## Fix

### 1. Update `useGovernmentFeedback` hook
- Add `dataCategory?: DataCategory` to the `FeedbackFilters` interface
- When `dataCategory` is set (and not `'all'`), filter the joined `farms` result by `farms.data_category`
- Since `data_category` lives on the `farms` table (not `farmer_feedback`), apply the filter client-side after the join (same pattern already used for `region` filtering)
- Add `dataCategory` to the query key for proper cache separation

### 2. Update all 6 Farmer Voice components
Add `dataCategory?: DataCategory` prop to each component's props interface and pass it through to `useGovernmentFeedback`:
- `FarmerVoiceDashboard`
- `FeedbackPriorityQueue`
- `FeedbackGeoHeatmap`
- `SentimentTrendChart`
- `FeedbackClusterView`
- `SmartInsightsPanel`

### 3. Update `GovernmentDashboard.tsx` (Farmer Voice tab section, ~lines 1099-1163)
Pass `dataCategory={dataCategory}` to all 6 components alongside the existing `dateFrom`, `dateTo`, and `region` props.

### Files Modified
| File | Change |
|------|--------|
| `src/hooks/useGovernmentFeedback.ts` | Add `dataCategory` to filters, query key, and client-side filtering |
| `src/components/government/FarmerVoiceDashboard.tsx` | Accept and pass `dataCategory` prop |
| `src/components/government/FeedbackPriorityQueue.tsx` | Accept and pass `dataCategory` prop |
| `src/components/government/FeedbackGeoHeatmap.tsx` | Accept and pass `dataCategory` prop |
| `src/components/government/SentimentTrendChart.tsx` | Accept and pass `dataCategory` prop |
| `src/components/government/FeedbackClusterView.tsx` | Accept and pass `dataCategory` prop |
| `src/components/government/SmartInsightsPanel.tsx` | Accept and pass `dataCategory` prop |
| `src/pages/GovernmentDashboard.tsx` | Pass `dataCategory` to all 6 Farmer Voice components |

