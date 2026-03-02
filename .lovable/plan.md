

# Fix Unreliable Offline Detection on Android

## Problem

The WiFi indicator stays green even when offline on Android because `navigator.onLine` is unreliable in Capacitor WebView. It often reports `true` when the device has no actual internet connectivity (e.g., connected to WiFi router with no internet, or airplane mode in some WebView versions).

This is a critical cascading bug: since `navigator.onLine` is used in 50+ places across `dataCache.ts` to decide whether to serve stale cache (`!navigator.onLine && isWithinGrace`), a false `true` means the app rejects cached data AND fails network requests -- resulting in empty screens.

## Root Cause

`useOnlineStatus` and all direct `navigator.onLine` checks rely purely on the browser's passive `online`/`offline` events, which Android WebView does not fire reliably.

## Solution: Active Connectivity Probing

### 1. Upgrade `useOnlineStatus` hook with active ping

**File: `src/hooks/useOnlineStatus.ts`**

Add an active connectivity check that periodically pings the backend health endpoint alongside the passive browser events:

- On mount and every 10 seconds: attempt a lightweight `HEAD` request to the backend (e.g., `HEAD /rest/v1/` with a 5-second timeout)
- If the request fails or times out, set `isOnline = false` regardless of `navigator.onLine`
- If it succeeds, set `isOnline = true`
- Still listen to browser `online`/`offline` events for instant transitions (when they work)
- Export a non-hook `getIsOnline()` function that returns the last known state, for use in non-React code (like `dataCache.ts`)

### 2. Replace `navigator.onLine` in `dataCache.ts`

**File: `src/lib/dataCache.ts`**

Replace all 50+ occurrences of `navigator.onLine` with the shared `getIsOnline()` function from the upgraded hook. This ensures the active ping result is used everywhere, not just in React components.

### 3. Replace `navigator.onLine` in other files

**Files: `src/lib/syncService.ts`, `src/hooks/useBarns.ts`, `src/components/barns/BarnFormDialog.tsx`, and any other files using `navigator.onLine` directly**

Same replacement: use `getIsOnline()` from the shared module.

## Technical Details

### Active ping implementation

```text
Module: src/hooks/useOnlineStatus.ts

- Singleton state: let _isOnline = navigator.onLine (initial)
- Listeners: Set of callbacks for state changes
- checkConnectivity(): HEAD request to Supabase URL with 5s timeout
  - Success -> _isOnline = true
  - Failure/timeout -> _isOnline = false
  - Notify listeners on change
- Interval: every 10 seconds when document is visible
- Pause when document is hidden (save battery on mobile)
- Export: useOnlineStatus() hook (React), getIsOnline() function (non-React)
```

### Why HEAD request to backend

- Already authenticated, no CORS issues
- Minimal payload (HEAD = no body)
- Tests actual connectivity to the service the app needs
- 5-second timeout catches "connected but no internet" cases

### Files to modify

| File | Change |
|------|--------|
| `src/hooks/useOnlineStatus.ts` | Add active ping + export `getIsOnline()` |
| `src/lib/dataCache.ts` | Replace ~50 `navigator.onLine` with `getIsOnline()` |
| `src/hooks/useBarns.ts` | Replace `navigator.onLine` with `getIsOnline()` |
| `src/lib/syncService.ts` | Replace `navigator.onLine` with `getIsOnline()` |
| `src/components/barns/BarnFormDialog.tsx` | Replace `navigator.onLine` with `getIsOnline()` |
| Any other files using `navigator.onLine` | Same replacement |
| `changelog.md` | Document fix |

### Impact

- NetworkStatusIndicator automatically shows correct red/green state (it already consumes `useOnlineStatus`)
- All 50+ cache grace period checks in `dataCache.ts` correctly serve stale data when truly offline
- Barn offline operations correctly branch to optimistic path
- Sync service correctly skips when offline

