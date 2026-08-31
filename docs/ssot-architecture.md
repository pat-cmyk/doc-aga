# SSOT Architecture Reference

> **Living document** — Reflects Section 5 of the Core Operating Protocol.
> Must be kept in sync with `ARCHITECTURE.md`, `changelog.md`, and `/docs/data-relationships-map.md`.

Last updated: 2026-08-07 (Error monitoring & one-tap error tickets — see §3.56)

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

### Government Dashboard Component Inventory (2026-02-28)

| Tab | Section | Components | Primary Hook |
|-----|---------|------------|-------------|
| **Livestock Analytics** | Population Overview | `GovDashboardOverview` (4 cards), `RegionalLivestockMap`, `ComparisonSummary` | `useGovernmentStats` |
| **Livestock Analytics** | Reproduction & Breeding | `HeatDetectionMetrics`, `BreedingOverviewCards`, `BreedingSuccessChart`, `ExpectedDeliveriesTimeline` (with PCRS risk overlay) | `useBreedingStats`, `useRegionalPCRS` |
| **Livestock Analytics** | Animal Health & Welfare | `VaccinationComplianceCard`, `BCSDistributionChart`, `MortalityAnalyticsCard`, `AnimalHealthHeatmap`, `VeterinaryExpenseHeatmap` | `useGovernmentHealthStats`, `useHealthHeatmap` |
| **Livestock Analytics** | Trends & Insights | `GovTrendCharts` (3 charts: Farm Growth, Livestock Composition, Health Events) | `useGovernmentStatsTimeseries` |
| **Farmer Voice** | Stats Header | `FarmerVoiceDashboard` | `useGovernmentFeedback` (with global filters) |
| **Farmer Voice** | Priority Queue | `FeedbackPriorityQueue` | `useGovernmentFeedback` (with global filters) |
| **Farmer Voice** | Geographic + Sentiment | `FeedbackGeoHeatmap`, `SentimentTrendChart` | `useGovernmentFeedback` (with global filters) |
| **Farmer Voice** | Clusters + Insights | `FeedbackClusterView`, `SmartInsightsPanel` | `useGovernmentFeedback` (with global filters) |
| **Farmer Voice** | Tools (dropdown) | `ResponseTemplates`, `FeedbackExport` | — |
| **Programs & Economics** | Grant Program Analytics | `RegionalInvestmentCards`, `GrantDistributionCard`, `GrantEffectivenessPanel` | `useGrantAnalytics`, `useGrantEffectiveness` |
| **Programs & Economics** | Production Economics | `MilkProductionBySpeciesChart`, `MarketPriceAnalyticsCard`, `FeedSecurityCard` | `useGovernmentMilkAnalytics`, `useRegionalMarketPrices`, `useRegionalFeedSecurity` |
| **Programs & Economics** | Platform Adoption | `FarmerQueriesTopics`, `FarmOperationalHealthCard`, `DataQualityDashboardCard` | `useFarmerQueries`, `useFarmComplianceMetrics`, `useRegionalDataQuality` |

---

## 3. Key SSOT Data Flows

### 3.0 Canonical "Active Animal" Filter

**Every query counting current/active animals MUST use both conditions:**
```
is_deleted = false AND exit_date IS NULL
```

| Context | Implementation |
|---------|---------------|
| Supabase JS (hooks) | `.eq("is_deleted", false).is("exit_date", null)` |
| SQL (RPCs/views) | `WHERE a.is_deleted = false AND a.exit_date IS NULL` |
| `gov_farm_analytics` view | Already applies both filters per species |

**Violations found and fixed (2026-03-05):** `useDashboardStats`, `useGrantEffectiveness` were missing `exit_date IS NULL`. The simplified `get_government_health_stats` RPC from migration `20260204114033` was overwriting the comprehensive version from `20260204112600`.

### 3.1 Critical Data Flows

These are critical synchronized data paths. Breaking any link is a blocking bug:

