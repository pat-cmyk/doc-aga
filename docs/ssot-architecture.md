# SSOT Architecture Reference

> **Living document** — Reflects Section 5 of the Core Operating Protocol.
> Must be kept in sync with `ARCHITECTURE.md`, `changelog.md`, and `/docs/data-relationships-map.md`.

Last updated: 2026-02-26

---

## 1. Dataset Dependency & Continuity Standards

Before modifying ANY field, function, or component, you MUST:

1. **Impact Analysis:** Trace the full data flow: `Table → RPC → Hook → Component`. Identify ALL consumers of the data you are changing.
2. **Connection Continuity:** Ensure backward compatibility. If you rename a column or change an RPC return shape, synchronize ALL downstream consumers (hooks, components, caches) in the SAME change.
3. **Mandatory QA:** Every change must verify: TypeScript compilation, loading/empty states, error boundaries, and correct data propagation through the chain.
4. **Change Summary:** Document modified files, data flow impacts, and specific UI testing points.

---

## 2. Component Reuse (DRY Principle)

- Before creating new UI components, **search the codebase** for existing components that serve the same purpose.
- Shared form components (e.g., `BilingualLabel`, breed selectors, `GenderSelector`, `LactatingToggle`, `WeightHintBadge`) must be reused — never duplicated.
- If the Add form and Edit form share fields, they MUST use the same constants, validation logic, and dropdown options (e.g., `availableBreeds`, `LIVESTOCK_BREEDS`, `getBreedsByLivestockType`).
- When adding a feature to one form (Add or Edit), check if the other form needs the same update for parity.
- All dropdowns must include a "No Data / Walang Data" option where applicable (per `ui/form-dropdown-standard` memory).

### Shared Components Inventory (Animal Forms)

| Component / Constant | Location | Used By |
|----------------------|----------|---------|
| `BilingualLabel` | `src/components/animal-form/BilingualLabel.tsx` | AnimalForm, EditAnimalDialog |
| `GenderSelector` | `src/components/animal-form/GenderSelector.tsx` | AnimalForm, EditAnimalDialog |
| `LactatingToggle` | `src/components/animal-form/LactatingToggle.tsx` | AnimalForm, EditAnimalDialog |
| `WeightHintBadge` | `src/components/animal-form/WeightHintBadge.tsx` | AnimalForm, EditAnimalDialog |
| `LIVESTOCK_BREEDS` / `getBreedsByLivestockType` | `src/components/animal-form/breedConstants.ts` | AnimalForm, EditAnimalDialog |
| `calculateMilkingStageFromDays` | `src/lib/animalStages.ts` | LactatingToggle, AnimalForm, useAnimalForm, useEditAnimalForm, RecordBulkMilkDialog |
| `AnimalAvatar` | `src/components/ui/animal-avatar.tsx` | AnimalDetails, AnimalList, AnimalCard, BioCard, AnimalProfile, ActivityDetailsDialog |

---

## 3. Key SSOT Data Flows

These are critical synchronized data paths. Breaking any link is a blocking bug:

| Domain | SSOT Flow |
|--------|-----------|
| **Milk Revenue** | `milking_records` (sale) → DB trigger → `revenue_ledger` |
| **Animal Weight** | `weight_records` (latest) → DB trigger → `animals.current_weight_kg` |
| **OVR Scores** | `milking/weight/bcs/health/ai records` → `calculate_animal_ovr` SQL trigger → `animal_ovr_cache` → `useBatchOVRSummary` (list) + `useBioCardData` (BioCard/Summary) — **server-side computation ONLY, no client-side calc** |
| **Feed Inventory** | `feeding_records` → `feed_inventory_id` + `cost_per_kg_at_time` (cost locked at consumption) |
| **Milk Feeding** | `milk_inventory` (good/rejected) → `FeedMilkToAnimalDialog` (FIFO) → `feeding_records` (`milk_inventory_id` + `cost_per_kg_at_time`: market price for good, ₱0 for rejected) → `useHerdInvestment` + `useAnimalExpenses` |
| **Herd Investment** | `animals.purchase_cost` + `farm_expenses` (manual) + `feeding_records` (auto-calculated, includes milk feeding) |
| **Feed Stock Days** | Roughage inventory only → `useFeedInventory` hook → survival buffer |
| **Parent Eligibility** | `animals` → filter by gender + (`birth_date` is null OR age >= 16 months) → mother/father dropdowns |
| **AI Father Detection** | `ai_records` (animal_id) → `useEditAnimalForm` → pre-populate `is_father_ai`, brand, reference, breed |
| **Cooperative Aggregation** | `cooperative_memberships` (accepted farms) → SECURITY DEFINER RPCs (`get_cooperative_herd_summary`, `get_cooperative_milk_production`, `get_cooperative_health_overview`, `get_cooperative_financial_summary`) → `useCooperative` hooks → `CooperativeDashboard` tabs. **Note:** Cooperative reads are entirely via SECURITY DEFINER functions and do not touch existing farm RLS policies. |

