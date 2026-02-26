

# Phase 6: Conflict Detection & Resolution — Wire Up the Gap

## Problem Summary

The project has all the **pieces** for conflict resolution but they are not connected:

- **Database**: `sync_conflicts` table and `detect_sync_conflict()` RPC exist and work
- **Client utilities**: `conflictDetection.ts` has `detectConflict()`, `recordConflict()`, `resolveConflict()`, `applyConflictResolution()`
- **UI**: `SyncConflictResolution.tsx` component is mounted on both Dashboard and FarmhandDashboard
- **The gap**: `syncService.ts` never calls `detectConflict()` before applying changes -- it just writes directly, so conflicts are silently overwritten with last-write-wins

Additionally, several edge cases are unhandled:
1. **Stale offline queue on device switch** -- unsynced items on old device are abandoned
2. **Deleted records** -- offline cache can reference records deleted on another device
3. **Cache shape drift** -- no validation when reading stale IndexedDB entries after schema changes

---

## Scope (3 workstreams)

### Workstream A: Wire conflict detection into syncService

**What changes**: Modify `syncService.ts` to call `detectConflict()` before each upsert/update operation. If a conflict is found, record it via `recordConflict()` and mark the queue item with `conflictData` instead of blindly overwriting.

**Files modified**:
- `src/lib/syncService.ts` -- Add a `checkAndHandleConflict()` helper called before each sync function's write. For INSERT-only operations (new animals, new records), skip conflict detection since there's no existing server record to conflict with. For operations that could overlap (same animal/same date milk records, weight records), check `client_generated_id` dedup first, then call `detectConflict()` if the record already exists on server.

- `src/lib/offlineQueue.ts` -- Add `clientTimestamp` field to `QueueItem` interface (captures `updated_at` or creation time for conflict comparison).

**Conflict flow**:
```text
syncQueue processes item
  -> Is this an UPDATE to existing record? 
     YES -> detectConflict(table, recordId, clientTimestamp, clientData)
            -> has_conflict = true?
               YES -> recordConflict(farmId, table, recordId, clientData, serverData)
                   -> mark queue item status = 'conflict'
                   -> user sees FAB badge, opens SyncConflictResolution sheet
               NO  -> proceed with normal write
     NO (INSERT) -> proceed with dedup check + write (existing behavior)
```

### Workstream B: Orphan protection (deleted records)

**What changes**: Before applying a queued mutation that references an `animal_id`, verify the animal still exists on the server. If deleted, skip the mutation and notify the user.

**Files modified**:
- `src/lib/syncService.ts` -- Add `validateRecordExists()` helper that does a lightweight `SELECT id FROM {table} WHERE id = {id}` check before writes that reference foreign keys (animal_id). If the parent record is gone, mark the queue item as `failed` with a clear error message ("Animal was deleted on another device").

### Workstream C: Stale queue warning on login

**What changes**: When a user logs in on a new device, the offline queue is empty (fresh IndexedDB). But their old device might have unsynced items. Add a server-side check: compare `farm_sync_checkpoints.last_sync_at` with the oldest pending item in `sync_queue` (server table). If there are old unsynced items from another client, show a one-time warning.

**Files modified**:
- `src/lib/syncService.ts` -- Add `checkForStaleQueueOnOtherDevices()` function called once after login. Queries `sync_queue` for pending items by the same `user_id` but different `client_id`. If found, returns a warning payload.
- `src/hooks/useOnlineSync.ts` (or equivalent sync trigger hook) -- Call the stale check after successful auth + first sync, display a toast warning if stale items exist on another device.

### Documentation

- `docs/ssot-architecture.md` -- Add "Conflict Resolution Flow" section documenting the wired-up pipeline
- `changelog.md` -- Phase 6 entry

---

## Technical Details

### New queue item status

Add `'conflict'` to `QueueItem.status` union type. Items with this status:
- Are skipped by `syncQueue()` on subsequent runs
- Are visible in `SyncConflictResolution` UI via the existing `sync_conflicts` table
- Once resolved in UI, the resolution is applied and the queue item is marked `completed`

### Modified sync functions (Workstream A)

Only UPDATE-capable sync paths need conflict detection:
- `syncSingleMilk` / `syncBulkMilk` -- These are INSERTs with `client_generated_id` dedup. **No conflict detection needed** (dedup already handles it).
- `syncSingleWeight` -- INSERT. Dedup by `client_generated_id`. **No conflict detection needed**.
- `syncAnimalForm` -- INSERT. **No conflict detection needed**.
- Future edit operations (if/when animal profile editing goes offline) -- **Will need conflict detection**.

Current conclusion: The existing sync operations are all **INSERT-only**, so Workstream A is primarily a **framework** that will activate when edit operations are added to the offline queue. The `checkAndHandleConflict()` helper will be built and unit-tested but won't change current INSERT behavior.

### Orphan check (Workstream B)

```text
Before: syncBulkMilk inserts records referencing animal_id
After:  validateRecordExists('animals', animalId) 
        -> if missing, throw Error('PARENT_DELETED: Animal {earTag} was removed')
        -> syncService catches, marks item failed with user-friendly error
```

This protects against: User A deletes an animal on laptop, User B (offline on phone) records milk for that animal, then syncs.

### Stale queue warning (Workstream C)

Database migration needed: Add an RPC `check_stale_sync_items(p_user_id, p_client_id)` that queries `sync_queue` for pending items from the same user but a different client. Returns count + oldest timestamp.

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| All current sync ops are INSERTs | Workstream A builds the framework; activates when edit ops are added. No behavioral change to existing flows. |
| Orphan check adds latency per sync item | Batch check: collect all referenced animal_ids, do a single `SELECT id FROM animals WHERE id IN (...)` |
| Stale queue check requires server-side `sync_queue` data | Already exists from migration `20260102062607`; just needs an RPC |
| `'conflict'` status addition to QueueItem | Backward compatible; existing IndexedDB items don't have this status |