| Domain | SSOT Flow |
|--------|-----------|
| **Milk Revenue** | `milking_records` (sale) → `RecordMilkSaleDialog` / DB trigger `sync_milk_sale_to_revenue` → `farm_revenues` (source: `REVENUE_SOURCE_KEYS.MILK_SALE`) |
| **Animal Weight** | `weight_records` (latest) → DB trigger → `animals.current_weight_kg` |
| **OVR Scores** | `milking/weight/bcs/health/ai records` → `calculate_animal_ovr` SQL trigger → `animal_ovr_cache` → `useBatchOVRSummary` (list) + `useBioCardData` (BioCard/Summary) — **server-side computation ONLY, no client-side calc** |
| **Feed Inventory** | `feeding_records` → `feed_inventory_id` + `cost_per_kg_at_time` (cost locked at consumption) |
| **Milk Feeding** | `milk_inventory` (good/rejected) → `FeedMilkToAnimalDialog` (FIFO) → `feeding_records` (`milk_inventory_id` + `cost_per_kg_at_time`: market price for good, ₱0 for rejected) → `useHerdInvestment` + `useAnimalExpenses` |
| **Herd Investment** | `animals.purchase_cost` + `farm_expenses` (manual) + `feeding_records` (auto-calculated, includes milk feeding) |
| **Feed Stock Days** | Roughage inventory only → `useFeedInventory` hook → survival buffer |
| **Parent Eligibility** | `animals` → `animalCache.ts` filter by gender + (`birth_date` is null OR age >= 16 months) → mother/father dropdowns (both Add + Edit forms use same SSOT) |
| **AI Father Detection** | `ai_records` (animal_id) → `useEditAnimalForm` → pre-populate `is_father_ai`, brand, reference, breed |
| **Fertility State Machine** | `breeding_events` INSERT → DB trigger `update_animal_fertility_status` → `animals.fertility_status` + side effects (parity, VWP, services). VWP is species-specific: goat/sheep=45d, cattle/carabao=60d |
| **Breeding Offline** | `BreedingEventActionDialog` → `offlineQueue.addToQueue(breeding_event)` → `syncBreedingEvent()` → `insertBreedingEvent()` → `breeding_events`. Cache: `RecordCache.breeding` in IndexedDB |
| **Cooperative Aggregation** | `cooperative_memberships` (accepted farms) → SECURITY DEFINER RPCs (`get_cooperative_herd_summary`, `get_cooperative_milk_production`, `get_cooperative_health_overview`, `get_cooperative_financial_summary`) → `useCooperative` hooks → `CooperativeDashboard` tabs. **Note:** Cooperative reads are entirely via SECURITY DEFINER functions and do not touch existing farm RLS policies. |
| **Error Monitoring** | `client_error_logs` → `log_client_error` / `submit_error_report` / `get_error_monitoring_summary` (RPCs) → `errorMonitor.ts` + `useErrorLogs` (lib/hook) → error toast Report action, `AppErrorBoundary`, `ErrorMonitoringTab` (components). See §3.57 for capture-point detail. |

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
import { getIsOnline } from '@/hooks/useOnlineStatus';

