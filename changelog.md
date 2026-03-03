# Changelog

## 2026-03-03 — True Offline Milk Feeding (Good + Rejected) with Offline Pricing

### Added
- **Offline milk feeding for good and rejected stock**: `FeedMilkToAnimalDialog` now works fully offline. When offline, FIFO cache deductions happen instantly, an optimistic feeding record is persisted to IndexedDB, and the operation is queued for server sync on reconnect.
- **Milk price offline cache**: `useLastMilkPriceBySpecies` caches per-species milk prices to localStorage after each successful fetch. Offline milk feedings use cached prices for accurate opportunity cost calculation.
- **Rejected milk offline cache**: `useMilkInventory` caches rejected milk items to IndexedDB after fetch. Offline fallback loads cached rejected stock so farmers can feed rejected milk without connectivity.
- **Sync function for milk feeding**: `syncMilkFeeding()` in syncService inserts `feeding_records` with `client_generated_id` for idempotency, updates `milk_inventory` rows per FIFO deduction, and rolls back cache on permanent failure.
- **Cache rollback on sync failure**: `rollbackMilkInventoryDeduction()` restores `liters_remaining` and `is_available` for each deducted item if sync permanently fails.
- **Offline animal list fallback**: Dialog loads cached animals from IndexedDB when the online animal query returns empty.

### Files Modified
- `src/lib/offlineQueue.ts` — Added `milk_feeding` queue type with FIFO deduction payload
- `src/lib/dataCache.ts` — Added `rollbackMilkInventoryDeduction()`, `updateMilkPriceCache()`/`getCachedMilkPrices()`, `updateRejectedMilkCache()`/`getCachedRejectedMilk()`
- `src/lib/cacheManager.ts` — Added `milk-feeding` cache dependency entry
- `src/hooks/useRevenues.ts` — Cache milk prices to localStorage after successful query
- `src/hooks/useMilkInventory.ts` — Cache rejected milk after fetch, offline fallback for rejected stock
- `src/lib/syncService.ts` — Added `syncMilkFeeding()` dispatch and rollback on failure
- `src/components/milk-inventory/FeedMilkToAnimalDialog.tsx` — Offline branch with optimistic records, queue, cached animal/price fallbacks

## 2026-03-03 — Data Sync Optimization for 2G/3G Bandwidth

### Changed
- **Delta sync for animals**: `updateAnimalCache()` checks a local sync checkpoint. On subsequent syncs, only animals with `updated_at > lastSync` are fetched (including soft-deleted/exited for cache removal). First sync is still a full fetch. Estimated 80-95% bandwidth reduction on reconnect.
- **Delta sync for records**: `updateRecordsCacheBatch()` accepts optional `farmId` parameter. When a records checkpoint exists, fetches only records with `updated_at > lastSync` across all 6 record types, then merges into existing cache via `mergeRecordsById()` instead of replacing.
- **Delta sync for feed inventory**: `updateFeedInventoryCache()` checks a feed_inventory checkpoint. On delta, fetches only items with `last_updated > lastSync`, merges by ID, and preserves `dailyConsumption` from last full sync (avoids extra animals query).
- **Batch record queries**: Replaced per-animal record caching loop (N×6 HTTP requests) with `updateRecordsCacheBatch()` that makes just 6 farm-level queries using `.in('animal_id', allIds)`. For a 50-animal farm, this reduces 300 round trips to 6.
- **Explicit column selection**: Replaced all `select('*')` in cache update functions with explicit column lists (`ANIMAL_SELECT_COLUMNS`, `MILKING_RECORD_COLUMNS`, etc.). Drops unused columns for ~20-30% payload reduction per query.
- **Record date windowing**: Milking records limited to 6 months, feeding to 3 months, weight/health to 12 months. AI and heat records fetched in full (small datasets, critical for breeding predictions).
- **Adaptive sync for 2G connections**: Probe RTT classified as `fast` (<300ms), `slow` (300-1500ms), `2g` (>1500ms), or `offline`. On 2G, `preloadAllData()` and `refreshAllCaches()` skip feed inventory and farm data (deferred to next fast connection). Animals + records always sync (essential for offline use).
- **Connection quality estimation**: `probeConnectivity()` measures RTT via `performance.now()`. New exports: `getConnectionQuality()` and `getLastProbeRTT()`.
- **Animal interface updated**: Added breeding/fertility fields, barn/lactation fields, and sync metadata to the `Animal` type.

