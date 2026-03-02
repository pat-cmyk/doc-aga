# Changelog

## 2026-03-02 — Active Connectivity Probing (Android Offline Fix)

### Fixed
- **WiFi indicator stays green offline (P0)**: Replaced passive `navigator.onLine` with active HEAD request probing to the backend every 10s. Android WebView's unreliable `online`/`offline` events no longer cause false "online" state.
- **Cache grace periods now work on Android**: All 10+ `navigator.onLine` checks in `dataCache.ts` replaced with `getIsOnline()` from the active probing module. Stale cache is correctly served when truly offline.

### Changed
- `useOnlineStatus` hook now uses singleton active ping (HEAD to backend, 5s timeout, 10s interval). Pauses when tab/app is hidden to save battery.
- Exported `getIsOnline()` function for non-React code (dataCache, syncService, offlineQueue, etc.).
- Replaced `navigator.onLine` in 10 files: `dataCache.ts`, `offlineQueue.ts`, `offlineAudioSyncProcessor.ts`, `UserEmailDropdown.tsx`, `BarnFormDialog.tsx`, `BarnAnimalManager.tsx`, `voice-input-button.tsx`, `useVoiceRecording.ts`.

## 2026-03-02 — Offline-First: Barn Management, Animal List, Profile

### Fixed
- **Animal List Offline (P0)**: `getCachedAnimals()` and `getCachedRecords()` now include `OFFLINE_GRACE_PERIOD` (7-day stale-cache fallback when offline). Animals no longer disappear when cache TTL expires while disconnected.
- **Profile Button Offline (P0)**: `UserEmailDropdown` now caches user email and name in `localStorage` via `getCachedUserProfile()` / `setCachedUserProfile()`. Shows cached data instead of infinite "Loading..." when offline.

### Added
- **Offline Barn Creation**: `useCreateBarn` generates optimistic local barn with temp UUID and queues `barn_create` for sync.
- **Offline Barn Editing**: `useUpdateBarn` applies optimistic updates to local cache and queues `barn_update` with conflict detection on sync.
- **Offline Barn Animal Assignment**: `useAssignAnimalToBarn` adds assignment to local cache, increments barn count, updates `current_barn_id` in animals cache, queues `barn_assign`.
- **Offline Barn Animal Removal**: `useRemoveAnimalFromBarn` marks assignment removed locally, decrements count, clears `current_barn_id`, queues `barn_remove`.
- **Barn Assignments Cache**: New `barnAssignmentsCache` store in IndexedDB v7 with `getCachedBarnAssignments()`, `updateBarnAssignmentsCache()`, `updateLocalBarnAssignment()`.
- **Cache-First `useBarnAnimals`**: Now checks IndexedDB first, resolves animal details from `getCachedAnimals()`, falls back to database when online.
- **Barn Sync Processors**: Four new processors in `syncService.ts`: `syncBarnCreate`, `syncBarnUpdate` (with `checkAndHandleConflict`), `syncBarnAssign` (with dedup), `syncBarnRemove`.
- **Offline Queue Types**: `barn_create`, `barn_update`, `barn_assign`, `barn_remove` added to `QueueItem.type` union.
- **UI Feedback**: Barn components show "Saved locally, will sync when online" toast when operating offline.

### Changed
- `src/lib/dataCache.ts`: IndexedDB bumped to v7 (new `barnAssignmentsCache` store). Added helper functions `updateLocalBarn()`, `updateLocalAnimalBarn()`.
- `src/lib/cacheManager.ts`: `barn` dependency now includes `barn-assignments` with `clearBarnAssignmentsCache` handler.
- `src/lib/localStorage.ts`: Added `getCachedUserProfile()` / `setCachedUserProfile()`.

### SSOT Compliance
- **Group Feeding**: Works offline automatically — `barn:` prefix selection resolves animals via `current_barn_id` from animals cache. No changes needed to feeding logic.
- All mutations route through `CacheManager.invalidateForMutation('barn', farmId)`.
- Server-side triggers (`trg_barn_assignment_insert`, `trg_barn_assignment_removal`) reconcile `current_barn_id` on sync.
- Conflict detection framework (`checkAndHandleConflict`) applied to barn UPDATE operations.

## 2026-03-02 — P0/P1: Doc Aga & RICO Enterprise Hardening

