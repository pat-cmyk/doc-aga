

# Plan: Live/Demo Farm Data Segregation System

## Overview

Implement a data segregation system that allows admins to classify farms as "live" (production) or "demo" (test/demo), with the government dashboard able to filter between these datasets for presentations and real-world analysis.

---

## Industry Best Practices Analysis

| Approach | Description | Pros | Cons |
|----------|-------------|------|------|
| **Single-column flag (Recommended)** | Add `data_category` column to farms table | Simple, fast queries, easy admin control, minimal code changes | All data in one table (acceptable for your scale) |
| **Separate databases** | Demo data in isolated DB | Complete isolation, zero risk of mixing | Complex to maintain, expensive, overkill for your use case |
| **Schema-based isolation** | Different PostgreSQL schemas per environment | Good isolation, single DB | Complex RLS, harder to query across |
| **Tag-based system** | Flexible tagging with many categories | Very flexible | Over-engineered for binary live/demo |

**Recommendation**: Single-column flag is the industry standard for SaaS platforms at your stage. It aligns with your SSOT architecture and existing patterns (similar to `is_deleted`, `is_program_participant` flags).

---

## Architecture Design

### Data Flow

```text
Admin Dashboard → Set farm.data_category → Database
                                              ↓
Government Dashboard → Select data_category filter
                                              ↓
                       RPCs filter by data_category
                                              ↓
                       Scoped analytics displayed
```

### Key Principles
1. **Non-breaking**: Default all existing farms to `live` 
2. **Cascading**: Farm's category applies to all its animals, records, etc.
3. **Admin-only control**: Only super admins can change a farm's category
4. **Minimal RPC changes**: Add one optional parameter to government RPCs

---

## Database Changes

### 1. New Column on `farms` Table

```sql
-- Add data_category column with default 'live'
ALTER TABLE public.farms 
ADD COLUMN data_category TEXT NOT NULL DEFAULT 'live'
CHECK (data_category IN ('live', 'demo'));

-- Index for efficient filtering
CREATE INDEX idx_farms_data_category ON farms(data_category);

-- Update existing [TEST] farms to 'demo'
UPDATE farms 
SET data_category = 'demo' 
WHERE name LIKE '%[TEST]%';
```

### 2. Update Government RPCs

All government RPC functions will receive a new optional `data_category_filter` parameter:

- `get_government_stats()`
- `get_government_stats_timeseries()`
- `get_health_heatmap_data()`
- `get_government_health_stats()`
- `get_breeding_stats()`

Example modification:

```sql
CREATE OR REPLACE FUNCTION public.get_government_stats(
  start_date date,
  end_date date,
  region_filter text DEFAULT NULL,
  province_filter text DEFAULT NULL,
  municipality_filter text DEFAULT NULL,
  data_category_filter text DEFAULT 'live'  -- NEW PARAMETER
)
...
WHERE f.is_deleted = false
  AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
  ...
```

### 3. Update `gov_farm_analytics` View

Add `data_category` to the view output for filtering:

```sql
CREATE VIEW public.gov_farm_analytics AS
SELECT 
  f.id AS farm_id,
  f.data_category,  -- NEW COLUMN
  ...
```

---

## Frontend Changes

### 1. Admin Dashboard: Farm Oversight

**File**: `src/components/admin/FarmOversight.tsx`

Add a column and control to set farm data category:

- Display current category as a badge (Live = green, Demo = blue)
- Add dropdown or toggle to change category per farm
- Bulk action to set multiple farms at once

```text
┌─────────────────────────────────────────────────────────┐
│ Farm Oversight                                           │
│ ┌─────────┬─────────┬────────────┬─────────────────────┐│
│ │ Farm    │ Region  │ Category   │ Actions             ││
│ ├─────────┼─────────┼────────────┼─────────────────────┤│
│ │ Green   │ IV-A    │ 🟢 Live    │ [▼ Set Category]   ││
│ │ TF-001  │ IV-A    │ 🔵 Demo    │ [▼ Set Category]   ││
│ └─────────┴─────────┴────────────┴─────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### 2. Government Dashboard: Data Source Selector

**File**: `src/pages/GovernmentDashboard.tsx`

Add a prominent data source selector in the filter bar:

```text
┌───────────────────────────────────────────────────────────┐
│ Government Portal                                          │
│                                                            │
│ Data Source: [Live Data ▼]   Region: [All ▼]   Date: ... │
│              ├─ Live Data (Production)                    │
│              ├─ Demo Data (Test/Demo)                     │
│              └─ All Data                                  │
└───────────────────────────────────────────────────────────┘
```

State management:
- Store selection in URL params (`?data_source=live|demo|all`)
- Pass to all government hooks as new parameter
- Default to `live` for production-accurate view

### 3. Update Government Hooks

**Files to modify**:
- `src/hooks/useGovernmentStats.ts`
- `src/hooks/useBreedingStats.ts`
- `src/hooks/useGovernmentHealthStats.ts`
- `src/hooks/useGrantAnalytics.ts`

Add `dataCategory?: 'live' | 'demo' | 'all'` parameter:

```typescript
export const useGovernmentStats = (
  startDate: Date,
  endDate: Date,
  region?: string,
  province?: string,
  municipality?: string,
  dataCategory?: 'live' | 'demo' | 'all',  // NEW
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: ["government-stats", ..., dataCategory || "live"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_government_stats", {
        ...
        data_category_filter: dataCategory === 'all' ? null : (dataCategory || 'live')
      });
    }
  });
};
```

---

## Files to Modify

| File | Change |
|------|--------|
| **Database** | Add `data_category` column, update RPCs, update view |
| `src/components/admin/FarmOversight.tsx` | Add category badge + dropdown control |
| `src/pages/GovernmentDashboard.tsx` | Add data source selector, pass to hooks |
| `src/hooks/useGovernmentStats.ts` | Add `dataCategory` parameter |
| `src/hooks/useBreedingStats.ts` | Add `dataCategory` parameter |
| `src/hooks/useGovernmentHealthStats.ts` | Add `dataCategory` parameter |
| `src/hooks/useGrantAnalytics.ts` | Add farm join filter for data_category |
| `src/components/government/GovDashboardOverview.tsx` | Receive and display category context |

---

## Implementation Summary

1. **Database migration**: Add column, update RPCs, update view
2. **Admin UI**: Category badge and dropdown in Farm Oversight
3. **Government UI**: Data source dropdown selector
4. **Hooks**: Pass data category filter to all government queries
5. **Auto-migration**: Mark existing `[TEST]` farms as demo

---

## Testing Checklist

- [ ] Admin can see current category for each farm
- [ ] Admin can change farm category (live ↔ demo)
- [ ] Government dashboard defaults to "Live Data"
- [ ] Switching to "Demo Data" shows only demo farms' statistics
- [ ] "All Data" shows combined statistics
- [ ] URL persists data source selection
- [ ] Existing `[TEST]` farms are auto-categorized as demo
- [ ] New farms default to `live`