---

## 3.5 Read-Path Classification

All data-reading hooks fall into one of three categories. New hooks MUST follow the appropriate pattern.

### Categories

| Category | Scope | Pattern | Offline Behavior |
|----------|-------|---------|-----------------|
| **A — Farm-Level** | Single-farm data (farmer-facing) | **Cache-first**: IndexedDB → Supabase if online → update cache | Serves cached data; graceful empty state if no cache |
| **B — Government/Regional** | Cross-farm aggregation | **Online-only** (`@online-only`) | Shows "requires internet" message |
| **C — Cooperative** | Cross-farm via SECURITY DEFINER RPCs | **Online-only** (`@online-only`) | Shows "requires internet" message |

### Canonical Cache-First Pattern (Category A)

```typescript
queryFn: async () => {
  // 1. Check IndexedDB cache first
  const cached = await getCachedData(farmId);
  if (cached) return cached;

  // 2. If online, fetch from Supabase
  if (!navigator.onLine) return fallbackDefault;
  const { data } = await supabase.from('table').select('*').eq('farm_id', farmId);

  // 3. Update local cache
  if (data) await updateDataCache(farmId, data);
  return data ?? fallbackDefault;
}
```

### Rules for New Hooks

- **Farm-scoped?** → Implement cache-first. Add `getCached*` / `update*Cache` in `dataCache.ts`. Register invalidation in `CacheManager.CACHE_DEPENDENCIES`.
- **Cross-farm aggregation?** → Mark `@online-only` in file header. No local cache.

### Hook Inventory (Living Table)

| Hook | Category | Cache Store |
|------|----------|-------------|
| `useUpcomingAlerts` | A | `upcomingAlerts` |
| `useFeedInventory` | A | `feedInventory` |
| `useHealthRecords` | A | `healthRecords` |
| `useMilkInventory` | A | `milkInventory` |
| `useDashboardData` | A | `dashboard` |
| `useAnimals` | A | `animals` |
| `useGovernmentStats` | B | — |
| `useGovernmentMilkAnalytics` | B | — |
| `useGovernmentHealthStats` | B | — |
| `useRegionalStats` | B | — |
| `useRegionalDataQuality` | B | — |
| `useRegionalFeedSecurity` | B | — |
| `useRegionalPCRS` | B | — |
| `useBreedingStats` | B | — |
| `useFarmComplianceMetrics` | B | — |
| `useCooperative` (all sub-hooks) | C | — |
| `useCurrentMarketPrice` | A | `marketPriceCache` |
| `useHerdValuationUnified` | A | `herdValuationCache` |
| `useBreedingAnalytics` | A | `breedingAnalyticsCache` |
| `useBioCardData` | A (composition, partial — deferred to Phase 5) | — |
| `useRegionalMarketPrices` | B | — |
| `useRegionalInvestment` | B | — |
| `useDataEntryAnalytics` | B | — |
| `useGrantAnalytics` | B | — |
| `useGrantEffectiveness` | B | — |
| `useVeterinaryExpenseHeatmap` | B | — |
| `useWeightDataCompleteness` | B | — |
| `useSTTAnalytics` | B | — |
| `useSystemHealth` | B | — |
| `useGovAnalyticsAuditLog` | B | — |
| **Phase 4 Mutation Hooks** | | |
| `useAnimalExpenses` | A (MANAGED — `expense` type + animal-scoped manual; read path ANIMAL-SCOPED) | — |
| `useFarmSettings` | A (MANAGED — `farm-settings` type; cache-first) | `farmSettingsCache` |
| `useBarns` | A (MANAGED — `barn` type; cache-first) | `barnsCache` |
| `useDailyChecklist` | A (MANAGED — `checklist` type) | — |
| `usePendingActivities` | A (MANAGED — `pending-activity` type, conditional) | — |
| `useFarmerFeedback` | A (MANAGED — `farmer-feedback` type) | — |
| `useAnimalCostAggregates` | A (MANAGED — cache-first) | `animalCostCache` |
| `useProfitability` | A (PARAMETERIZED — date-range dependent) | — |
| `useFinancialHealth` | A (PARAMETERIZED — date-range dependent) | — |
| `useProducts` | MANUAL — Marketplace-scoped | — |
| `useOrders` | MANUAL — User-scoped | — |
| `useMerchantOrders` | MANUAL — Merchant-scoped | — |
| `useMerchantProducts` | MANUAL — Merchant-scoped, read-only | — |
| `useInvoices` | MANUAL — Merchant-scoped | — |
| `usePlatformSettings` | MANUAL — Admin-scoped | — |
| `useGovernmentFeedback` | MANUAL — Government-scoped, @online-only | — |