### Added
- **Conversation Persistence (P0)**: `conversationId` now persists in `localStorage` with TTL (24h for DocAga/RICO, 1h for Consultation). Page refresh no longer loses chat context. New "New Chat" button in DocAga and RICO headers.
- **Sliding Window Context (P0)**: `truncateMessages()` in `src/lib/chatUtils.ts` caps messages sent to AI at 20 (first user message + last 19) to prevent token overflow. Applied to all 3 chat components.
- **Client-Side Send Cooldown (P1)**: `useSendCooldown()` hook enforces 2-second debounce between sends across all chat components. Complements existing server-side rate limiting (15 req/60s).
- **Prompt Injection Guard (P1)**: `sanitizeUserMessage()` in `supabase/functions/_shared/sanitizeMessage.ts` strips injection patterns (`[SYSTEM]`, `<|system|>`, `Ignore previous instructions`, etc.) from user messages before AI processing. Applied to both `doc-aga` and `rico` edge functions.

### Changed
- `src/lib/localStorage.ts`: Extended with `getConversationId()`, `resetConversationId()`, `CONVERSATION_KEYS`, `CONVERSATION_TTLS`
- `src/components/DocAga.tsx`: Uses persistent conversation ID, truncation, cooldown, "New Chat" button
- `src/components/farmhand/DocAgaConsultation.tsx`: Same utilities applied
- `src/components/government/RicoChat.tsx`: Same utilities applied
- `supabase/functions/doc-aga/index.ts`: Imports and applies `sanitizeUserMessage()` to `transformedMessages`
- `supabase/functions/rico/index.ts`: Same sanitization applied

### SSOT Compliance
- No new RPCs, hooks, or database changes
- All new utilities are shared (DRY): `chatUtils.ts` consumed by 3 components, `sanitizeMessage.ts` by 2 edge functions
- Existing server-side rate limiting and Zod validation unchanged (defense-in-depth preserved)



### Removed (Duplications Eliminated)
- **GovDashboardOverview**: Removed "Grant Recipients" and "Avg Purchase Price" cards (data fully covered in Programs tab). Removed `useGrantAnalytics` dependency. Grid reduced from 6 to 4 columns.
- **GovTrendCharts**: Removed "Total Milk Production" chart (duplicate of `MilkProductionBySpeciesChart` in Programs). Removed Doc Aga queries line from Health Events chart. Grid changed to 3-column layout.
- **RegionalPCRSCard**: Removed from Programs tab; PCRS risk data merged into `ExpectedDeliveriesTimeline` in Livestock tab.

### Changed
- **ExpectedDeliveriesTimeline**: Now receives merged PCRS risk overlay data via `useRegionalPCRS` hook, showing risk tier badges alongside species counts.
- **Farmer Voice tab**: Flattened from 6 sub-tabs to single scrollable view. Templates and Export moved to popover dropdown. All sub-components (`FeedbackPriorityQueue`, `SmartInsightsPanel`, `FeedbackClusterView`, `FeedbackGeoHeatmap`, `SentimentTrendChart`) now accept and propagate global `dateFrom`, `dateTo`, `region` filters via existing `useGovernmentFeedback` filter interface.
- **FarmerVoiceDashboard**: Now accepts optional `dateFrom`, `dateTo`, `region` props.
- **Programs tab**: Reorganized into 3 clear sections: Grant Program Analytics, Production Economics, Platform Adoption. "Farmer Queries Analysis" moved from standalone card into Platform Adoption section.

### SSOT Compliance
- Zero new RPCs, hooks, or database changes
- All changes are layout/composition moves and prop additions
- Existing `useGovernmentFeedback` filter interface now fully utilized by all Farmer Voice sub-components


## 2026-02-26 — Phase 6: Conflict Detection & Resolution — Wire Up the Gap

### Added
- **Conflict detection framework** — `checkAndHandleConflict()` in `syncService.ts` calls `detectConflict()` before UPDATE operations, records conflicts via `recordConflict()`, and marks queue items as `'conflict'` status.
- **Orphan protection** — `validateAnimalsExist()` batch-checks all referenced `animal_id`s before sync. Items referencing deleted animals are marked `'failed'` with `PARENT_DELETED` message.
- **Stale queue warning** — `checkForStaleQueueOnOtherDevices()` + `check_stale_sync_items` RPC detect unsynced items on other devices. Toast warning shown once on first online in `App.tsx`.
- **Queue item status** — Added `'conflict'` to `QueueItem.status` union; added optional `clientTimestamp` field.

### Changed
- **`syncService.ts`** — Sync loop now skips `'conflict'` items, runs batch orphan check before processing, imports `conflictDetection` utilities.
- **`offlineQueue.ts`** — `QueueItem` interface extended with `'conflict'` status and `clientTimestamp`.
- **`App.tsx`** — Added one-time stale device check on first online after mount.

### Documentation
- **`ssot-architecture.md`** — Added Section 6: Conflict Resolution Flow (pipeline, components, statuses, stale warning).

## 2026-02-26 — Phase 5: Low-Priority Cache-First + Final Documentation (SSOT Read-Path Audit COMPLETE)

