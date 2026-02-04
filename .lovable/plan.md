
# Fix: Regional Livestock Map Missing Pins for Demo Data

## Problem Summary

The Regional Livestock Distribution map shows no pins when "Demo Data" is selected because the map's data source was not updated during the live/demo data segregation implementation.

## Root Cause

The `dataCategory` filter is being used throughout the Government Dashboard but was not connected to the map component:

| Component | Issue |
|-----------|-------|
| `GovernmentDashboard.tsx` | Has `dataCategory` state but doesn't pass it to `RegionalLivestockMap` |
| `RegionalLivestockMap.tsx` | Doesn't accept `dataCategory` prop |
| `useRegionalStats` hook | Doesn't filter by `data_category` - returns all farms regardless of selection |

The hook calls `get_gov_farm_analytics_with_audit()` which returns all farms from the view. The view now includes `data_category`, but the hook doesn't filter the results.

## Current Data Status

From the database:
- **Demo farms**: 15 farms
- **Live farms**: 11 farms

When "Demo" is selected, the hook still returns all 26 farms but the aggregation doesn't filter, so pins appear based on total data (or don't render correctly due to the mismatch).

## Solution

### 1. Update `RegionalLivestockMap` Component

Add `dataCategory` prop and pass it to the hook:

```typescript
interface RegionalLivestockMapProps {
  dateRange?: { start: Date; end: Date };
  dataCategory?: 'live' | 'demo' | 'all';  // NEW
}

const RegionalLivestockMap = ({ dateRange, dataCategory = 'live' }: RegionalLivestockMapProps) => {
  const { data: regionalStats, isLoading } = useRegionalStats(dataCategory);
  // ...
};
```

### 2. Update `useRegionalStats` Hook

Accept `dataCategory` parameter and filter results:

```typescript
export const useRegionalStats = (dataCategory: 'live' | 'demo' | 'all' = 'live') => {
  return useQuery({
    queryKey: ["regional-stats", dataCategory],  // Include in cache key
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_gov_farm_analytics_with_audit", {
        _access_type: "view",
        _metadata: { source: "regional_stats_dashboard", data_category: dataCategory }
      });

      if (error) throw error;

      const farms = data as unknown as GovFarmAnalyticsRow[];
      
      // Filter by data category client-side (view includes the column)
      const filteredFarms = dataCategory === 'all' 
        ? farms 
        : farms.filter(f => f.data_category === dataCategory);

      // Aggregate by region using filteredFarms...
    },
  });
};
```

### 3. Pass `dataCategory` from Dashboard

Update the RegionalLivestockMap call in GovernmentDashboard:

```typescript
<RegionalLivestockMap 
  dateRange={primaryDateRange} 
  dataCategory={dataCategory}  // NEW
/>
```

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useRegionalStats.ts` | Add `dataCategory` param, add `data_category` to interface, filter results |
| `src/components/government/RegionalLivestockMap.tsx` | Add `dataCategory` prop, pass to hook |
| `src/pages/GovernmentDashboard.tsx` | Pass `dataCategory` to RegionalLivestockMap |

## Additional Fix Required

There's also a TypeScript error in `useGovernmentHealthStats.ts` where the RPC return type doesn't match the expected interface. The corrective migration changed the column names but the hook still expects the old column names. This needs to be fixed by mapping the new column names to the expected interface.

## Testing Checklist

- [ ] Map shows pins when "Demo Data" is selected
- [ ] Map shows pins when "Live Data" is selected  
- [ ] Map shows all pins when "All Data" is selected
- [ ] Clicking map pins opens regional detail panel with correct filtered data
- [ ] Government health stats load without TypeScript errors
