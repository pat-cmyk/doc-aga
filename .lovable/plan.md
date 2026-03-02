

# Offline-First Barn Management + Animal/Profile Fix

## Overview

Three offline-first violations are causing failures on Android:
- Animal list goes empty when cache TTL expires offline (missing grace period)
- Profile button shows "Loading..." forever offline (no cache layer)
- Barn creation, editing, and animal assignment all fail offline (direct database only)

All fixes follow existing SSOT patterns already proven in 8+ other cache functions.

---

## Phase 1: Fix Animal List + Records Offline (Quick Win)

**Problem:** `getCachedAnimals()` and `getCachedRecords()` are the only two cache functions missing the `OFFLINE_GRACE_PERIOD` fallback. When TTL expires offline, data disappears.

**Fix in `src/lib/dataCache.ts`:**
- Add the same 3-line grace period pattern used by every other cache function:
```text
const isWithinGrace = Date.now() - cached.lastUpdated < OFFLINE_GRACE_PERIOD;
if (isValid || (!navigator.onLine && isWithinGrace)) return cached;
```
- Applied to both `getCachedAnimals()` (line 612) and `getCachedRecords()` (line 803)

---

## Phase 2: Profile Caching

**Problem:** `UserEmailDropdown` fetches user email and profile name directly from the database on mount. Offline = infinite "Loading..."

**Fix:**
- **`src/lib/localStorage.ts`**: Add `getCachedUserProfile()` / `setCachedUserProfile()` following the existing get/set pattern
- **`src/components/UserEmailDropdown.tsx`**: Load from localStorage immediately on mount (instant render). Attempt database fetch only if online. Update cache on success. Show cached data or "Offline" fallback instead of infinite loading.

---

## Phase 3: Barn Assignments Cache Layer

**Problem:** `useBarnAnimals` is online-only (pure database fetch). No IndexedDB store exists for barn assignments.

**Fix in `src/lib/dataCache.ts`:**
- Add `BarnAssignmentsCacheEntry` interface following the existing pattern
- Add `barnAssignmentsCache` store to IndexedDB (version 6 to 7)
- Add `getCachedBarnAssignments()`, `updateBarnAssignmentsCache()`, `clearBarnAssignmentsCache()` with `OFFLINE_GRACE_PERIOD` support
- Add helper `updateLocalBarnAssignment()` for optimistic add/remove of individual assignments

**Fix in `src/hooks/useBarns.ts`:**
- Make `useBarnAnimals` cache-first: check IndexedDB first, fetch from database if online, update cache after fetch
- When offline with cached data, resolve animal details from `getCachedAnimals()`

---

## Phase 4: Offline Queue Types for Barn Operations

**Fix in `src/lib/offlineQueue.ts`:**
- Add four new types to the `QueueItem.type` union: `barn_create`, `barn_update`, `barn_assign`, `barn_remove`
- Add payload fields: `barnData`, `barnId`, `barnAssignmentId` following existing payload patterns

---

## Phase 5: Offline-Capable Barn Hooks

**Fix in `src/hooks/useBarns.ts`:**

All four mutation hooks get the same pattern: if online, use current database path; if offline, perform optimistic local update + queue for sync.

- **`useCreateBarn`**: Generate temp UUID, add to local `barnsCache`, queue `barn_create`
- **`useUpdateBarn`**: Update in local `barnsCache`, queue `barn_update`. Uses `checkAndHandleConflict()` on sync (UPDATE operation)
- **`useAssignAnimalToBarn`**: Add to local `barnAssignmentsCache`, update barn `animal_count` in `barnsCache`, update animal's `current_barn_id` in `animalsCache`, queue `barn_assign`
- **`useRemoveAnimalFromBarn`**: Mark removed in local cache, decrement count, clear `current_barn_id`, queue `barn_remove`

All paths call `CacheManager.invalidateForMutation('barn', farmId)` on success.

---

## Phase 6: Sync Service Processors

**Fix in `src/lib/syncService.ts`:**

Four new processors following the existing pattern (e.g., `syncBulkMilk`, `syncAnimalForm`):

- **`syncBarnCreate`**: Insert barn with `client_generated_id` for deduplication. Update local cache with server ID on success.
- **`syncBarnUpdate`**: Update barn. Uses `checkAndHandleConflict()` framework since this is an UPDATE operation.
- **`syncBarnAssign`**: Insert `barn_assignments` row. Server-side trigger (`trg_barn_assignment_insert`) handles `animals.current_barn_id` sync automatically. Uses `client_generated_id` for deduplication.
- **`syncBarnRemove`**: Update `barn_assignments.removed_at`. Server-side trigger (`trg_barn_assignment_removal`) handles cleanup.

Wire into the dispatch switch at lines 373-399.

---

## Phase 7: Cache Manager Integration

**Fix in `src/lib/cacheManager.ts`:**
- Add `'barn-assignments'` to `CACHE_DEPENDENCIES.barn` (currently: `['barns', 'barn-animals', 'farm-animals']`)
- Add `clearBarnAssignmentsCache` to the `clearIndexedDBCache` switch

---

## Phase 8: UI Feedback

**Fix in `src/components/barns/BarnFormDialog.tsx`:**
- Show toast "Saved locally, will sync when online" when creating/editing offline

**Fix in `src/components/barns/BarnAnimalManager.tsx`:**
- Show toast "Saved locally" when assigning/removing animals offline

---

## Phase 9: Governance

- **`docs/ssot-architecture.md`**: Add barn assignments to Read Path Category A (cache-first). Add profile to Category A. Document new offline queue types.
- **`changelog.md`**: Document all changes

---

## Why Group Feeding Works Automatically

The existing `barn:` prefix selection in `useFarmAnimals.ts` (line 129) resolves animals by `current_barn_id` from the animals cache. Once:
1. Animals cache works offline (Phase 1 grace period fix)
2. Barn assignments update `current_barn_id` locally (Phase 5)

...group feeding by barn works through the existing `bulk_feed` offline queue with no additional changes needed. Feed apportionment logic in the recording dialogs is untouched.

---

## File Summary

| File | Change | Phase |
|------|--------|-------|
| `src/lib/dataCache.ts` | Grace period for animals/records + barn assignments cache store (v7) | 1, 3 |
| `src/lib/localStorage.ts` | Profile cache utilities | 2 |
| `src/components/UserEmailDropdown.tsx` | Cache-first profile loading | 2 |
| `src/lib/offlineQueue.ts` | 4 barn queue types + payload fields | 4 |
| `src/hooks/useBarns.ts` | All hooks offline-capable with optimistic updates | 5 |
| `src/lib/syncService.ts` | 4 barn sync processors | 6 |
| `src/lib/cacheManager.ts` | Barn-assignments in dependency map | 7 |
| `src/components/barns/BarnFormDialog.tsx` | Offline toast feedback | 8 |
| `src/components/barns/BarnAnimalManager.tsx` | Offline toast feedback | 8 |
| `docs/ssot-architecture.md` | Document barn + profile offline-first | 9 |
| `changelog.md` | Document changes | 9 |

## What Stays Online-Only

- Doc Aga AI chat (as specified by user)
- Government/Cooperative portals (Category B/C -- online-only by SSOT design, RLS boundary)

