
# Fix: Region IV-A Farms Missing from Livestock Map

## Root Cause

The farm "HVSALUBAYBA" in Region IV-A has GPS coordinates `(0.000000, 0.000000)` -- a null island coordinate in the Gulf of Guinea off Africa's coast. The `toNum()` helper in `useRegionalStats.ts` treats `0` as a valid finite number, so it gets included in the region's coordinate average.

With 10 Region IV-A farms, this pulls the averaged marker position to approximately **(lat 12.69, lng 109.04)** -- in the South China Sea, west of the visible map area at the default zoom level. That is why the marker is invisible: it is rendered off-screen.

The NCR farms both have valid Manila-area coordinates, so their marker displays correctly.

## Solution

Filter out `(0, 0)` GPS coordinates in the averaging logic inside `useRegionalStats.ts`. No Philippine farm can be located at latitude 0, longitude 0, so these should be treated as "no GPS data available" -- the same as `null`.

This is a 2-line change in the existing coordinate validity check.

### File: `src/hooks/useRegionalStats.ts`

**Current code (lines 112-113):**
```typescript
if (lat !== null && lng !== null) {
```

**Updated code:**
```typescript
if (lat !== null && lng !== null && !(lat === 0 && lng === 0)) {
```

This skips the `(0, 0)` coordinate from the average calculation. With HVSALUBAYBA excluded from coordinate averaging, the remaining 9 Region IV-A farms all have valid Philippine coordinates (~13.9-14.6 lat, ~121.0-121.3 lng), producing a correct marker position near Laguna/Batangas.

### Why This Is Safe
- Follows SSOT: the same aggregation logic (lines 86-119) remains intact; only the coordinate validity guard is tightened
- No other files change -- the `RegionalLivestockMap` component, `getRegionalCoordinates` fallback, and all downstream consumers remain untouched
- The farm still counts toward `farm_count` and `animal_count` -- only its GPS contribution is excluded
- The fallback logic (lines 134-136) for regions with zero valid coordinates already exists and would correctly use the predefined `Region IV-A` center point if needed

### Verification
- After fix: Region IV-A marker should appear near Laguna (~14.1, 121.1) with "10" label
- NCR marker unchanged at (~14.6, 121.0) with "2" label
- Click both markers to confirm RegionalDetailPanel opens with correct stats
