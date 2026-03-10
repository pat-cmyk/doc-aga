

# Plan: Fix Doc Aga Missing `farmId` in Request

## Problem
`DocAgaConsultation` receives `farmId` as a prop but never sends it to the `doc-aga` edge function. The fetch body (line 164-170) only includes `messages` and `conversationId`. This means:

1. The edge function falls back to picking the user's first farm — which may be wrong for multi-farm users.
2. All tool calls (animal search, health records, milking, etc.) operate on the wrong farm.
3. `MerchantFab` passes `farmId=""` which would fail the UUID validation in the edge function schema.

## Fix

### 1. `src/components/farmhand/DocAgaConsultation.tsx`
Add `farmId` to the fetch request body:
```typescript
body: JSON.stringify({ 
  messages: truncateMessages([...]),
  conversationId,
  farmId: farmId || undefined  // Send farmId if available
}),
```

### 2. `src/components/merchant/MerchantFab.tsx`
Stop passing empty string `farmId=""`. Either omit it or pass `undefined` so the edge function's fallback logic works correctly.

## No Backend Changes
The edge function already accepts and handles `farmId` correctly — it validates UUID format, checks farm access via `can_access_farm` RPC, and uses it for all tool calls. The bug is purely client-side: the prop is never forwarded in the HTTP request.

