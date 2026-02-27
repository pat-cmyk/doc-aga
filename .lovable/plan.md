
# Fix: Feed Toggle Missing — Promote Feed to SSOT Parity with Milk

## Status: ✅ COMPLETED

## What was done

1. **DB Schema**: Added `total_feed_kg` and `feed_animal_count` columns to `daily_farm_stats`
2. **Trigger**: Created `aggregate_feed_to_daily_stats` trigger on `feeding_records` (INSERT/UPDATE/DELETE)
3. **Backfill**: Populated historical feed data from existing `feeding_records`
4. **RPC Updated**: `get_combined_dashboard_data` now returns `feedTotalKg` and `feedAnimalCount` per day from `daily_farm_stats`
5. **Functions Updated**: `ensure_farm_stats` and `calculate_daily_farm_stats` now include feed columns
6. **IndexedDB Cache**: Added `dailyFeed` to `DashboardStatsCache`, bumped version to 10
7. **Client Cleanup**: Removed `fetchAndMergeFeedData()` and raw `feeding_records` query from `useCombinedDashboardData.ts`

## Architecture (After)

```text
FEED (now matches milk pattern):
  feeding_records INSERT/UPDATE/DELETE
    -> DB trigger -> daily_farm_stats.total_feed_kg + feed_animal_count
    -> get_combined_dashboard_data RPC includes feed columns
    -> IndexedDB cache (dailyFeed)
    -> Chart renders immediately from cache
    -> Toggle always visible, even offline
```
