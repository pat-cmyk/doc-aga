

# Google Anti-Gravity Audit: Refactoring Plan

## Build Errors (Immediate Fixes)

Two TypeScript errors blocking the build:

### Fix 1: `seed-demo-data/index.ts` (line 410)
The `error` variable in the catch block is typed as `unknown`. Cast it to access `.message`.

**Change:** `error.message` to `(error as Error).message`

### Fix 2: `analyst-tools.ts` (line 1882-1883)
The inline object literal `{ prices: [], latest: 0, ... }` infers `prices` as `never[]`. Add explicit typing.

**Change:** Type the default object so `prices` is `number[]`:
```typescript
const current = pricesByRegionSpecies.get(key) || { prices: [] as number[], latest: 0, region: p.region || 'Unknown', species };
```

---

## SSOT Read-Path Violations (Audit Finding #2)

The audit identified hooks that query the backend directly without checking IndexedDB cache first. These fall into **three categories** with different refactoring priorities:

### Category A: Farm-Level Hooks (Should Use Cache-First Pattern)
These serve farmer-facing pages and must work offline. They should follow the same pattern as `useHealthRecords.ts` (cache first, then fetch if online).

| Hook | Current Behavior | Priority |
|------|-----------------|----------|
| `useUpcomingAlerts.ts` | Direct RPC call | High |
| `useFeedInventory.ts` | Direct RPC call (has partial cache in `dataCache`) | High |
| `useBioCardData.ts` | Direct RPC for market price | Medium |
| `useHerdValuationUnified.ts` | Direct RPC for market price | Medium |
| `useBreedingAnalytics.ts` | Direct computations from Supabase | Medium |
| `useProducts.ts` | Direct query to products table | Low |
| `useOrders.ts` | Direct query to orders table | Low |

**Refactoring pattern** (for each hook):
1. Add a corresponding cache function in `dataCache.ts` (e.g., `getCachedAlerts`, `updateAlertsCache`)
2. In the hook's `queryFn`, call the cache getter first
3. If online, fetch fresh data and update cache
4. If offline and no cache, return empty/null gracefully

### Category B: Government/Regional Hooks (Online-Only is Acceptable)
These serve government dashboards that aggregate data across farms. Caching cross-farm data locally would be a security concern and unnecessary since government users always need live data.

| Hook | Recommendation |
|------|---------------|
| `useGovernmentStats.ts` | No change needed -- online-only is correct |
| `useGovernmentMilkAnalytics.ts` | No change needed |
| `useGovernmentHealthStats.ts` | No change needed |
| `useRegionalStats.ts` | No change needed |
| `useRegionalDataQuality.ts` | No change needed |
| `useRegionalFeedSecurity.ts` | No change needed |
| `useRegionalPCRS.ts` | No change needed |
| `useBreedingStats.ts` | No change needed |
| `useFarmComplianceMetrics.ts` | No change needed |

**Action:** Add a comment header to each confirming "online-only by design" so future audits don't flag them.

### Category C: Cooperative Hooks (Online-Only is Acceptable)
`useCooperative.ts` aggregates data across member farms via SECURITY DEFINER RPCs. Caching this cross-farm data locally would violate RLS boundaries.

**Action:** Add "online-only by design" comment headers.

---

## Recommended Implementation Sequence

1. **Phase 1 -- Build fixes** (immediate): Fix the two TypeScript errors
2. **Phase 2 -- High-priority cache-first refactors**: `useUpcomingAlerts`, `useFeedInventory`
3. **Phase 3 -- Medium-priority cache-first refactors**: `useBioCardData`, `useHerdValuationUnified`, `useBreedingAnalytics`
4. **Phase 4 -- Documentation**: Add "online-only by design" comments to government/cooperative hooks; update `docs/ssot-architecture.md`

---

## Technical Details

### New `dataCache.ts` additions needed (Phase 2-3):
- `getCachedUpcomingAlerts(farmId)` / `updateUpcomingAlertsCache(farmId)`
- `getCachedMarketPrices(farmId, livestockType)` / `updateMarketPricesCache(...)`
- `getCachedBreedingAnalytics(farmId)` / `updateBreedingAnalyticsCache(...)`

### IndexedDB schema extension:
Add new object stores to the existing `DocAgaDB` schema: `upcoming_alerts`, `market_prices`, `breeding_analytics`

### CacheManager updates:
Add new mutation types to `CACHE_DEPENDENCIES` in `cacheManager.ts`:
- `'alert-schedule'`: invalidates `['upcoming-alerts', 'dashboard']`
- `'market-price'`: invalidates `['market-prices', 'herd-valuation']`

