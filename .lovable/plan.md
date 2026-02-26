

# Phase 5: Low-Priority Cache-First + Final Documentation

## Reassessment

After reviewing all 10 hooks, only **3 are good candidates** for IndexedDB cache-first. The remaining 7 have architectural reasons (date-range parameters, no farmId, realtime subscriptions, animal-scoped keys) that make farm-keyed IndexedDB caching either impossible or counterproductive. These get documentation headers instead.

---

## Group A: Implement Cache-First (3 hooks)

| Hook | Key | TTL | Rationale |
|------|-----|-----|-----------|
| `useAnimalCostAggregates` | `farmId` | 15 min | Stable farm-scoped aggregate; benefits offline |
| `useBarns` | `farmId` | 30 min | Stable structure data; rarely changes |
| `useFarmSettings` | `farmId` | 60 min | Very stable; almost never changes |

## Group B: Documentation-Only (7 hooks)

| Hook | Header | Reason |
|------|--------|--------|
| `useAnimalExpenses` | `@cache-status ANIMAL-SCOPED` | Keyed by `animalId`, not `farmId`; doesn't fit farm-keyed IndexedDB |
| `useProfitability` | `@cache-status PARAMETERIZED` | Date-range dependent; can't key by farmId alone |
| `useFinancialHealth` | `@cache-status PARAMETERIZED` | Date-range dependent; same issue |
| `useProducts` | `@cache-status MANUAL` | Marketplace-scoped, no farmId |
| `useOrders` | `@cache-status MANUAL` | User-scoped, no farmId |
| `useDailyChecklist` | Already `@cache-status MANAGED` | Date-specific + auto-completion from sub-hooks; too dynamic |
| `usePendingActivities` | Already `@cache-status MANAGED` | Realtime subscriptions; caching would conflict |

---

## Changes

### 1. `src/lib/dataCache.ts` -- Add 3 new cache stores (DB version 5 -> 6)

New stores: `animalCostCache`, `barnsCache`, `farmSettingsCache`

New interfaces:
- `AnimalCostCacheEntry { farmId, data: FarmCostAnalysis, lastUpdated, syncStatus }`
- `BarnsCacheEntry { farmId, data: Barn[], lastUpdated, syncStatus }`
- `FarmSettingsCacheEntry { farmId, data: FarmSettings, lastUpdated, syncStatus }`

New helper functions (9 total):
- `getCachedAnimalCosts(farmId)` / `updateAnimalCostCache(farmId, data)` / `clearAnimalCostCache(farmId)`
- `getCachedBarns(farmId)` / `updateBarnsCache(farmId, data)` / `clearBarnsCache(farmId)`
- `getCachedFarmSettings(farmId)` / `updateFarmSettingsCache(farmId, data)` / `clearFarmSettingsCache(farmId)`

### 2. `src/lib/cacheManager.ts` -- Register new IndexedDB clear functions

Add cases in `clearIndexedDBCache`:
- `'animal-cost-aggregates'` -> `clearAnimalCostCache(farmId)`
- `'barns'` -> `clearBarnsCache(farmId)`
- `'farm-settings'` -> `clearFarmSettingsCache(farmId)`

### 3. `src/hooks/useAnimalCostAggregates.ts` -- Cache-first refactor

- Import `useOnlineStatus`, `getCachedAnimalCosts`, `updateAnimalCostCache`
- In `queryFn`: check cache first, return if offline, fetch from Supabase if online, update cache
- Add `@cache-status MANAGED` header

### 4. `src/hooks/useBarns.ts` -- Cache-first for `useBarns` query

- Import `useOnlineStatus`, `getCachedBarns`, `updateBarnsCache`
- In `useBarns` queryFn: check cache first, return if offline, fetch + update cache if online
- Mutation hooks already route through CacheManager (Phase 4)

### 5. `src/hooks/useFarmSettings.ts` -- Cache-first for `useFarmSettings` query

- Import `useOnlineStatus`, `getCachedFarmSettings`, `updateFarmSettingsCache`
- In queryFn: check cache first, return default if offline + no cache, fetch + update cache if online

### 6. Documentation headers for Group B hooks

Add appropriate `@cache-status` headers to:
- `useAnimalExpenses.ts` -- already has `@cache-status MANAGED`; add note about read path being animal-scoped
- `useProfitability.ts` -- `@cache-status PARAMETERIZED -- Date-range dependent, not suitable for farm-keyed IndexedDB`
- `useFinancialHealth.ts` -- same as above
- `useProducts.ts` -- `@cache-status MANUAL -- Marketplace-scoped, no farmId`
- `useOrders.ts` -- `@cache-status MANUAL -- User-scoped, no farmId`

### 7. Documentation updates

- `docs/ssot-architecture.md`: Update Hook Inventory to mark all 10 hooks with final status
- `changelog.md`: Add Phase 5 entry, mark SSOT Read-Path Audit as complete

---

## Technical Details

### IndexedDB Schema (version 6)

```text
animalCostCache    keyed by farmId    TTL: 15 min
barnsCache         keyed by farmId    TTL: 30 min
farmSettingsCache  keyed by farmId    TTL: 60 min
```

### Cache-First Pattern (same as Phase 3)

```text
1. Check IndexedDB cache (within TTL)
2. If cache hit + online: return cache, fetch in background
3. If cache hit + offline: return cache
4. If cache miss + online: fetch from Supabase, update cache, return
5. If cache miss + offline: return empty/default
```

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| IndexedDB version bump (5 -> 6) | Incremental `upgrade()` handler; existing stores untouched |
| `useBarns` has animal counts from join query | Cache the computed result (barn + count); invalidated on barn mutations |
| Over-caching low-traffic data | TTLs are generous (30-60 min); storage cost is minimal |