queryFn: async () => {
  // 1. Check IndexedDB cache first
  const cached = await getCachedData(farmId);
  if (cached) return cached;

  // 2. If online, fetch from Supabase
  // IMPORTANT: Use getIsOnline() — NEVER navigator.onLine directly
  // (unreliable on Android WebView, see changelog 2026-03-02)
  if (!getIsOnline()) return fallbackDefault;
  const { data } = await supabase.from('table').select('*').eq('farm_id', farmId);

  // 3. Update local cache
  if (data) await updateDataCache(farmId, data);
  return data ?? fallbackDefault;
}
```

### Rules for New Hooks

- **Farm-scoped?** → Implement cache-first. Add `getCached*` / `update*Cache` in `dataCache.ts`. Register invalidation in `CacheManager.CACHE_DEPENDENCIES`.
- **Cross-farm aggregation?** → Mark `@online-only` in file header. No local cache.
- **Connectivity check?** → Use `getIsOnline()` from `useOnlineStatus.ts` (active probe singleton). NEVER use `navigator.onLine` directly.

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
| `useBreedingHub` | A | `RecordCache.breeding` (per-animal) |
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
| `useBarnAnimals` | A (MANAGED — `barn` type; cache-first) | `barnAssignmentsCache` |
| `useDailyChecklist` | A (MANAGED — `checklist` type) | — |
| `usePendingActivities` | A (MANAGED — `pending-activity` type, conditional) | — |
| `useFarmerFeedback` | A (MANAGED — `farmer-feedback` type) | — |
| `useAnimalCostAggregates` | A (MANAGED — cache-first) | `animalCostCache` |
| `useExpenses` | A (MANAGED — `expense` type; cache-first + date-range) | `expensesCache` |
| `useRevenues` | A (MANAGED — `revenue` type; cache-first + date-range) | `revenuesCache` |
| `useProfitability` | A (PARAMETERIZED — date-range dependent) | — |
| `useFinancialHealth` | A (PARAMETERIZED — date-range dependent) | — |
| `useProducts` | MANUAL — Marketplace-scoped | — |
| `useOrders` | MANUAL — User-scoped | — |
| `useMerchantOrders` | MANUAL — Merchant-scoped | — |
| `useMerchantProducts` | MANUAL — Merchant-scoped, read-only | — |
| `useInvoices` | MANUAL — Merchant-scoped | — |
| `usePlatformSettings` | MANUAL — Admin-scoped | — |
| `useGovernmentFeedback` | MANUAL — Government-scoped, @online-only | — |
| `useAuditReport` | MANUAL — Admin-scoped, @online-only | — |
| `useAnimalProfileExport` | A (COMPOSITION — reads via `getCachedAnimalDetails` + `useBioCardData` + `useAnimalExpenseSummary`; no new cache store, no new network) | inherited |
| `useErrorLogs` | B/C style (MANUAL — admin-only, `@online-only`; not farm-level so no IndexedDB cache) | — |

---

## 3.55 Animal Profile Export (SSOT Composition)

The downloadable animal profile (PDF + CSV) is a **pure composition** of existing
SSOT sources. It adds zero new tables, no new queries, and no new cache stores.

**Aggregation hook:** `src/hooks/useAnimalProfileExport.ts`
- Reads all record history via `getCachedAnimalDetails(animalId, farmId)`
  (same path AnimalDetails uses — guarantees the export matches what the user
  sees on screen).
- Reads vitals, OVR, sparklines, reproductive status, immunity, growth
  benchmark via `useBioCardData` (canonical BioCard SSOT).
- Reads per-animal cost rollup (manual expenses + feed consumption cost)
  via `useAnimalExpenseSummary`.
- Returns a normalized `AnimalProfileExportData` payload.

**Renderers:** `src/lib/animalProfileExport/`
- `pdf.ts` — jsPDF + jspdf-autotable multi-page farmer-friendly PDF.
- `csv.ts` — multi-section single-file CSV (Excel/Sheets friendly).
- `sparkline.ts` — canvas → PNG helper for embedding mini charts in PDF.
- `index.ts` — public `downloadAnimalProfile(data, format)` helper.

**Entry point:** `src/components/animal-details/ExportAnimalProfileButton.tsx`
mounted in `AnimalDetails.tsx` header. Hidden for `isOnlyFarmhand` (sensitive
cost data).

**Offline-first guarantee:** All reads go through the IndexedDB cache layer.
`meta.sourceIsOffline` is set via `getIsOnline()` and surfaces an "Offline
snapshot" footer on the PDF and banner in the CSV.

**Do NOT:** duplicate any recording/mutation logic here. This module is
read-only and must never write back to Supabase.

---

## 3.56 Error Monitoring & One-Tap Error Tickets (2026-08-07)

`client_error_logs` → `log_client_error` / `submit_error_report` /
`get_error_monitoring_summary` (RPCs) → `errorMonitor.ts` + `useErrorLogs`
(lib/hook) → error toast Report action, `AppErrorBoundary`,
`ErrorMonitoringTab` (components). Full column/RPC spec:
`docs/data-relationships-map.md` Entry 10.

**SSOT capture point:** `translateError()` in `src/lib/errorHandling.ts` is
the single place `captureError()` is invoked — it is called by every existing
error toast call site with zero per-call-site changes. `describeError()` is
the capture-free variant: same bilingual pattern-matching, but no monitor
side effect, for render-path/inline display (e.g. text that re-renders every
render, where `translateError` would spam duplicate captures). **Use
`describeError` in render paths, `translateError` everywhere else.**
`showErrorToastLegacy()` (56 call sites, shadcn `useToast`-based) calls
`translateError` under the hood — so it still captures — but has no action
slot to carry the "I-report ito" button; only `showErrorToast()` (sonner)
offers the one-tap report action.

**Offline queue:** lives in its own IndexedDB database, `errorMonitorDB`
(`src/lib/errorMonitor.ts`) — deliberately **not** `dataCacheDB`. This is a
conscious exception to the "all offline queues share the cache layer"
convention: error reports must survive `CacheManager`'s `clearAllCaches()`
(e.g. logout, storage-pressure eviction) so a crash report queued right
before a cache wipe still flushes. Never register `errorMonitorDB` in
`CacheManager.CACHE_DEPENDENCIES`.

**Capture points:** `translateError` (all toasts), `<AppErrorBoundary>`
(render crashes, severity `crash`), `window.onerror` +
`window.onunhandledrejection` (outside React's tree), `reportSilentError()`
(caught-but-not-shown — wired into `syncTelemetry.recordSyncError`,
`VoiceQuickAdd`, `useSystemHealth`), and Edge Functions via
`_shared/errorLogger.ts` (severity `server`, service-role direct insert,
bypasses the client RPC entirely).

**Noise control:** per-severity session caps (toast+crash: 20/session,
silent: 10/session) and a fingerprint dedup window (5 min for toast/crash,
30 min for silent — silent errors retry more aggressively, so they need a
longer window to avoid resending every retry of the same underlying
failure). Report action is suppressed (still captured, just no button) for
`NETWORK` and `DUPLICATE` translated titles — those categories are noise for
a support ticket, not a useful signal.

**Read path:** `useErrorLogs` is **online-only** (Category B/C style, no
local cache) — admin-only triage data, not farm-level, so it does not follow
the Category A cache-first pattern.

**Read more:** `docs/superpowers/specs/2026-08-07-error-monitoring-design.md`
(design + Implementation Deviations).

---

## 3.6 Chat Session Persistence

AI chat components use persistent conversation IDs stored in `localStorage` via SSOT utilities in `src/lib/localStorage.ts`.

| Component | localStorage Key | TTL | Pattern |
|-----------|-----------------|-----|---------|
| `DocAga` | `doc_aga_conversation_id` | 24h | Cache-first (localStorage) |
| `DocAgaConsultation` | `doc_aga_consultation_id` | 1h | Cache-first (localStorage) |
| `RicoChat` | `rico_conversation_id` | 24h | Cache-first (localStorage) |

**Shared Utilities:**
- `src/lib/chatUtils.ts`: `truncateMessages()` (sliding window, max 20 messages), `useSendCooldown()` (2s client-side debounce)
- `supabase/functions/_shared/sanitizeMessage.ts`: Prompt injection guard (strips `[SYSTEM]`, `<|system|>`, etc.)

---

## 3.7 Farm App Shell & URL Routing (2026-08-31, UX Redesign Phase 2)

Every farmer/farmhand screen renders inside one layout route — `src/components/shell/FarmShell.tsx` — instead of the old `pages/Dashboard.tsx` state-driven tab shell. The shell is the SSOT for header, bottom nav, floating widgets, pull-to-refresh, Android back handling, and farm bootstrap.

**Route tree (farmer + farmhand share it; content varies by role):**

| Path | Renders | Notes |
|------|---------|-------|
| `/` | `shell/RoleLanding` | Auth gate + role router + **permanent legacy shim** mapping `/?tab=…`/`/?animalId=…` URLs (`src/lib/legacyRedirects.ts`) |
| `/home` | `shell/pages/HomeRoute` | Farmer variant (FarmDashboard + QuickRecordActions) or farmhand variant (voice-first) by `isFarmhand` |
| `/animals` | `shell/pages/AnimalsRoute` | List; `?filter=missing-weight`; `?animalId=X` redirects to `/animals/X` |
| `/animals/:animalId` | `shell/pages/AnimalDetailRoute` | Animal profile (Phase 3); `?editWeight=true` opens entry-weight dialog; active tab persists via `#hash` + localStorage |
| `/animals/new` | `shell/pages/NewAnimalRoute` | Focused add-animal page (no nav/FAB — `isFocusedRoute`); the ONLY add-animal surface |
| `/operations/:subtab` | `shell/pages/OperationsRoute` | `milk\|feed\|breeding`; farmhands get `feed` only |
| `/money` | `shell/pages/MoneyRoute` | FinanceTab |
| `/more` | `shell/pages/MoreRoute` | `?tab=approvals\|submissions\|cooperative\|government\|settings`, role-filtered |
| `/setup` | `shell/pages/SetupRoute` | First-farm creation (was inline in Dashboard) |
| `/farmhand` | redirect → `/home` | Old notifications still target it |

