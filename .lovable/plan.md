

# Milk Spoilage/Rejection Financial Reporting

## Industry Context (Gold Standards)

Based on research from dairy industry KPIs (MSU Extension, Journal of Dairy Science, FAO FLW Standard, Nestle milk loss studies), the gold-standard metrics for milk loss/rejection tracking are:

1. **Rejection Rate (%)** = Rejected Liters / Total Liters Produced x 100 (industry benchmark: less than 2% is excellent, 2-5% needs attention, above 5% is critical)
2. **Lost Revenue (currency)** = Rejected Liters x Market Price Per Liter (opportunity cost -- what the farmer would have earned)
3. **Rejection by Reason** = Breakdown showing which quality issues are most frequent (enables root-cause analysis, e.g., recurring mastitis suggests herd health intervention)
4. **Trend Over Time** = Is rejection rate improving or worsening month-over-month?

These map directly to our existing data: `milking_records.milk_quality`, `milking_records.milk_quality_rejection_reason`, `milking_records.liters`, and market price from `useLastMilkPriceBySpecies`.

## What Already Exists (SSOT Reuse)

| Need | Existing Asset | Reuse? |
|------|---------------|--------|
| Rejected milk data | `milking_records.milk_quality` + `milk_quality_rejection_reason` (just added) | Direct query |
| Market price per liter | `useLastMilkPriceBySpecies` hook | Reuse for lost revenue calc |
| Date filtering | `FinanceDateRangePicker` + `DateRange` type | Pass through from FinanceTab |
| Currency formatting | `formatPHP`, `formatPHPCompact` from `src/lib/currency.ts` | Reuse |
| Insight engine | `useContextualInsights` hook | Extend with rejection insight |
| P&L breakdown | `ProfitabilityThermometer` component | Add rejection line item |
| Rejection reason constants | `MILK_REJECTION_REASONS` from `src/constants/milkQuality.ts` | Reuse for labels |

**No new RPCs or database changes are needed.** All data is already in `milking_records` and can be queried client-side with existing Supabase patterns.

## Implementation Plan

### 1. New Hook: `useMilkSpoilageReport` (single new data source)

One hook that queries `milking_records` for the selected date range and computes all spoilage metrics:

- **Total liters produced** (all records in period)
- **Rejected liters** (where `milk_quality = 'rejected'`)
- **Rejection rate %** (rejected / total x 100)
- **Lost revenue** (rejected liters x species-specific market price, reusing `useLastMilkPriceBySpecies`)
- **Rejection reasons breakdown** (count + liters per reason, using `MILK_REJECTION_REASONS` labels)
- **Top rejected animals** (which animals have the most rejections -- actionable for health intervention)
- **Period comparison** (rejection rate this period vs previous period for trend)

This follows the existing hook pattern (same structure as `useFinancialHealth`, `useProfitability`).

### 2. New Component: `MilkSpoilageCard` (Finance Tab)

A collapsible card placed in the Finance Tab's "Detailed P&L Analysis" section (alongside `ProfitabilityThermometer` and `AnimalCostAnalysis`). It shows:

- **Header row**: Rejection Rate badge (color-coded: green less than 2%, yellow 2-5%, red above 5%) + Total Lost Revenue
- **Liters summary**: "X.X L rejected out of Y.Y L produced"
- **Rejection reasons chart**: Horizontal bar chart showing top reasons (reusing `SourceBar` pattern from `RevenueExpenseComparison`)
- **Top affected animals**: List of animals with most rejections (name, count, liters lost)
- **Trend indicator**: Arrow up/down comparing to previous period (reusing `TrendIndicator` pattern)

### 3. Extend `useContextualInsights` (Smart Tips)

Add a new insight rule to the existing engine:

- If rejection rate exceeds 5%: **Critical** insight -- "X% of milk was rejected this period. Check herd health, especially for [top reason]."
- If rejection rate is 2-5%: **Warning** insight -- "Milk rejection rate is X%. Top reason: [reason]."
- If rejection rate decreased significantly: **Success** insight -- "Milk rejection rate improved by X%."

This reuses the existing `Insight` type and priority system -- no new component needed.

### 4. Extend `ProfitabilityThermometer` (P&L Line Item)

Add a "Milk Rejected (Lost Revenue)" line item in the detailed breakdown section (alongside "Milk Sales", "Animal Sales", "Other Revenue"). This makes the opportunity cost visible in the P&L context. Uses data from `useMilkSpoilageReport`.

### 5. File Changes Summary

| File | Change Type | Description |
|------|------------|-------------|
| `src/hooks/useMilkSpoilageReport.ts` | **NEW** | Single hook for all spoilage metrics |
| `src/components/finance/MilkSpoilageCard.tsx` | **NEW** | Collapsible card for Finance tab |
| `src/components/FinanceTab.tsx` | **EDIT** | Add MilkSpoilageCard inside the "Detailed P&L Analysis" collapsible |
| `src/hooks/useContextualInsights.ts` | **EDIT** | Add rejection rate insight rules (3 new conditions) |
| `src/components/finance/ProfitabilityThermometer.tsx` | **EDIT** | Add lost revenue line item in breakdown |

### 6. Data Flow (SSOT)

```text
milking_records (milk_quality, liters, animal_id, record_date)
       |
       v
useMilkSpoilageReport (query + compute metrics)
       |
       +---> MilkSpoilageCard (Finance Tab, detailed view)
       +---> useContextualInsights (smart tips, if rate > threshold)
       +---> ProfitabilityThermometer (lost revenue line item)
```

No new database tables, RPCs, triggers, or schema changes. Pure UI + client-side computation reusing existing data and hooks.