---

## 4. Governance Documents

| Document | Path | Purpose |
|----------|------|---------|
| **Data Relationships Map (DRM)** | `/docs/data-relationships-map.md` | Absolute source of truth for schema, RLS, and data flow. Must be updated on ANY schema, security, or sync logic change. |
| **Architecture** | `ARCHITECTURE.md` | Data hierarchies and system design. |
| **Changelog** | `changelog.md` | All significant changes logged. |
| **SSOT Architecture** | `/docs/ssot-architecture.md` | This file. Component reuse, data flow dependencies, governance rules. |

No task is complete without verifying DRM consistency with the implementation.

---

## 5. Role-Based Access (SSOT for Permissions)

- Four roles: **Owner**, **Manager** (`farmer_owner`), **Farmhand**, **Vet** (`is_vet()` helper).
- `useUnifiedPermissions()` is the SSOT hook for all feature visibility decisions in the UI.
- One role per farm per user. RLS policies enforce farm-level isolation.
- The `is_farm_manager()` SQL function checks `farm_memberships.role_in_farm` (NOT the global `user_roles` table).

---

## 6. Conflict Resolution Flow (Phase 6)

### Pipeline

```text
syncQueue processes item
  ├─ status === 'conflict' → SKIP (resolve via SyncConflictResolution UI)
  ├─ Orphan check: validateAnimalsExist(animalIds)
  │   └─ animal deleted → mark item 'failed' with PARENT_DELETED message
  ├─ Is UPDATE to existing record?
  │   YES → detectConflict(table, recordId, clientTimestamp, clientData)
  │         ├─ has_conflict → recordConflict() → mark item 'conflict'
  │         └─ no conflict → proceed with write
  └─ Is INSERT? → proceed with dedup check + write (existing behavior)
```

### Key Components

| Component | Path | Role |
|-----------|------|------|
| `detectConflict()` | `src/lib/conflictDetection.ts` | RPC call to `detect_sync_conflict` |
| `recordConflict()` | `src/lib/conflictDetection.ts` | Writes to `sync_conflicts` table |
| `checkAndHandleConflict()` | `src/lib/syncService.ts` | Orchestrates detection + recording |
| `validateAnimalsExist()` | `src/lib/syncService.ts` | Batch existence check for parent records |
| `checkForStaleQueueOnOtherDevices()` | `src/lib/syncService.ts` | Queries `check_stale_sync_items` RPC |
| `SyncConflictResolution` | `src/components/sync/` | UI for resolving conflicts |

### Queue Item Statuses

`pending` → `processing` → `completed` | `failed` | `conflict`

- `conflict`: Skipped by sync loop; visible in `SyncConflictResolution` UI; resolved via `resolveConflict()` + `applyConflictResolution()`

### Stale Device Warning

On first online after mount, `App.tsx` calls `checkForStaleQueueOnOtherDevices()` via `check_stale_sync_items` RPC. If pending items exist from another `client_id`, a toast warns the user.
