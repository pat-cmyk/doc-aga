

# Fix: Update TypeScript Interface to Match Updated RPC

## Problem Summary

The map pins are not showing because the `useRegionalStats` hook's TypeScript interface still references **old column names** that no longer exist after the RPC function was updated. This causes the data aggregation to fail silently.

## Root Cause

| Interface Has (OLD) | RPC/View Actually Returns (NEW) |
|---------------------|--------------------------------|
| `animal_count` | (removed - use `active_animal_count`) |
| `health_events_7d` | (removed) |
| `health_events_30d` | (removed) |
| `lgu_code` | (removed) |
| `ffedis_id` | (removed) |
| `validation_status` | (removed) |
| `validated_at` | (removed) |
| — | `livestock_type` (NEW) |
| — | `created_at` (NEW) |
| — | `is_deleted` (NEW) |
| — | `cattle_count` (NEW) |
| — | `goat_count` (NEW) |
| — | `carabao_count` (NEW) |
| — | `sheep_count` (NEW) |

The code on lines 85-88 tries to access `farm.animal_count` which is undefined, causing `animalCount` to be 0 for all regions.

## Solution

### 1. Update TypeScript Interface

Update `GovFarmAnalyticsRow` to match the actual RPC return type:

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

### 2. Update Aggregation Logic

Fix the aggregation to use the correct column names and derive total animal count from species counts:

```typescript
// Calculate total animal count from species counts
const totalAnimals = (farm.cattle_count || 0) + 
                     (farm.goat_count || 0) + 
                     (farm.carabao_count || 0) + 
                     (farm.sheep_count || 0);

existing.animalCount += totalAnimals;
existing.activeAnimalCount += farm.active_animal_count || 0;
// Remove health_events references (no longer available)
```

### 3. Update RegionalStats Interface

Since `health_events_7d` and `health_events_30d` are no longer available from the view, either:
- Remove them from the `RegionalStats` interface, OR
- Set them to 0 as placeholders

I'll remove them since they're not being displayed on the map.

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useRegionalStats.ts` | Update interface and aggregation logic |

## Demo Farm GPS Data Status

All 15 demo farms have valid GPS coordinates:
- **NCR**: 1 farm (nXscale Farm)
- **Region IV-A**: 12 farms across Batangas, Cavite, Laguna, Quezon, Rizal
- **Region VIII**: 2 farms in Eastern Samar and Samar

After this fix, pins should appear for these 3 regions when "Demo Data" is selected.

## Expected Outcome

- Map shows pins for all regions with farms
- Demo filter shows pins for NCR, Region IV-A, Region VIII
- Marker sizes correctly reflect farm counts
- Clicking pins opens regional detail panel

