

# Fix: Feed Toggle Missing — Promote Feed to SSOT Parity with Milk

## Problem

The Feed toggle on the Milk Production chart disappears because feed data is treated as an ephemeral overlay rather than a first-class SSOT dataset. Unlike milk, which has a dedicated aggregated table (`daily_farm_stats.total_milk_liters`) populated by triggers and cached in IndexedDB, feed aggregation happens client-side from raw `feeding_records` on every load, is never persisted, and vanishes offline.

## Architecture Comparison (Current vs Target)

```text
MILK (current - correct pattern):
  milking_records INSERT 
    -> DB trigger -> daily_farm_stats.total_milk_liters (server-side aggregation)
    -> get_combined_dashboard_data RPC reads aggregated table
    -> IndexedDB cache (dailyMilk)
    -> Chart renders immediately from cache
    -> Toggle always visible

FEED (current - broken):
  feeding_records INSERT
    -> NO aggregation table
    -> Client queries raw feeding_records, aggregates in JS
    -> NOT cached in IndexedDB
    -> Toggle missing on cache-fresh or offline loads

FEED (target - matches milk pattern):
  feeding_records INSERT
    -> DB trigger -> daily_farm_stats.total_feed_kg + feed_animal_count (server-side)
    -> get_combined_dashboard_data RPC includes feed columns
    -> IndexedDB cache (dailyFeed)
    -> Chart renders immediately from cache
    -> Toggle always visible, even offline
```

## Implementation Plan

### Step 1: Add feed columns to `daily_farm_stats`

Add two columns to the existing `daily_farm_stats` table:
- `total_feed_kg NUMERIC NOT NULL DEFAULT 0`
- `feed_animal_count INTEGER NOT NULL DEFAULT 0`

This keeps feed data co-located with milk data in the same row (one row per farm per day), consistent with the existing pattern.

### Step 2: Create trigger to aggregate feed on insert/update/delete

Create a database trigger on `feeding_records` that:
1. On INSERT/UPDATE/DELETE, recalculates total feed kg and distinct animal count for that date + farm
2. Upserts the result into `daily_farm_stats`

This mirrors how milk aggregation works — the source of truth is computed server-side, never client-side.

### Step 3: Backfill existing feed data

Run a one-time migration to populate `total_feed_kg` and `feed_animal_count` for all historical dates that already have `feeding_records`, so existing data appears immediately.

### Step 4: Update `get_combined_dashboard_data` RPC

Modify the RPC to include `total_feed_kg` and `feed_animal_count` from `daily_farm_stats` in its `dailyData` response. This eliminates the need for a separate feed query.

### Step 5: Update `useCombinedDashboardData.ts`

- Remove `fetchAndMergeFeedData()` helper entirely (no longer needed — feed comes from RPC)
- Remove the duplicate raw `feeding_records` query in the full-fetch path (lines 213-217)
- Map `total_feed_kg` and `feed_animal_count` from the RPC response into `feedTotalKg` and `feedAnimalCount` on each daily data point

### Step 6: Add `dailyFeed` to IndexedDB cache

- Extend `DashboardStatsCache` in `dataCache.ts` with `dailyFeed: Record<string, { totalKg: number; animalCount: number }>`
- Persist feed data when caching dashboard results
- Load feed data from cache in `buildCombinedDataFromCache` so the toggle appears immediately, even offline
- Bump `DASHBOARD_CACHE_VERSION` to force a refresh

### Step 7: Update CacheManager dependencies

Add `'feed-record'` mutation type to also invalidate `'dashboard'` cache (already present — verified in `cacheManager.ts`). This ensures that when a feeding record is added, the dashboard cache is cleared and the new aggregated feed data is fetched.

## Files Modified

| File | Change |
|------|--------|
| New migration SQL | Add columns, trigger, backfill, update RPC |
| `src/lib/dataCache.ts` | Add `dailyFeed` to cache interface, bump version |
| `src/components/farm-dashboard/hooks/useCombinedDashboardData.ts` | Remove client-side feed queries, read feed from RPC + cache |

## SSOT Compliance

| Data Flow | Status |
|-----------|--------|
| Feed aggregation is server-side (trigger) | Will be fixed |
| Feed data in `daily_farm_stats` (single row per farm per day) | Will be fixed |
| RPC returns feed alongside milk (single query) | Will be fixed |
| IndexedDB caches feed for offline | Will be fixed |
| Client never queries raw `feeding_records` for dashboard | Will be fixed |
| CacheManager invalidates on feed-record mutation | Already correct |

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Trigger on `feeding_records` needs `farm_id` via join to `animals` | Trigger function will join `animals` table to resolve `farm_id`, same pattern as milk triggers |
| Backfill for large datasets could be slow | Single UPDATE with subquery, runs once during migration |
| Existing `ensure_farm_stats` RPC may not account for feed | Will update to include feed columns in its upsert logic |

