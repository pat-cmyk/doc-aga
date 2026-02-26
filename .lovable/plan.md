

# Full SSOT Read-Path Audit: `src/hooks/`

Comprehensive audit of all 80+ hooks against the read-path classification rules from Section 3.5 of `ssot-architecture.md`.

---

## Audit Methodology

Each hook that calls `supabase.from()` or `supabase.rpc()` was checked for:
1. **Read hooks**: Does it follow the correct pattern for its category (cache-first vs online-only)?
2. **Mutation hooks**: Does it route through `CacheManager.invalidateForMutation()`?
3. **Documentation**: Does it have the correct `@online-only` header or cache-first comments?

---

## COMPLIANT Hooks (No Action Needed)

### Category A -- Farm-Level (Cache-First) -- COMPLIANT
| Hook | Status |
|------|--------|
| `useUpcomingAlerts` | Cache-first via IndexedDB |
| `useFeedInventory` | Cache-first via IndexedDB |
| `useMilkInventory` | Cache-first via IndexedDB |
| `useExpenses` | Uses CacheManager for mutations |
| `useRevenues` | Uses CacheManager for mutations |
| `useBodyConditionScores` | Uses CacheManager for mutations |
| `useHeatRecords` | Uses CacheManager for mutations |

### Category B -- Government/Regional -- COMPLIANT (Online-Only)
| Hook | Has `@online-only` header |
|------|--------------------------|
| `useGovernmentStats` | Yes |
| `useGovernmentMilkAnalytics` | Yes |
| `useGovernmentHealthStats` | Yes |
| `useRegionalStats` | Yes |
| `useRegionalDataQuality` | Yes |
| `useRegionalFeedSecurity` | Yes |
| `useRegionalPCRS` | Yes |
| `useBreedingStats` | Yes |
| `useFarmComplianceMetrics` | Yes |

### Category C -- Cooperative -- COMPLIANT
| Hook | Has `@online-only` header |
|------|--------------------------|
| `useCooperative` (all sub-hooks) | Yes |

---

## VIOLATIONS FOUND

### Violation Type 1: Missing `@online-only` Header (Government/Regional Hooks)

These hooks aggregate cross-farm data (they import `DataCategory` from government types or use region/province filters) but lack the `@online-only` documentation header:

| Hook | Evidence | Priority |
|------|----------|----------|
| `useRegionalMarketPrices` | Uses `DataCategory`, region filters, calls `get_regional_market_prices` RPC | Medium |
| `useRegionalInvestment` | Uses `DataCategory`, region filters | Medium |
| `useDataEntryAnalytics` | Uses `DataCategory`, region/province/municipality filters | Medium |
| `useGrantAnalytics` | Uses `DataCategory`, region filters | Medium |
| `useGrantEffectiveness` | Uses `DataCategory`, region filters | Medium |
| `useVeterinaryExpenseHeatmap` | Uses `DataCategory`, aggregates across municipalities | Medium |
| `useWeightDataCompleteness` | Queries by `farmId` but appears to be government-facing | Low |
| `useSTTAnalytics` | Admin-level analytics, cross-farm | Low |
| `useSystemHealth` | Admin metrics, uses `DataCategory` | Low |
| `useGovAnalyticsAuditLog` | Government audit log | Low |

**Fix**: Add `@online-only` header to each. No code logic changes needed.

### Violation Type 2: Farm-Level Hooks Missing Cache-First Pattern

These serve farmer-facing pages, are scoped to a single farm, but query Supabase directly without checking IndexedDB:

| Hook | Scope | Priority |
|------|-------|----------|
| `useCurrentMarketPrice` (in `useMarketPrices.ts`) | Farm + livestock type | Medium |
| `useHerdValuationUnified` | Farm-scoped, uses market price RPC | Medium |
| `useBioCardData` | Animal-scoped (farm context) | Medium |
| `useBreedingAnalytics` | Farm-scoped | Medium |
| `useAnimalExpenses` | Farm + animal scoped | Low |
| `useAnimalCostAggregates` | Farm-scoped | Low |
| `useProfitability` | Farm-scoped | Low |
| `useFinancialHealth` | Farm-scoped | Low |
| `useProducts` | User/merchant-scoped | Low |
| `useOrders` | User-scoped | Low |
| `useBarns` | Farm-scoped | Low |
| `useFarmSettings` | Farm-scoped | Low |
| `useDailyChecklist` | Farm-scoped | Low |
| `usePendingActivities` | Farm-scoped | Low |

**Fix**: Implement cache-first pattern (IndexedDB check, online fetch, cache update). Add cache functions to `dataCache.ts` and register in `CacheManager.CACHE_DEPENDENCIES`.

### Violation Type 3: Mutations Bypassing CacheManager

These mutation hooks use manual `queryClient.invalidateQueries()` instead of routing through `CacheManager.invalidateForMutation()`:

| Hook | Mutation | Priority |
|------|----------|----------|
| `useMarketPrices` (`useAddLocalPrice`) | Inserts market price, manual invalidation | High |
| `useAnimalExpenses` | Add/delete animal expenses, manual invalidation | Medium |
| `useFarmSettings` | Update farm settings, manual invalidation | Low |
| `useBarns` | Add/update/delete barns, manual invalidation | Low |
| `useDailyChecklist` | Toggle checklist items, manual invalidation | Low |
| `usePendingActivities` | Approve/reject/delete/resubmit, manual invalidation | Low |
| `useMerchantOrders` | Update order status, manual invalidation | Low |
| `useMerchantProducts` | CRUD products, manual invalidation | Low |
| `useInvoices` | Create/update invoices, manual invalidation | Low |
| `usePlatformSettings` | Update settings, manual invalidation | Low |
| `useFarmerFeedback` | Submit feedback, manual invalidation | Low |
| `useGovernmentFeedback` | Update status, manual invalidation | Low |

**Fix**: Add mutation types to `CACHE_DEPENDENCIES` in `cacheManager.ts` and route through `getCacheManager().invalidateForMutation()`.

---

## Recommended Implementation Phases

### Phase 1: Documentation-Only Fixes (Low Risk, Fast)
Add `@online-only` headers to 10 government/admin hooks. No logic changes.

### Phase 2: High-Priority Mutation Fix
Route `useAddLocalPrice` through CacheManager. Add `'market-price'` to `CACHE_DEPENDENCIES`.

### Phase 3: Medium-Priority Cache-First Refactors
Implement cache-first for `useCurrentMarketPrice`, `useHerdValuationUnified`, `useBioCardData`, `useBreedingAnalytics`.

### Phase 4: Remaining Mutation Fixes
Route `useAnimalExpenses` and other farm-level mutation hooks through CacheManager.

### Phase 5: Low-Priority Cache-First + Doc Updates
Cache-first for remaining farm hooks (`useBarns`, `useFarmSettings`, `useDailyChecklist`, etc.). Update the Hook Inventory table in `ssot-architecture.md`.

---

## Summary

| Category | Total | Compliant | Violations |
|----------|-------|-----------|------------|
| Category A (Farm, cache-first reads) | ~21 | 7 | 14 missing cache-first |
| Category B (Gov/Regional, online-only) | ~19 | 9 | 10 missing `@online-only` header |
| Category C (Cooperative) | 1 | 1 | 0 |
| Mutations (CacheManager) | ~16 | 4 | 12 bypassing CacheManager |