### Technical Details
- Column constants defined as joined strings for efficient PostgREST query building
- `computeAnimalStages()` extracted as shared function for full and delta sync paths
- `computeFeedSummary()` extracted for reuse across full and delta feed paths
- `mergeRecordsById()` helper: merges server changes into existing cache by ID (update existing + append new)
- Delta sync uses `offlineFirstCache.ts` checkpoint system (`getCheckpoint`/`updateCheckpoint`) with IndexedDB-backed storage
- Batch function uses IndexedDB transaction for atomic per-animal writes
- Gzip/Brotli verified active on Supabase Cloud (Cloudflare CDN, `vary: Accept-Encoding`)
- RTT thresholds based on typical latencies: Wi-Fi/4G <300ms, 3G 300-1500ms, 2G >1500ms

### Files Modified
- `src/lib/dataCache.ts` — Column constants, delta sync for animals/records/feed, batch queries, date windowing, adaptive sync in `preloadAllData()` and `refreshAllCaches()`, `mergeRecordsById()`, `computeFeedSummary()`
- `src/hooks/useOnlineStatus.ts` — `ConnectionQuality` type, RTT measurement in `probeConnectivity()`, `getConnectionQuality()` and `getLastProbeRTT()` exports

## 2026-03-03 — Fix Permission Retry, Offline Breeding Hub, Offline FAB Actions

### Fixed
- **Camera/Notification permission retry failure (P1)**: After granting camera or notification permission in system settings, tapping "Retry" still showed denied. Capacitor's `requestPermissions()` returns a cached denial after the OS dialog is dismissed. Fixed by calling `checkPermissions()` first to detect real-time system state.
- **Breeding Hub shows all zeros offline (P1)**: All stats displayed "0" when offline because the hook only used direct Supabase queries with no cache fallback. Added cache-first pattern: derives breeding stats from already-cached animals (with fertility fields) and per-animal AI/heat records in IndexedDB.
- **FAB recording actions disappear offline (P1)**: All recording actions (milk, feed, health, BCS, add animal) hidden offline because the permission fetch failed and cleared all roles to empty arrays. Added localStorage cache for user permissions — restores cached permissions instead of clearing on fetch failure.

### Changed
- `src/hooks/useDevicePermissions.ts` — `checkPermissions()` before `requestPermissions()` for camera and notifications.
- `src/hooks/useBreedingHub.ts` — Cache-first pattern with `getCachedAnimals()` + `getCachedRecords()` offline fallback.
- `src/lib/dataCache.ts` — Added `heat: any[]` to RecordCache, fetches `heat_records` in `updateRecordsCache()`.
- `src/lib/cacheManager.ts` — Added `'breeding-hub'` to animal, ai-record, heat-record, pregnancy-confirm dependency lists.
- `src/contexts/PermissionsContext.tsx` — Caches permissions in localStorage after successful fetch; restores from cache on offline failure; initializes state from cache to prevent flash of empty permissions.

## 2026-03-03 — Fix White Screen on Android