### Added
- **IndexedDB v6** — Three new cache stores: `animalCostCache` (15 min TTL), `barnsCache` (30 min TTL), `farmSettingsCache` (60 min TTL).
- **Cache helpers** — `getCached*`, `update*Cache`, `clear*Cache` functions for each new store in `dataCache.ts`.
- **CacheManager IndexedDB clear** — `animal-cost-aggregates`, `barns`, `farm-settings` keys now clear their IndexedDB stores.

### Changed
- **`useAnimalCostAggregates`** — Refactored to cache-first pattern (IndexedDB → Supabase → update cache).
- **`useBarns`** — `useBarns` query refactored to cache-first; mutation hooks unchanged (Phase 4).
- **`useFarmSettings`** — `useFarmSettings` query refactored to cache-first; mutation hook unchanged (Phase 4).

### Documentation
- **Group B hooks** — Added `@cache-status` headers: `useAnimalExpenses` (ANIMAL-SCOPED read note), `useProfitability` (PARAMETERIZED), `useFinancialHealth` (PARAMETERIZED), `useProducts` (MANUAL), `useOrders` (MANUAL).
- **`ssot-architecture.md`** — Hook Inventory fully updated with all Phase 5 entries. SSOT Read-Path Audit marked complete.

## 2026-02-26 — Phase 4: Route Farm-Level Mutations Through CacheManager

### Added
- **5 new CacheManager mutation types** — `farm-settings`, `barn`, `checklist`, `pending-activity`, `farmer-feedback` registered in `CACHE_DEPENDENCIES`.

### Changed
- **`useAnimalExpenses`** — `add`/`delete` mutations routed through CacheManager `expense` type + animal-scoped manual invalidation. `useDeleteAnimalExpense` now requires `farmId` in variables.
- **`useFarmSettings`** — Update mutation routed through `farm-settings` type.
- **`useBarns`** — All 4 mutations (`create`, `update`, `assign`, `remove`) routed through `barn` type.
- **`useDailyChecklist`** — Toggle mutation routed through `checklist` type.
- **`usePendingActivities`** — All 4 mutations routed through `pending-activity` type when `farmId` available; manual fallback otherwise.
- **`useFarmerFeedback`** — Submit mutation routed through `farmer-feedback` type.

### Documentation
- **Group B hooks** — Added `@cache-status MANUAL` headers to `useMerchantOrders`, `useMerchantProducts`, `useInvoices`, `usePlatformSettings`, `useGovernmentFeedback`.
- **`ssot-architecture.md`** — Hook Inventory updated with all Phase 4 entries.

## 2026-02-26 — Phase 3: Cache-First for Medium-Priority Hooks

### Added
- **IndexedDB v5** — Three new cache stores: `marketPriceCache`, `herdValuationCache`, `breedingAnalyticsCache` with TTLs of 30m, 10m, 15m respectively.
- **Cache helpers** — `getCached*`, `update*Cache`, `clear*Cache` functions for each new store in `dataCache.ts`.
- **`CacheManager` dependencies** — `herd-valuation-unified` and `breeding-analytics` registered for `animal`, `ai-record`, `weight-record`, `heat-record`, `pregnancy-confirm`, and `market-price` mutation types.

### Changed
- **`useCurrentMarketPrice`** — Refactored to cache-first pattern (IndexedDB → Supabase → update cache). Uses `useOnlineStatus`.
- **`useHerdValuationUnified`** — Refactored to cache-first. Extracted `fetchAndComputeValuation` helper for clarity.
- **`useBreedingAnalytics`** — Consolidated from 4 separate `useQuery` calls into a single `useQuery` with internal parallel fetches + cache-first pattern.
- **`useBioCardData`** — Added `@cache-status COMPOSITION` documentation header; full cache-first deferred to Phase 5.

### Documentation
- **`ssot-architecture.md`** — Updated Hook Inventory with `useCurrentMarketPrice`, `useHerdValuationUnified`, `useBreedingAnalytics` as Category A compliant, and `useBioCardData` as deferred.


## 2026-02-23 — Barn / Paddock Grouping System

### Added
- **`barns` + `barn_assignments` tables** — Farm-scoped housing locations with move history, triggers syncing `animals.current_barn_id`.
- **`src/hooks/useBarns.ts`** — CRUD hooks for barns and assignments.
- **`src/components/barns/`** — `BarnListView`, `BarnFormDialog`, `BarnAnimalManager` components.
- **Barn quick-select in dropdowns** — `getAnimalDropdownOptions` now accepts optional `barns` param adding `barn:{id}` options. `getSelectedAnimals` handles `barn:` prefix.

### Changed
- `useFarmAnimals` / `useLactatingAnimals` — Added `current_barn_id` to queries and interfaces.
- `Dashboard.tsx` — Added `BarnListView` above animal list in Animals tab.


