

# Plan: Reduce Sync Frequency and Fix Sync Status Sheet Layout

## Issues Identified

### Issue 1: Excessive Sync Frequency
The app triggers sync operations too frequently - almost on every page/window transition. This creates unnecessary API calls and battery drain.

**Root Cause Analysis:**

Looking at `src/App.tsx`, the current sync behavior:
1. **Lines 128-142**: Syncs whenever `isOnline` becomes true (correct behavior)
2. **Lines 144-159**: Runs periodic sync every 5 minutes while online
3. **Lines 98-104**: Service worker bridge can trigger additional syncs
4. **React Query config (lines 70-71)**: `refetchOnReconnect: 'always'` causes data refetch on network reconnect

The issue is that `isOnline` from `useOnlineStatus` hook can fluctuate frequently on mobile devices with unstable connections, and each fluctuation triggers a new sync.

Additionally, pages like Dashboard.tsx also call `syncQueue()` in their refresh handlers.

### Issue 2: Sync Status Sheet Overlaps Top of Screen
The `SyncStatusSheet` component at line 119 has:
```tsx
<SheetContent side="right" className="w-full sm:max-w-md">
```

This lacks the `pt-safe` class that other sheets have for safe area insets on Android devices.

---

## Solution

### Part 1: Reduce Sync Frequency

**Changes to `src/App.tsx`:**

1. **Add debounce/cooldown to online sync** - Prevent rapid-fire syncs when network status flickers
2. **Increase periodic sync interval** - Change from 5 minutes to 15 minutes
3. **Add minimum time between syncs** - Ensure at least 30 seconds between any sync operations

**Technical Implementation:**
- Add a `lastSyncTimeRef` to track the last sync timestamp
- Add a `SYNC_COOLDOWN` constant (30 seconds minimum between syncs)
- Modify the `isOnline` useEffect to check cooldown before syncing
- Increase periodic interval from 5 minutes to 15 minutes

### Part 2: Fix Sync Status Sheet Layout

**Changes to `src/components/sync/SyncStatusSheet.tsx`:**

1. Add `pt-safe` class to `SheetContent` for Android safe area inset
2. Adjust the `ScrollArea` height calculation to account for safe area

---

## Detailed Code Changes

### File 1: `src/App.tsx`

```typescript
// Add a ref to track last sync time
const lastSyncTimeRef = useRef<number>(0);
const SYNC_COOLDOWN = 30000; // 30 seconds minimum between syncs

// In the isOnline useEffect, add cooldown check:
useEffect(() => {
  if (isOnline) {
    const now = Date.now();
    const timeSinceLastSync = now - lastSyncTimeRef.current;
    
    if (timeSinceLastSync < SYNC_COOLDOWN) {
      console.log('[SyncHandler] Sync cooldown active, skipping...');
      return;
    }
    
    console.log('[SyncHandler] Online detected, requesting background sync...');
    lastSyncTimeRef.current = now;
    
    requestBackgroundSync().then((registered) => {
      if (!registered) {
        setTimeout(() => syncQueue(), 2000);
      }
    });
  }
}, [isOnline]);

// Change periodic sync from 5 minutes to 15 minutes
const interval = setInterval(() => {
  console.log('[SyncHandler] Running periodic sync...');
  syncQueue();
}, 15 * 60 * 1000); // 15 minutes instead of 5
```

### File 2: `src/components/sync/SyncStatusSheet.tsx`

**Line 119 - Add safe area padding:**
```tsx
// Before:
<SheetContent side="right" className="w-full sm:max-w-md">

// After:
<SheetContent side="right" className="w-full sm:max-w-md pt-safe">
```

**Line 127 - Adjust ScrollArea height to account for safe area:**
```tsx
// Before:
<ScrollArea className="h-[calc(100vh-100px)] mt-4">

// After:  
<ScrollArea className="h-[calc(100vh-100px-env(safe-area-inset-top,0px))] mt-4">
```

---

## Summary of Changes

| File | Change | Purpose |
|------|--------|---------|
| `src/App.tsx` | Add 30-second sync cooldown | Prevent rapid sync on network flicker |
| `src/App.tsx` | Increase periodic sync to 15 min | Reduce battery/API usage |
| `src/components/sync/SyncStatusSheet.tsx` | Add `pt-safe` class | Fix overlap with phone status bar |
| `src/components/sync/SyncStatusSheet.tsx` | Adjust ScrollArea height | Ensure content fits within safe area |

---

## Expected Behavior After Fix

1. **Sync Frequency**: 
   - Sync will only trigger once every 30 seconds maximum when network status changes
   - Periodic background sync runs every 15 minutes instead of 5 minutes
   - Manual sync (via "Sync Now" button) always works immediately

2. **Sync Status Sheet**:
   - Sheet will respect Android status bar/notch area
   - Content will not overlap with system UI elements
   - Consistent with other sheets in the app (like `QueueStatus.tsx`)

