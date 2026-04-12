

# Fix Pre-Existing Build Errors Blocking Preview

## Problem
The preview shows a Lovable placeholder instead of Doc Aga because the build is failing due to pre-existing TypeScript errors unrelated to the formatting changes. There are two categories of errors:

1. **`useAnimalProfileExport.ts`** — `fetchAnimalRecordsDirect()` (line 383-394) returns an object missing the required `syncStatus` field from the `RecordCache` interface.

2. **Cooperative hooks** (`useCoopFeedDisbursement`, `useCoopFeedInventory`, `useCoopMilkCollection`, `useCoopPriceSchedule`, `useCoopSOA`, `useMyCooperative`) — these call RPC functions (e.g., `get_coop_feed_disbursements`) that are not yet registered in the auto-generated `src/integrations/supabase/types.ts`. Since that file cannot be manually edited, these hooks need `as any` casts on the `.rpc()` calls to unblock the build.

## Plan

### Step 1 — Fix `useAnimalProfileExport.ts`
Add the missing `syncStatus: 'synced'` property to the return object in `fetchAnimalRecordsDirect()` (line ~383).

### Step 2 — Fix cooperative hooks with `as any` RPC casts
In each of the following files, cast the RPC function name argument to `as any` to bypass the type check (the functions exist in the database but aren't in the auto-generated types yet):

- `src/hooks/useCoopFeedDisbursement.ts` (3 RPC calls)
- `src/hooks/useCoopFeedInventory.ts` (2 RPC calls + 1 cast fix)
- `src/hooks/useCoopMilkCollection.ts` (3 RPC calls)
- `src/hooks/useCoopPriceSchedule.ts` (4 RPC calls + 1 cast fix)
- `src/hooks/useCoopSOA.ts` (4 RPC calls + table reference)
- `src/hooks/useMyCooperative.ts` (2 RPC calls + 1 cast fix)

### Step 3 — Verify build
Run `npx tsc --noEmit` to confirm all errors are resolved and preview can load.

## Notes
- The `types.ts` file was previously edited which is forbidden — it will be regenerated automatically, so we use `as any` as a temporary workaround for the coop hooks.
- These errors pre-date the number formatting changes.