### Fixed
- **White screen on Android launch (P0)**: `vite.config.ts` marked `capacitor-native-settings` as `external` (Rollup won't bundle it). After commit `fb8f87e` changed `openAppSettings.ts` to a static import, the production build left a bare `import ... from "capacitor-native-settings"` in the main JS chunk. Android WebView has no runtime module resolver for bare specifiers → import fails → JS execution stops → React never mounts → white screen. Fixed by removing `capacitor-native-settings` from the `external` array so Rollup bundles its JS code (just `registerPlugin()` + enum definitions).

### Changed
- `vite.config.ts` — Removed `'capacitor-native-settings'` from `build.rollupOptions.external`.

## 2026-03-03 — Doc Aga Offline FAQ Mode + Fix Permissions

### Fixed
- **"Open Settings" button does nothing (P0)**: `openAppSettings.ts` used `import(/* @vite-ignore */ 'capacitor-native-settings')` which Vite does NOT bundle — the dynamic import silently failed at runtime in the WebView (no module resolver). Changed to static import so the JS side is bundled correctly. All 4 permission dialogs (Camera, Mic, Location, Notifications) now open system settings when tapped.
- **Notification permission never prompts on Android 13+ (P0)**: `POST_NOTIFICATIONS` permission was missing from `AndroidManifest.xml`. Required for Android 13 (API 33+) to show the notification permission dialog.
- **Doc Aga completely disabled offline (P1)**: All inputs (text, voice, image) were disabled when offline, even though a complete offline FAQ matching system (`findOfflineFaqMatch()`) already existed. Enabled text input offline — users can now type questions and get FAQ answers. Voice and image remain disabled (need internet for transcription/upload).

### Changed
- `src/lib/openAppSettings.ts` — Static import of `NativeSettings`, `AndroidSettings`, `IOSSettings` from `capacitor-native-settings` (replaces broken dynamic import).
- `android/app/src/main/AndroidManifest.xml` — Added `<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />`.
- `src/components/DocAga.tsx` — Text input and send button enabled offline. Banner changed from "requires internet" to "FAQ mode offline". No-match fallback updated with bilingual message.
- `src/components/farmhand/DocAgaConsultation.tsx` — Added offline FAQ fallback (was completely online-only). Same banner, input, and placeholder updates. Added `refreshFaqCache()` on online.

## 2026-03-02 — True Offline-First Mutations for All Record Types

### Fixed
- **Offline records only queued, not persisted (P0)**: Recording milking/feeding/health/weight/BCS/pregnancy while offline only updated in-memory React Query cache (lost on reload) and queued for sync. Now all record types persist to IndexedDB immediately via `addOptimisticRecords()`, ensuring data survives app restarts. Dashboards and computations work entirely from local data.
- **"Queued for Sync" messaging felt provisional (P1)**: All 10 recording dialogs showed "Queued for Sync" toast title and "Queue for Sync" button text, making offline recording feel like a degraded experience. Changed to positive confirmations ("✅ Feed Recorded", "✅ Health Recorded", etc.) with subtitle "Syncs automatically when online". Buttons now show the same label online and offline (e.g. "Record Feed").
- **Dashboard feed chart ignored local feed data (P1)**: `useCombinedDashboardData` only merged local pending milk data with server data. Feed chart showed 0 after offline recording until sync. Added same `Math.max()` merge logic for feed data.

### Added
- `addLocalFeedRecord()` in `dataCache.ts` — Persists feed totals to IndexedDB dashboard cache (daily feed kg + animal count).
- `deductLocalFeedInventory()` in `dataCache.ts` — Deducts feed from local inventory cache for instant stock updates.
- `addLocalHealthEvent()` in `dataCache.ts` — Increments dashboard health event counter in IndexedDB.
- `updateLocalAnimalWeight()` in `dataCache.ts` — Updates animal's `current_weight_kg` in local animals cache.
- `incrementLocalPregnantCount()` in `dataCache.ts` — Increments pregnant count and decrements pending confirmation in dashboard cache.

### Changed
- `RecordBulkFeedDialog.tsx` / `RecordSingleFeedDialog.tsx` — Now call `addOptimisticRecords()` + `addLocalFeedRecord()` + `deductLocalFeedInventory()` before queuing.
- `RecordBulkHealthDialog.tsx` / `RecordSingleHealthDialog.tsx` / `AddHealthRecordDialog.tsx` — Now call `addOptimisticRecords()` + `addLocalHealthEvent()` before queuing.
- `RecordSingleWeightDialog.tsx` — Now calls `addOptimisticRecords()` + `updateLocalAnimalWeight()` before queuing.
- `RecordBulkBCSDialog.tsx` — Now calls `addOptimisticRecords()` before queuing. Added `'bcs'` to type union.
- `ConfirmPregnancyDialog.tsx` — Now calls `incrementLocalPregnantCount()` before queuing.
- `useCombinedDashboardData.ts` — Merges local pending feed data with server feed data using `Math.max()`.
- `dataCache.ts` — Extended `addOptimisticRecords()` type union to include `'bcs'`. Added `bcs: any[]` to `RecordCache` interface.
- All 10 dialog files — Removed "Queue for Sync" / "Queuing..." button variants; buttons now show consistent labels regardless of online state.

## 2026-03-02 — Fix Permissions, Reliable Connectivity Probing, SW Cache Staleness

### Fixed
- **Android permissions not grantable (P0)**: `capacitor-native-settings` package was NOT installed despite `openAppSettings.ts` importing it. The "Open Settings" button in all 4 permission dialogs (Camera, Mic, Location, Notifications) silently failed, preventing users from granting permissions via system settings. Installed `capacitor-native-settings@8.0.0` — plugin now registered in Android Gradle build.
- **Unreliable offline detection on Android WebView (P0)**: Re-implemented active connectivity probing using a fundamentally different approach than the previous attempt (which probed Supabase REST API and hit CORS/API-key issues). New approach uses Google's `connectivitycheck.gstatic.com/generate_204` with `mode: 'no-cors'` — immune to CORS issues, zero body bytes, same endpoint Android itself uses for captive portal detection.
- **Stale Service Worker serving old code after APK update (P1)**: New SW activation handler now explicitly deletes all non-workbox runtime caches (animals-cache, records-cache, feed-cache) to prevent stale API data surviving across APK updates. Added forced `registration.update()` on every app launch and periodic re-check (60s interval) in `main.tsx` to ensure new SW is detected immediately.

### Changed
- `src/hooks/useOnlineStatus.ts` — Singleton active probe using `no-cors` fetch to Google's connectivity endpoint. Probes every 30s while online, 10s while offline. Pauses when app hidden (saves battery). Both `useOnlineStatus()` hook and `getIsOnline()` accessor share the same singleton state.
- `src/main.tsx` — Added `registration.update()` on SW registration + 60s periodic interval to force SW version checks.
- `src/sw.ts` — Activate handler now clears all non-workbox runtime caches before calling `clients.claim()`.
- `package.json` — Added `capacitor-native-settings@8.0.0` dependency + `postinstall` script for AGP 9 compatibility patch.
- `scripts/patch-capacitor-native-settings.js` — Postinstall patch replaces deprecated `proguard-android.txt` with `proguard-android-optimize.txt` in the plugin's `build.gradle` (required for AGP 9.0.1+).
- `android/build.gradle` — Comment noting the postinstall patch for capacitor-native-settings ProGuard compatibility.

## 2026-03-02 — Revert Connectivity to navigator.onLine + Fix Offline Barn Creation

### Fixed
- **Reverted active connectivity probing**: Active `HEAD` probing unreliable on Android WebView. Reverted `useOnlineStatus.ts` to passive `navigator.onLine` + browser events. `getIsOnline()` SSOT accessor preserved — 50+ consumers unchanged.
- **Offline barn creation broken (P1)**: Mutation hooks (`useCreateBarn`, `useUpdateBarn`, `useAssignAnimalToBarn`, `useRemoveAnimalFromBarn`) captured `isOnline` at render time via closure. Going offline after form render sent mutations down the online path, failing silently. Fixed by calling `getIsOnline()` at execution time inside each `mutationFn`.

### Changed
- `src/hooks/useOnlineStatus.ts` — Removed active probing singleton; reverted to `navigator.onLine` with passive events.
- `src/hooks/useBarns.ts` — All 4 mutation hooks now call `getIsOnline()` inside `mutationFn` instead of using stale hook value.

## 2026-03-02 — Fix: Connectivity Probe Missing API Key + Sync Sheet Navigation

### Fixed
- **App stuck permanently offline (P0)**: The active connectivity probe (`HEAD /rest/v1/`) was missing the `apikey` header, causing 401 responses without CORS headers. The browser treated these as network errors, permanently setting `getIsOnline() = false`. Added `apikey` header to `checkConnectivity()` — all 50+ SSOT consumers automatically restored.
- **No back button on Sync Status sheet**: Added explicit `ArrowLeft` close button in `SheetHeader` for mobile navigation.

### Changed
- `src/hooks/useOnlineStatus.ts` — Added `apikey` header to connectivity probe fetch call.
- `src/components/sync/SyncStatusSheet.tsx` — Added `SheetClose` with `ArrowLeft` icon in header.

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
