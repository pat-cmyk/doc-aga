
# SSOT Architecture: Complete Data Category Migration Audit and Fix

## Executive Summary

Following the `data_category` migration on the `farms` table, there's a systemic disconnect where **only some components respect the Live/Demo data source filter**. This creates data inconsistencies between the dashboard and Doc Aga AI, and between different dashboard cards.

This plan implements a **scalable SSOT (Single Source of Truth) architecture** that ensures all data flows from a single `dataCategory` state through every layer of the application.

---

## Architecture Overview

```text
                    URL Parameter (data_source)
                            |
                            v
               +------------------------+
               |  GovernmentDashboard   |
               |  dataCategory state    |  <-- SINGLE SOURCE OF TRUTH
               +------------------------+
                     |         |
         +-----------+         +-----------+
         v                                 v
+------------------+             +------------------+
|  Dashboard Hooks |             |    Doc Aga AI    |
|  (all 15 hooks)  |             |  (edge function) |
+------------------+             +------------------+
         |                                 |
         v                                 v
+------------------+             +------------------+
|  RPC Functions   |             |  tools.ts        |
|  (data_category_ |             |  (getFiltered... |
|   filter param)  |             |   helpers)       |
+------------------+             +------------------+
         |                                 |
         +-------------+-------------------+
                       |
                       v
              +------------------+
              |    farms table   |
              | data_category    |
              | ('live'/'demo')  |
              +------------------+
```

---

## Layer 1: Type Definition (Already Implemented)

**File: `src/types/government.ts`**

```typescript
export type DataCategory = 'live' | 'demo' | 'all';
export const DEFAULT_DATA_CATEGORY: DataCategory = 'live';
```

Status: COMPLETE

---

## Layer 2: Database RLS Policies (CRITICAL GAP)

### Problem
Tables queried by Doc Aga AI lack government SELECT policies, causing queries to return 0 results even when data exists.

### Current State

| Table | Government Policy | Status |
|-------|-------------------|--------|
| `farms` | government_view_farms | OK |
| `animals` | government_view_animals | OK |
| `health_records` | government_view_health_records | OK |
| `heat_records` | Government can view all heat records | OK |
| `body_condition_scores` | Government can view all BCS | OK |
| `ai_records` | NONE | MISSING |
| `milking_records` | NONE | MISSING |
| `feeding_records` | NONE | MISSING |
| `weight_records` | NONE | MISSING |

### Fix Required

Create new migration to add missing RLS policies:

```sql
-- ai_records: Needed for breeding/pregnancy analytics
CREATE POLICY "government_view_ai_records" ON public.ai_records
  FOR SELECT USING (has_role(auth.uid(), 'government'::user_role));

-- milking_records: Needed for milk production analytics
CREATE POLICY "government_view_milking_records" ON public.milking_records
  FOR SELECT USING (has_role(auth.uid(), 'government'::user_role));

-- feeding_records: Needed for feed security analytics
CREATE POLICY "government_view_feeding_records" ON public.feeding_records
  FOR SELECT USING (has_role(auth.uid(), 'government'::user_role));

-- weight_records: Needed for growth analytics
CREATE POLICY "government_view_weight_records" ON public.weight_records
  FOR SELECT USING (has_role(auth.uid(), 'government'::user_role));
```

---

## Layer 3: RPC Functions (4 Need Update)

### Problem
These RPCs don't accept `data_category_filter` parameter:

| RPC Function | Current Params | Status |
|--------------|----------------|--------|
| `get_government_milk_analytics` | date, region, province, municipality | MISSING `data_category_filter` |
| `get_regional_feed_security` | region, province, municipality | MISSING `data_category_filter` |
| `get_regional_market_prices` | date, region | MISSING `data_category_filter` |
| `get_farm_compliance_metrics` | date, region, province | MISSING `data_category_filter` |

### Fix Required

Update each RPC to:
1. Accept `data_category_filter TEXT DEFAULT 'live'` parameter
2. Add filter: `AND (data_category_filter IS NULL OR f.data_category = data_category_filter)`

Example fix for `get_government_milk_analytics`:

```sql
CREATE OR REPLACE FUNCTION public.get_government_milk_analytics(
  start_date DATE,
  end_date DATE,
  region_filter TEXT DEFAULT NULL,
  province_filter TEXT DEFAULT NULL,
  municipality_filter TEXT DEFAULT NULL,
  data_category_filter TEXT DEFAULT 'live'  -- NEW PARAMETER
)
-- ... existing return type ...
AS $$
BEGIN
  RETURN QUERY
  WITH daily_milk AS (
    SELECT ...
    FROM milking_records mr
    JOIN animals a ON mr.animal_id = a.id
    JOIN farms f ON a.farm_id = f.id
    WHERE mr.milking_date >= start_date
      AND mr.milking_date <= end_date
      AND a.is_deleted = false
      AND f.is_deleted = false
      AND (data_category_filter IS NULL OR f.data_category = data_category_filter)  -- NEW FILTER
      AND (region_filter IS NULL OR f.region = region_filter)
      ...
  )
  ...
END;
$$;
```

---

## Layer 4: Frontend Hooks (8 Need Update)

### Problem
These hooks don't accept or pass `dataCategory`:

| Hook | Calls | Status |
|------|-------|--------|
| `useGovernmentMilkAnalytics` | `get_government_milk_analytics` RPC | MISSING |
| `useRegionalFeedSecurity` | `get_regional_feed_security` RPC | MISSING |
| `useRegionalMarketPrices` | `get_regional_market_prices` RPC | MISSING |
| `useFarmComplianceMetrics` | `get_farm_compliance_metrics` RPC | MISSING |
| `useGrantEffectiveness` | Direct table queries | MISSING |
| `useRegionalInvestment` | Direct table queries | MISSING |
| `useVeterinaryExpenseHeatmap` | Direct table queries | MISSING |
| `useFarmerQueries` | `doc_aga_queries` table | MISSING (should filter by farm context) |

### Fix Pattern

Update each hook to:
1. Import `DataCategory` from `@/types/government`
2. Add `dataCategory: DataCategory = 'live'` parameter
3. Include `dataCategory` in `queryKey` for cache separation
4. Pass `data_category_filter` to RPC or apply filter to direct queries

Example for `useGovernmentMilkAnalytics`:

```typescript
import { DataCategory } from "@/types/government";

export const useGovernmentMilkAnalytics = (
  startDate: Date,
  endDate: Date,
  region?: string,
  province?: string,
  municipality?: string,
  dataCategory: DataCategory = 'live',  // NEW PARAMETER
  options?: { enabled?: boolean }
) => {
  return useQuery<MilkAnalyticsSummary>({
    queryKey: [
      "government-milk-analytics",
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
      region || "all",
      province || "all",
      municipality || "all",
      dataCategory,  // ADD TO QUERY KEY
    ],
    ...
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_government_milk_analytics", {
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        region_filter: region || null,
        province_filter: province || null,
        municipality_filter: municipality || null,
        data_category_filter: dataCategory === 'all' ? null : dataCategory,  // NEW
      });
      ...
    },
  });
};
```

For hooks with direct queries (e.g., `useRegionalInvestment`):

```typescript
export const useRegionalInvestment = (
  region?: string,
  province?: string,
  municipality?: string,
  dataCategory: DataCategory = 'live',  // NEW
  options?: { enabled?: boolean }
) => {
  return useQuery<RegionalInvestmentData>({
    queryKey: ["regional-investment", region || "all", province || "all", municipality || "all", dataCategory],
    queryFn: async () => {
      let farmsQuery = supabase
        .from("farms")
        .select("id")
        .eq("is_deleted", false);

      // Apply data category filter
      if (dataCategory !== 'all') {
        farmsQuery = farmsQuery.eq('data_category', dataCategory);  // NEW
      }
      
      if (region) farmsQuery = farmsQuery.eq("region", region);
      ...
    },
  });
};
```

---

## Layer 5: Dashboard Components (9 Need Update)

### Problem
Components don't receive or pass `dataCategory` prop:

| Component | Hook Used | Status |
|-----------|-----------|--------|
| `MilkProductionBySpeciesChart` | `useGovernmentMilkAnalytics` | MISSING prop |
| `FeedSecurityCard` | `useRegionalFeedSecurity` | MISSING prop |
| `MarketPriceAnalyticsCard` | `useRegionalMarketPrices` | MISSING prop |
| `FarmOperationalHealthCard` | `useFarmComplianceMetrics` | MISSING prop |
| `GrantDistributionCard` | `useGrantAnalytics` | MISSING prop |
| `GrantEffectivenessPanel` | `useGrantEffectiveness` | MISSING prop |
| `RegionalInvestmentCards` | `useRegionalInvestment` | MISSING prop |
| `VeterinaryExpenseHeatmap` | `useVeterinaryExpenseHeatmap` | MISSING prop |
| `RegionalDetailPanel` | Multiple hooks | HARDCODED 'live' |

