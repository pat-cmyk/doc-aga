

# Fix: RPC Return Type Mismatch Preventing Map Pins

## Problem Summary

The Regional Livestock Map shows no pins because the `get_gov_farm_analytics_with_audit` RPC function is returning a **400 error**:

```
"structure of query does not match function result type"
"Returned type numeric(9,6) does not match expected type double precision in column 6"
```

## Root Cause

The `get_gov_farm_analytics_with_audit` function's return type signature is out of sync with the actual `gov_farm_analytics` view.

### Mismatches Found

| Column | Function Declares | View Actually Returns |
|--------|------------------|----------------------|
| `gps_lat` | DOUBLE PRECISION | NUMERIC(9,6) |
| `gps_lng` | DOUBLE PRECISION | NUMERIC(9,6) |
| `data_category` | (missing) | TEXT |
| `livestock_type` | (missing) | TEXT |
| `cattle_count` | (missing) | BIGINT |
| `goat_count` | (missing) | BIGINT |
| `carabao_count` | (missing) | BIGINT |
| `sheep_count` | (missing) | BIGINT |
| `lgu_code` | TEXT | (doesn't exist) |
| `ffedis_id` | TEXT | (doesn't exist) |
| `validation_status` | TEXT | (doesn't exist) |
| `validated_at` | TIMESTAMPTZ | (doesn't exist) |
| `animal_count` | BIGINT | (doesn't exist) |
| `health_events_7d` | BIGINT | (doesn't exist) |
| `health_events_30d` | BIGINT | (doesn't exist) |

## Solution

### 1. SQL Migration

Drop and recreate the RPC function with the correct return type matching the view's actual structure:

```sql
DROP FUNCTION IF EXISTS public.get_gov_farm_analytics_with_audit(TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.get_gov_farm_analytics_with_audit(
    _access_type TEXT DEFAULT 'view',
    _metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    region TEXT,
    province TEXT,
    municipality TEXT,
    gps_lat NUMERIC(9,6),        -- Fixed: was DOUBLE PRECISION
    gps_lng NUMERIC(9,6),        -- Fixed: was DOUBLE PRECISION
    livestock_type TEXT,          -- Added
    created_at TIMESTAMPTZ,       -- Added
    is_deleted BOOLEAN,           -- Added
    is_program_participant BOOLEAN,
    program_group TEXT,
    data_category TEXT,           -- Added: required for filtering
    active_animal_count BIGINT,
    cattle_count BIGINT,          -- Added
    goat_count BIGINT,            -- Added
    carabao_count BIGINT,         -- Added
    sheep_count BIGINT            -- Added
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
...
    RETURN QUERY SELECT * FROM gov_farm_analytics;
END;
$$;
```

### 2. Update TypeScript Interface

Update `useRegionalStats.ts` to match the new column structure:

```typescript
interface GovFarmAnalyticsRow {
  id: string;
  name: string;
  region: string;
  province: string;
  municipality: string;
  gps_lat: number | null;
  gps_lng: number | null;
  livestock_type: string | null;
  created_at: string;
  is_deleted: boolean;
  is_program_participant: boolean | null;
  program_group: string | null;
  data_category: string;
  active_animal_count: number;
  cattle_count: number;
  goat_count: number;
  carabao_count: number;
  sheep_count: number;
}
```

## Files to Modify

| File | Change |
|------|--------|
| New SQL Migration | Recreate RPC function with correct return type |
| `src/hooks/useRegionalStats.ts` | Update TypeScript interface to match new columns |

## Expected Outcome

After fix:
- The RPC call succeeds (no more 400 error)
- Demo farms with GPS coordinates appear as pins on the map
- Data category filtering works correctly (Demo, Live, All)

## Testing Checklist

- [ ] RPC returns data successfully (no 400 error)
- [ ] Map shows pins for Demo farms (should see 15 farms across Region IV-A, Region VIII, NCR)
- [ ] Map shows pins for Live farms
- [ ] Map shows all pins when "All Data" selected
- [ ] Clicking pins opens regional detail panel

