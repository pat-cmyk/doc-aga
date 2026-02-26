

# Phase 3: Cache-First Refactoring for Medium-Priority Hooks

## Scope

Implement the IndexedDB cache-first pattern for 3 of the 4 planned hooks, plus a documentation-only fix for the 4th.

| Hook | Approach | Risk |
|------|----------|------|
| `useCurrentMarketPrice` | New `marketPrice` IndexedDB store + cache-first pattern | Low |
| `useHerdValuationUnified` | New `herdValuation` IndexedDB store + cache-first pattern | Medium |
| `useBreedingAnalytics` | New `breedingAnalytics` IndexedDB store + cache-first pattern | Medium |
| `useBioCardData` | Documentation-only (defer to Phase 5) | None |

### Why defer `useBioCardData`?

`useBioCardData` is a **composition hook** — it aggregates data from 6+ sub-hooks/queries that are **animal-scoped** (not farm-scoped). Several of its sub-hooks (`useUpcomingAlerts`, `useHeatRecords`, `useBodyConditionScores`) are already cache-first compliant. The remaining direct queries (milking sparkline, weight sparkline, AI records, OVR cache) are small, animal-level fetches that don't fit the farm-keyed IndexedDB pattern. Forcing a cache here would require a new animal-keyed store with complex invalidation. Better handled in Phase 5 with a dedicated design.

---

## Changes

### 1. `src/lib/dataCache.ts` — Add 3 new cache stores + helpers

**Schema changes (DB version 4 -> 5):**
- Add `marketPriceCache` store (keyed by `farmId`)
- Add `herdValuationCache` store (keyed by `farmId`)  
- Add `breedingAnalyticsCache` store (keyed by `farmId`)

**New interfaces:**
- `MarketPriceCacheEntry` — stores `{ farmId, livestockType, price, source, effectiveDate, lastUpdated, syncStatus }`
- `HerdValuationCacheEntry` — stores the full `UnifiedHerdValuation` result + metadata
- `BreedingAnalyticsCacheEntry` — stores the full analytics result + metadata

**New TTLs:**
- `marketPrice`: 30 minutes (prices change infrequently)
- `herdValuation`: 10 minutes (depends on market price + animal weights)
- `breedingAnalytics`: 15 minutes (derived analytics, moderate freshness)

**New functions (6 total, following existing pattern):**
- `getCachedMarketPrice(farmId)` / `updateMarketPriceCache(farmId, data)`
- `getCachedHerdValuation(farmId)` / `updateHerdValuationCache(farmId, data)`
- `getCachedBreedingAnalytics(farmId)` / `updateBreedingAnalyticsCache(farmId, data)`
- `clearMarketPriceCache(farmId)` / `clearHerdValuationCache(farmId)` / `clearBreedingAnalyticsCache(farmId)`

### 2. `src/lib/cacheManager.ts` — Register new cache dependencies

**Update `clearIndexedDBCache`** to handle new cache keys:
- `'market-price'` -> `clearMarketPriceCache(farmId)`
- `'herd-valuation'` -> `clearHerdValuationCache(farmId)`
- `'breeding-analytics'` -> `clearBreedingAnalyticsCache(farmId)`

**Update `CACHE_DEPENDENCIES`** — add `'herd-valuation-unified'` and `'breeding-analytics'` to relevant mutation types (weight-record, ai-record, animal, market-price).

### 3. `src/hooks/useMarketPrices.ts` — Cache-first for `useCurrentMarketPrice`

Refactor `queryFn` to follow the `useUpcomingAlerts` pattern:
1. Check `getCachedMarketPrice(farmId)` first
2. If offline, return cache
3. If online, fetch from `get_market_price` RPC
4. Update cache via `updateMarketPriceCache(farmId, result)`
5. Graceful empty fallback if offline + no cache

Import `useOnlineStatus` hook.

### 4. `src/hooks/useHerdValuationUnified.ts` — Cache-first

Refactor `queryFn`:
1. Check `getCachedHerdValuation(farmId)` first
2. If offline, return cached `UnifiedHerdValuation`
3. If online, run existing 3-way parallel fetch + computation
4. Update cache via `updateHerdValuationCache(farmId, result)`
5. Offline fallback: return cached data or `getEmptyValuation()`

Import `useOnlineStatus` hook.

### 5. `src/hooks/useBreedingAnalytics.ts` — Cache-first

This hook has 4 dependent queries. The cache-first pattern wraps the **outer result**, not individual queries:
1. Add a top-level `useQuery` that:
   - Checks `getCachedBreedingAnalytics(farmId)` first
   - If offline, returns cached result
   - If online, runs all 4 existing queries via direct Supabase calls (not sub-hooks), computes analytics, caches result
2. Refactor from 4 separate `useQuery` calls into a single consolidated `useQuery` with internal parallel fetches (same pattern as `useHerdValuationUnified`)
3. Update cache on success

### 6. `src/hooks/useBioCardData.ts` — Documentation header only

Add a comment block explaining:
- This is a composition hook; sub-hooks handle their own caching
- Direct queries (milking/weight sparklines, AI records, OVR cache) are animal-scoped
- Full cache-first deferred to Phase 5

### 7. Documentation updates

**`docs/ssot-architecture.md`** — Update Hook Inventory table:
- `useCurrentMarketPrice`: Category A (cache-first) -- mark compliant
- `useHerdValuationUnified`: Category A (cache-first) -- mark compliant
- `useBreedingAnalytics`: Category A (cache-first) -- mark compliant
- `useBioCardData`: Category A (composition, partial -- deferred)

**`changelog.md`** — Add Phase 3 entry.

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| IndexedDB version bump (4->5) breaks existing users | `upgrade()` function handles migration incrementally; existing stores untouched |
| `useBreedingAnalytics` refactor from 4 queries to 1 changes data flow | Computation logic (calculateSPC, calculateHDR, etc.) remains identical; only fetch orchestration changes |
| Stale cache served after mutation | All 3 hooks registered in `CACHE_DEPENDENCIES`; CacheManager clears on relevant mutations |

