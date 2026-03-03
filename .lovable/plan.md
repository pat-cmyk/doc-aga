
# Fix: 3 Build Errors Causing White Screen

The app shows a white screen because TypeScript compilation fails on 3 type mismatches. All are simple missing-property fixes.

## Error 1: `src/lib/dataCache.ts` line 867 — Missing `bcs` in RecordCache

The `RecordCache` interface (line 226) requires a `bcs: any[]` field, but the success path of `updateRecordsCache()` at line 867 omits it.

**Fix**: Add `bcs: [],` to the cache object at line 874 (after the `feeding` line). Optionally, also add a BCS query to the `Promise.all` if BCS records exist in the database.

## Error 2: `src/lib/dataCache.ts` line 1355 — `'bcs'` not in union type

The `addOptimisticRecords` function parameter accepts `'bcs'` in its union at line 1343, but line 1355 or a downstream usage narrows the type to exclude `'bcs'`. 

**Fix**: Find any narrowed type usage near line 1355 and add `'bcs'` to the union. The function signature already includes it, so this is likely a type guard or destructured access that needs updating.

## Error 3: `src/lib/devicePermissionService.ts` line 87 — Missing `location`

The `PermissionResults` interface (line 11) requires `location: PermissionStatus`, but the early return at line 87 omits it.

**Fix**: Change line 87 from:
```typescript
return { camera: 'prompt', microphone: 'prompt', notifications: 'prompt' };
```
to:
```typescript
return { camera: 'prompt', microphone: 'prompt', location: 'prompt', notifications: 'prompt' };
```

## Error 4: `supabase/functions/seed-demo-data/index.ts` lines 800-810

The summary object includes `ai_inserted`, `feedback_inserted`, and `bcs_inserted` but the TypeScript type for the summary array doesn't include those fields.

**Fix**: The summary is pushed into a local `summary` array. Either:
- Add an explicit type with all fields, or
- Use `as any` on the push, or
- Define the type inline with all 12 properties including `bcs_inserted`, `ai_inserted`, and `feedback_inserted`.

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/dataCache.ts` | Add `bcs: []` to success path at line 874; verify union type at line 1355 |
| `src/lib/devicePermissionService.ts` | Add `location: 'prompt'` to early return at line 87 |
| `supabase/functions/seed-demo-data/index.ts` | Add missing properties to summary type near line 792 |
