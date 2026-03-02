

# Fix: Revert Connectivity Detection + Fix Offline Barn Creation

## Two Issues

### Issue 1: Active Connectivity Probing Keeps Failing
The active `HEAD` probing introduced today continues to cause problems on Android. Even after adding the `apikey` header, it's unreliable on the user's device. The user wants to revert to the previous `navigator.onLine` approach.

**Fix**: Revert `useOnlineStatus.ts` to use `navigator.onLine` with passive browser events only. Keep the `getIsOnline()` export so the 50+ consumer files (dataCache, offlineQueue, etc.) don't need changes -- just make it return `navigator.onLine` instead of the probing result.

### Issue 2: Barn Creation Fails Offline
The `useCreateBarn` hook captures `isOnline` from `useOnlineStatus()` at **render time**. When the user goes offline after the component rendered, the stale `isOnline = true` sends the mutation down the online path, which hits the server and fails -- instead of creating locally.

**Root Cause**: `useCreateBarn` line 179 checks `if (isOnline)` but `isOnline` is a closure from the last render, not the current connectivity state.

**Fix**: Inside `mutationFn`, call `getIsOnline()` at **execution time** instead of using the hook's stale value. Same fix needed for `useUpdateBarn`, `useAssignAnimalToBarn`, and `useRemoveAnimalFromBarn`.

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useOnlineStatus.ts` | Revert to `navigator.onLine` with passive events; keep `getIsOnline()` export returning `navigator.onLine` |
| `src/hooks/useBarns.ts` | Import `getIsOnline` and use it inside `mutationFn` instead of hook's `isOnline` for all 4 mutations |
| `changelog.md` | Document changes |

## Technical Details

### useOnlineStatus.ts (Reverted)

Remove the active probing singleton (`checkConnectivity`, `startProbing`, intervals, `HEAD` requests). Return to:
- `useOnlineStatus()` hook: `useState(navigator.onLine)` + `online`/`offline` event listeners
- `getIsOnline()`: simply returns `navigator.onLine`

This preserves the SSOT accessor pattern so all 50+ consumer files (`dataCache.ts`, `offlineQueue.ts`, `offlineAudioSyncProcessor.ts`, `BarnFormDialog.tsx`, `UserEmailDropdown.tsx`, `voice-input-button.tsx`, `useVoiceRecording.ts`, `useOfflineAudioSync.ts`) continue working without changes.

### useBarns.ts (Execution-Time Check)

For each of the 4 mutation hooks (`useCreateBarn`, `useUpdateBarn`, `useAssignAnimalToBarn`, `useRemoveAnimalFromBarn`):
- Remove `const isOnline = useOnlineStatus()` from the hook (or keep for UI display only)
- Inside each `mutationFn`, replace `if (isOnline)` with `if (getIsOnline())` to check connectivity at the moment of execution, not at render time

This ensures that if the user goes offline after the form renders, the mutation correctly takes the offline path -- creating the barn locally in IndexedDB and queuing for sync.

