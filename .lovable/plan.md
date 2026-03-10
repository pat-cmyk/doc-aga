

# Plan: Run Grant Effectiveness RPC Migration + Fix 3 Build Errors

## 1. Database Migration — `get_grant_effectiveness` RPC

Run the full SQL provided in the user's message via the migration tool. This creates the `get_grant_effectiveness` RPC function and grants execute to authenticated users.

## 2. Fix Build Error: `useGrantEffectiveness.ts` (TS2345)

The RPC `get_grant_effectiveness` does not exist in the auto-generated types yet. Until types regenerate, cast the RPC call to bypass type checking:

```typescript
const { data, error } = await (supabase.rpc as any)("get_grant_effectiveness", { ... });
```

## 3. Fix Build Error: `AnimalDetails.tsx` (TS2339)

The local `Animal` interface (line 177-207) is missing `fertility_status`. Add it:

```typescript
fertility_status: string | null;
```

## 4. Fix Build Error: `AnimalList.tsx` (TS2339)

The local `Animal` interface (line 128-143) is missing `fertility_status`. Add it:

```typescript
fertility_status?: string | null;
```

## Execution Order

1. Run SQL migration
2. Fix all 3 TypeScript errors in parallel