**SSOT rules introduced:**
- **Role resolution** is one pure function: `resolveRoleTarget()` in `src/lib/roleResolution.ts`, consumed by `useFarmBootstrap` (shared by RoleLanding + FarmShell). Never re-implement admin/government/merchant/farmhand precedence elsewhere.
- **Nav items** live only in `src/components/shell/routes.ts` (`FARM_NAV_ITEMS`, `navItemsForRole`, `isRootTab`). AppBottomNav (mobile) and AppHeader's desktop row both render from it.
- **Hardware back**: `useAndroidBackButton` + the overlay registry in `src/lib/backClose.ts`. Overlays that should close on Android back register via `registerBackHandler()`.
- **New farmer screens** must be children of the FarmShell layout route and read `useFarmShellContext()` (farmId, user, isFarmhand, canManageFarm) — do not re-run session/farm queries per page.
- **Navigation is router-only**: no `window.dispatchEvent` navigation, no tab state. Legacy `/?tab=` URLs may never be produced by new code (RoleLanding's shim is for external/persisted links only).

Deleted (superseded): `pages/Dashboard.tsx`, `pages/FarmhandDashboard.tsx`, `ui/bottom-nav.tsx`, `voice-training/FloatingVoiceTrainingButton.tsx` (now `shell/VoiceTrainingCard` on Home).

**Phase 3 addenda (2026-08-31):**
- `AnimalList` has a `detailsMode` prop: `'navigate'` (default — routes to `/animals/:id` and `/animals/new`) vs `'inline'` (in-place mount, used ONLY by `pages/AdminViewFarm`). New consumers must use navigate mode.
- Add-animal validation is SSOT in `src/components/animal-form/validateAnimalForm.ts` (pure, tested); AnimalForm renders it inline via `ui/field-error.tsx`. Never add back toast-only validation.
- `EditAnimalDialog` was audited against the plan's delete recommendation and deliberately KEPT: it is not a naive field duplicate — it owns edit-only flows (delete-with-reason, AI-parentage updates, unsaved-changes guard) via `useEditAnimalForm`, and already has inline validation. The remaining field-markup duplication with AnimalForm is backlog: extract shared field-section components (Phase 7).

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

---

## Unified Invite Flow (2026-04-19)

A single route `/invite/:token` handles all three invitation types (farm membership,
global role, cooperative membership). The page drives its state machine off one
normalized read RPC, `public.lookup_invitation(p_token uuid)`, which probes
`user_invitations`, `farm_memberships`, and `cooperative_memberships` and returns a
canonical shape (`type`, `status`, `email`, `role`, `role_label`, `inviter_name`,
`inviter_email`, `target_name`, `invited_at`, `expires_at`).

Accept flows funnel through the `accept-invitation` Edge Function — the only caller
of `supabase.auth.admin.createUser`. For new users it creates an account with
`email_confirm: true`, signs them in, dispatches to the existing per-type accept
RPCs (`accept_user_invitation`, `accept_farm_invitation`, `accept_cooperative_invitation`),
and returns a session the client installs directly. For existing users (authed JWT),
it skips auth creation and dispatches to the accept RPC under the user's own JWT.

Legacy routes (`/invite/accept/:token`, `/invite/user/:token`,
`/cooperative/invite/accept/:token`) are redirect shims during a 90-day migration
window, then removed.

Rollout is gated by `VITE_UNIFIED_INVITE_FLOW` (frontend) and `UNIFIED_INVITE_FLOW`
(Edge Function runtime, controls email CTA URL in `send-team-invitation` and
`send-user-invitation`).
