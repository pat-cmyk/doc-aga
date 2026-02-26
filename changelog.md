# Changelog

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