### Fix Pattern

1. Add `dataCategory` prop to each component interface
2. Pass prop to hook call

Example for `MilkProductionBySpeciesChart`:

```typescript
import { DataCategory } from "@/types/government";

interface MilkProductionBySpeciesChartProps {
  startDate: Date;
  endDate: Date;
  region?: string;
  province?: string;
  municipality?: string;
  dataCategory?: DataCategory;  // NEW PROP
}

export const MilkProductionBySpeciesChart = ({
  startDate,
  endDate,
  region,
  province,
  municipality,
  dataCategory = 'live',  // DEFAULT
}: MilkProductionBySpeciesChartProps) => {
  const { data, isLoading, error } = useGovernmentMilkAnalytics(
    startDate,
    endDate,
    region,
    province,
    municipality,
    dataCategory  // PASS TO HOOK
  );
  ...
};
```

---

## Layer 6: GovernmentDashboard (Props Passing)

### Problem
Dashboard has `dataCategory` state but doesn't pass to all components.

### Current (Lines 1177-1221)
```tsx
<MilkProductionBySpeciesChart
  startDate={primaryDateRange.start}
  endDate={primaryDateRange.end}
  region={primaryRegion}
  province={primaryProvince}
  municipality={primaryMunicipality}
  // dataCategory NOT PASSED
/>
```

### Fix Required
```tsx
<MilkProductionBySpeciesChart
  startDate={primaryDateRange.start}
  endDate={primaryDateRange.end}
  region={primaryRegion}
  province={primaryProvince}
  municipality={primaryMunicipality}
  dataCategory={dataCategory}  // ADD THIS
/>
```

Apply same pattern to all 9 components listed above.

---

## Layer 7: Doc Aga AI (Already Implemented)

Status: The edge function already receives `dataCategory` and uses `getFilteredFarmIds`/`getFilteredAnimalIds` helpers.

However, queries fail due to missing RLS policies (Layer 2).

---

## Implementation Order

### Phase 1: Database (Unblocks everything)
1. Create migration for RLS policies on `ai_records`, `milking_records`, `feeding_records`, `weight_records`
2. Update 4 RPCs to accept `data_category_filter`

### Phase 2: Hooks (8 files)
1. `useGovernmentMilkAnalytics.ts`
2. `useRegionalFeedSecurity.ts`
3. `useRegionalMarketPrices.ts`
4. `useFarmComplianceMetrics.ts`
5. `useGrantEffectiveness.ts`
6. `useRegionalInvestment.ts`
7. `useVeterinaryExpenseHeatmap.ts`
8. `useFarmerQueries` in `useGovernmentStats.ts`

### Phase 3: Components (9 files)
1. `MilkProductionBySpeciesChart.tsx`
2. `FeedSecurityCard.tsx`
3. `MarketPriceAnalyticsCard.tsx`
4. `FarmOperationalHealthCard.tsx`
5. `GrantDistributionCard.tsx`
6. `GrantEffectivenessPanel.tsx`
7. `RegionalInvestmentCards.tsx`
8. `VeterinaryExpenseHeatmap.tsx`
9. `RegionalDetailPanel.tsx`

### Phase 4: Dashboard
1. Update `GovernmentDashboard.tsx` to pass `dataCategory` to all components

---

## Files Summary

| Layer | Action | Count |
|-------|--------|-------|
| Database Migration | CREATE | 1 (RLS + RPC updates) |
| Hooks | MODIFY | 8 |
| Components | MODIFY | 9 |
| Dashboard | MODIFY | 1 |
| **Total** | | **19 files** |

---

## Expected Outcome

After implementation:

1. **Dashboard** shows correct data based on Live/Demo toggle
2. **Doc Aga AI** analyzes the same dataset visible in dashboard
3. **All cards** respect the data source filter
4. **RegionalDetailPanel** inherits dataCategory from parent
5. **Cache isolation** prevents stale data when switching modes
6. **Scalable pattern** - new features just need to accept and pass dataCategory

---

## SSOT Compliance Checklist

| Principle | Implementation |
|-----------|----------------|
| Single Type Definition | `src/types/government.ts` |
| Single State Source | URL `data_source` param -> `dataCategory` state |
| Consistent RPC Pattern | All use `data_category_filter` param |
| Consistent Hook Pattern | All accept `dataCategory` param |
| Consistent Component Pattern | All accept `dataCategory` prop |
| Cache Key Isolation | `dataCategory` in all queryKeys |
| Default Value | `'live'` at every layer |
