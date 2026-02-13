

# Feed + Milk Production Chart: Analysis and Options

## Your Claim: Feed Intake Correlates with Milk Output

**Verdict: Strongly supported by dairy science.**

The USDA publishes a "milk-feed price ratio" as a standard industry metric, and peer-reviewed research (Allen et al., Journal of Dairy Science, 2019) confirms that dry matter intake (DMI) is one of the strongest predictors of milk yield in lactating cows. The relationship is roughly:

- **Every 1 kg increase in DMI** correlates with approximately **2-2.5 L more milk** in mid-lactation cows
- The correlation coefficient (r) between DMI and milk yield is typically **0.60-0.75** across herds
- The lag effect is **0-3 days** -- feed changes show up in milk within 1-3 days

Your intuition is correct and industry-standard.

---

## Current Data Availability

| Source | Status |
|--------|--------|
| `daily_farm_stats` table | Has `total_milk_liters` per day. Does NOT have feed totals. |
| `feeding_records` table | Has per-animal daily feed (kg) with `record_datetime`, `kilograms`, `feed_type`. **7,805 records exist.** |
| `get_combined_dashboard_data` RPC | Returns milk data only. Would need extension for feed. |

Feed data must be aggregated from `feeding_records` grouped by date. This can be added to the existing RPC or fetched separately.

---

## Three Options

### Option A: Dual-Axis Overlay (Milk + Feed on Same Chart)

A single `ComposedChart` with:
- **Left Y-axis**: Milk (Liters) -- Area chart (existing blue gradient)
- **Right Y-axis**: Feed (kg) -- Line chart (new color, e.g., orange)
- **Shared X-axis**: Same date timeline
- Toggle to show/hide the feed line

**Pros:**
- Direct visual correlation -- farmer sees cause and effect immediately
- No extra screen space needed
- Industry-standard "dual-axis" approach (USDA uses this exact pattern)
- Shared time period controls (Last 30 / YTD) work for both

**Cons:**
- Dual Y-axes can be visually confusing if scales differ greatly (e.g., 50L milk vs 500kg feed)
- Tooltip gets more complex
- Harder to read on small mobile screens with two scales
- Purists argue dual-axis charts can mislead (scaling can exaggerate/minimize correlation)

---

### Option B: Separate Stacked Charts (Milk above, Feed below)

Two independent charts stacked vertically, sharing the same X-axis timeline:
- Top: Existing Milk Production Area Chart
- Bottom: New Feed Consumption Line/Bar Chart

**Pros:**
- Each metric has its own clean scale -- no visual confusion
- Easier to add feed breakdown by category (roughage vs concentrates)
- Simpler implementation -- no changes to existing milk chart
- Better on mobile -- each chart is independently scrollable

**Cons:**
- Takes more vertical space (two full chart heights)
- Correlation is less immediately obvious (eyes must jump between charts)
- Duplicated X-axis labels waste space

---

### Option C: Hybrid -- Dual-Axis with Separate Detail Toggle

Start with Option A (overlay) as default, but add a "Split View" toggle that expands into Option B when the farmer wants deeper analysis.

**Pros:**
- Best of both worlds: quick correlation view + detailed drill-down
- Farmer controls complexity level
- Mobile-friendly: starts compact, expands on demand

**Cons:**
- Most complex to implement
- Two rendering modes to maintain

---

## Recommendation: Option A (Dual-Axis Overlay)

For your use case -- a farmer wanting to see **"did my feed changes affect milk?"** -- the overlay is the most powerful and space-efficient answer. The scale difference concern is manageable because:
1. Your feed data is per-farm daily total (typically 200-800kg) vs milk (typically 50-500L) -- not wildly different orders of magnitude
2. Recharts supports `yAxisId` for clean dual-axis rendering
3. The feed line can be toggled on/off so it doesn't clutter the default view

---

## Implementation Plan

### 1. Extend the Dashboard RPC

Add daily feed totals to `get_combined_dashboard_data` by aggregating `feeding_records`:

```text
New fields in dailyData response:
  - feedTotalKg: total kg fed that day
  - feedAnimalCount: number of animals fed
  - feedCostTotal: total cost (kg * cost_per_kg_at_time)
```

### 2. Update the Data Hook (`useMilkData.ts` / `useCombinedDashboardData.ts`)

- Add `feedTotalKg` to the `CombinedDailyData` interface
- Map RPC response feed data into the existing daily data array
- Calculate `averageFeed` alongside `averageMilk`

### 3. Modify `MilkProductionChart.tsx`

- Convert from `AreaChart` to `ComposedChart` (supports mixed Area + Line)
- Add a second `YAxis` with `yAxisId="right"` and `orientation="right"`
- Add a `Line` component for feed data keyed to the right axis
- Add a toggle button (chip/switch) to show/hide the feed overlay
- Rename the card title to "Milk Production & Feed" when feed is visible

### 4. Update Tooltip (`MilkChartTooltip.tsx`)

- Add feed total (kg), animals fed, and feed cost to the tooltip
- Show feed-to-milk ratio when both values exist

### 5. Update Lazy Wrapper and Interface

- Extend `LazyMilkProductionChartProps` with `showFeedOverlay` and `onToggleFeedOverlay`
- No changes to the skeleton (same card shape)

### 6. Update DRM

- Document the new feed data flow: `feeding_records` -> RPC -> `CombinedDailyData.feedTotalKg` -> `MilkProductionChart`

### Files Modified

| File | Change |
|------|--------|
| New migration SQL | Extend `get_combined_dashboard_data` RPC with feed aggregation |
| `src/components/farm-dashboard/hooks/useMilkData.ts` | Add `feedTotalKg` to `CombinedDailyData` |
| `src/components/farm-dashboard/hooks/useCombinedDashboardData.ts` | Map feed data from RPC |
| `src/components/farm-dashboard/MilkProductionChart.tsx` | Dual-axis ComposedChart with toggle |
| `src/components/farm-dashboard/MilkChartTooltip.tsx` | Add feed info to tooltip |
| `src/components/lazy/LazyCharts.tsx` | Update props interface |
| `src/components/FarmDashboard.tsx` | Pass feed toggle state |
| `docs/data-relationships-map.md` | Document new data flow |

