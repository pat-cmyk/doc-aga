

# Fix: App Stuck Offline Due to Missing API Key in Connectivity Probe + Sync Sheet Navigation

## Problem

Two issues:

1. **App permanently detects as offline** -- The active connectivity probe in `useOnlineStatus.ts` sends a bare `HEAD` request to `/rest/v1/` without the `apikey` header. The server returns `401 Unauthorized` which, lacking CORS headers for unauthenticated requests, causes a browser-level network error. The `catch` block fires every 10 seconds, permanently setting `_isOnline = false`. This blocks ALL downstream behavior:
   - `getIsOnline()` returns `false` across 50+ consumers in `dataCache.ts`, `syncService.ts`, `useBarns.ts`, etc.
   - Animal data is never downloaded (cache-first hooks skip fetch because they think the app is offline)
   - Sync queue never processes (sync button is disabled, automatic sync skips)
   - Network indicator shows offline (red) even though the server is reachable

2. **No back button on Sync Status sheet** -- The `SyncStatusSheet` uses a full-width `Sheet` on mobile. The default shadcn `SheetClose` (X icon) exists but may be hard to find. No explicit close/back button is visible.

## Root Cause Verification

From the network request logs:
- `HEAD /rest/v1/` at `01:56:12Z` -- Status: **401**, no apikey header sent
- `HEAD /rest/v1/` at `01:56:22Z` -- Status: **401**, no apikey header sent
- `HEAD /rest/v1/` at `01:56:32Z` -- Status: **401**, no apikey header sent

Meanwhile, all other requests with `apikey` header succeed with `200`. The probe is the only request missing authentication.

## Fix

### File 1: `src/hooks/useOnlineStatus.ts`

Two changes to `checkConnectivity()`:

**A. Add the `apikey` header** so the request passes CORS and gets a proper response:

```text
headers: {
  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
}
```

**B. Treat any HTTP response as "online"** -- A `401` or `403` still proves the server is reachable. Only network-level errors (DNS failure, timeout, abort) should indicate offline. The current code already does this implicitly (the `await fetch()` resolves for any HTTP status), but adding the apikey ensures CORS headers are present so the fetch actually resolves instead of throwing.

No changes needed to the singleton pattern, `getIsOnline()`, or any of the 50+ consumer files -- they all automatically get the corrected state via the existing SSOT accessor.

### File 2: `src/components/sync/SyncStatusSheet.tsx`

Add an explicit close button in the `SheetHeader` using the existing `SheetClose` from shadcn or a manual `setIsOpen(false)` button with an `ArrowLeft` icon, following the same pattern used elsewhere in the app for sheet/dialog headers on mobile.

### File 3: `changelog.md`

Document both fixes.

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useOnlineStatus.ts` | Add `apikey` header to `checkConnectivity()` fetch call |
| `src/components/sync/SyncStatusSheet.tsx` | Add explicit close/back button in SheetHeader |
| `changelog.md` | Document fixes |

## Cascading Impact (No Additional Changes Needed)

Once `checkConnectivity()` correctly resolves to online:
- `getIsOnline()` returns `true` -- all 50+ consumers in `dataCache.ts`, `syncService.ts`, `useBarns.ts`, `offlineQueue.ts`, `UserEmailDropdown.tsx`, etc. automatically work correctly
- `useOnlineStatus()` hook updates React components -- `NetworkStatusIndicator` shows green, `SyncStatusSheet` enables the Sync Now button
- Animal data downloads resume on next cache-first hook cycle
- Queued offline mutations sync automatically

This is a 1-line root cause fix with zero downstream changes required, which is the benefit of the existing SSOT singleton pattern.