## 2026-02-23 — Health Voice Extractor Enhancement & Offline Capture

### Changed
- **Health extractor category IDs** (`voiceFormExtractors.ts`) — Remapped from `illness/preventive/reproductive` to match UI categories: `treatment`, `vaccination`, `deworming`, `checkup`, `injury`, `other`. Added Taglish diagnosis patterns (`may/meron`, `nilagnat`, `nagtatae`, `binigyan ng`) and expanded treatment keywords to match `QUICK_DIAGNOSES`/`QUICK_TREATMENTS`.
- **VoiceInputButton offline support** (`voice-input-button.tsx`) — Now queues audio via `offlineAudioQueue` when offline instead of failing. Shows "Na-queue ang audio" toast. Accepts `source` and `extractorType` props for queue metadata.
- **Health dialogs offline voice** — Removed `disabled={!isOnline}` from all VoiceInputButton instances across `RecordSingleHealthDialog` (5), `RecordBulkHealthDialog` (5), `AddHealthRecordDialog` (3), `AddPreventiveHealthDialog` (1).


## 2026-02-23 — Farmer-Facing Voice & Workflow Gaps

### Added
- **Weight voice extractor** (`voiceFormExtractors.ts`) — New `weight` ExtractorType supporting "245 kilos scale" and Taglish variants. Integrated into `RecordSingleWeightDialog`.
- **Health voice extractor** (`voiceFormExtractors.ts`) — New `health` ExtractorType parsing condition, category, and treatment from voice. Integrated into `RecordSingleHealthDialog`.
- **Farmhand quick-action buttons** (`FarmhandDashboard.tsx`) — Record Milk, Record Feed, Record Health shortcuts below voice recorder.
- **Bilingual offline onboarding** (`OfflineOnboarding.tsx`) — Added Tagalog translations for title and description.

### Changed
- **Feed voice enabled offline** (`RecordBulkFeedDialog.tsx`, `RecordSingleFeedDialog.tsx`) — Removed `isOnline` guard so voice input works offline via existing audio queue.

## 2026-02-23 — FAQ Usage Analytics Dashboard

### Added
- **`get_faq_usage_stats` RPC** — Single aggregation query replacing N+1 match-count pattern.
- **`get_faq_match_timeline` RPC** — Daily FAQ match volume over configurable day range.
- **`FaqUsageAnalyticsTab.tsx`** — New "FAQ Usage" tab with summary cards, top-10 bar chart, daily timeline, and unused FAQs action table.

### Changed
- `DocAgaManagement.tsx` — Added "FAQ Usage" tab between "FAQ Candidates" and "Recent Queries".

## 2026-02-23 — Offline Photo Queue & AI Record Support

### Added
- **`src/lib/offlinePhotoQueue.ts`** — New dedicated IndexedDB store for photo blobs (avatars, health record photos) with max 20 photos, 10MB limit, 7-day retention, and auto-cleanup.
- **Offline avatar uploads** — `AnimalProfile.tsx` now queues avatar photos in `offlinePhotoQueue` when offline, with a pending indicator badge.
- **Offline health record photos** — `RecordSingleHealthDialog.tsx` and `AddHealthRecordDialog.tsx` now queue photos offline via `pendingPhotoIds` field, synced after parent record succeeds.
- **Offline pregnancy confirmation** — `ConfirmPregnancyDialog.tsx` now queues pregnancy confirmations when offline, syncing `ai_records` update + `breeding_events` insert on reconnect.
- **New queue types** — `ai_record` and `pregnancy_confirm` added to `offlineQueue.ts` type union.
- **New sync handlers** — `syncAIRecord()`, `syncPregnancyConfirm()`, `syncPendingPhotos()` in `syncService.ts`.
- **Cache dependencies** — `pregnancy-confirm` added to `cacheManager.ts`.

### Changed
- `AddHealthRecordDialog` now works fully offline (was previously disabled when offline).
- `RecordSingleHealthDialog` photo section now allows adding photos when offline instead of showing "Photos available when online".
- `AnimalProfile` camera button no longer disabled when offline.

### Files Modified
| File | Change |
|------|--------|
| `src/lib/offlinePhotoQueue.ts` | NEW |
| `src/lib/offlineQueue.ts` | Added types + payload fields |
| `src/lib/syncService.ts` | Added 3 sync handlers |
| `src/lib/cacheManager.ts` | Added cache deps |
| `src/components/ConfirmPregnancyDialog.tsx` | Offline queuing |
| `src/components/animal-details/AnimalProfile.tsx` | Offline avatar |
| `src/components/health-recording/RecordSingleHealthDialog.tsx` | Offline photos |
| `src/components/health-records/AddHealthRecordDialog.tsx` | Offline photos + submission |
| `docs/data-relationships-map.md` | Documented offline photo flow |
