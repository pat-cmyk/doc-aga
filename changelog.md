# Changelog

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
