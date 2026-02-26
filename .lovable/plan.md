

# Phase 4: Remaining Mutation Fixes — Route Farm-Level Mutations Through CacheManager

## Analysis

After reviewing all 12 hooks flagged in the audit, they fall into two distinct groups:

### Group A: Farm-Scoped Mutations (Route through CacheManager)
These have a `farmId` and mutate farm-level data:

| Hook | Mutations | New CacheManager Type |
|------|-----------|----------------------|
| `useAnimalExpenses` | add, delete | Reuse existing `'expense'` type (already covers `farm_expenses`) |
| `useFarmSettings` | update | New `'farm-settings'` type |
| `useBarns` | create, update, assign, remove | New `'barn'` type |
| `useDailyChecklist` | toggle item | New `'checklist'` type |
| `usePendingActivities` | review, delete, update, resubmit | New `'pending-activity'` type |
| `useFarmerFeedback` | submit | New `'farmer-feedback'` type |

### Group B: Non-Farm Mutations (Exclude from CacheManager)
These are merchant/platform/government-scoped with no `farmId`. CacheManager is architecturally farm-keyed, so forcing these through it would be a design violation. They stay with manual invalidation but get documentation headers:

| Hook | Reason |
|------|--------|
| `useMerchantOrders` | Merchant-scoped, no farmId |
| `useMerchantProducts` | Read-only hook (no mutations to fix) |
| `useInvoices` | Merchant-scoped, no farmId |
| `usePlatformSettings` | Admin-scoped, no farmId |
| `useGovernmentFeedback` | Government-scoped, cross-farm, `@online-only` |

---

## Changes

### 1. `src/lib/cacheManager.ts` — Add 5 new mutation types to CACHE_DEPENDENCIES

```text
'farm-settings'     -> ['farm-settings']
'barn'              -> ['barns', 'barn-animals', 'farm-animals']
'checklist'         -> ['daily-checklist']
'pending-activity'  -> ['pending-activities']
'farmer-feedback'   -> ['farmer-feedback']
```

No new IndexedDB stores needed — these are React Query-only caches (no offline cache equivalent).

### 2. `src/hooks/useAnimalExpenses.ts` — Route through existing `'expense'` type

- `useAddAnimalExpense`: Replace 3 manual `invalidateQueries` calls with `getCacheManager().invalidateForMutation('expense', expenseData.farm_id)`. Also invalidate animal-specific keys manually (animal-scoped, not farm-keyed in CacheManager).
- `useDeleteAnimalExpense`: Same pattern. Requires passing `farmId` alongside `expenseId` and `animalId`.

### 3. `src/hooks/useFarmSettings.ts` — Route through `'farm-settings'`

- `useUpdateFarmSettings`: Replace manual `invalidateQueries` with `getCacheManager().invalidateForMutation('farm-settings', farmId)`.

### 4. `src/hooks/useBarns.ts` — Route through `'barn'`

- `useCreateBarn`, `useUpdateBarn`, `useAssignAnimalToBarn`, `useRemoveAnimalFromBarn`: Replace all manual `invalidateQueries` calls with `getCacheManager().invalidateForMutation('barn', farmId)`.

### 5. `src/hooks/useDailyChecklist.ts` — Route through `'checklist'`

- `toggleItem` mutation: Replace manual `invalidateQueries` with `getCacheManager().invalidateForMutation('checklist', farmId)`.

### 6. `src/hooks/usePendingActivities.ts` — Route through `'pending-activity'`

- `reviewMutation`, `deleteMutation`, `updateMutation`, `resubmitMutation`: Replace all manual `invalidateQueries` calls with `getCacheManager().invalidateForMutation('pending-activity', farmId)`.
- Challenge: `farmId` is optional in this hook. Use it when available; fall back to manual invalidation when only `userId` is provided (farmhand view without farmId).

### 7. `src/hooks/useFarmerFeedback.ts` — Route through `'farmer-feedback'`

- `submitFeedback` mutation: Replace manual `invalidateQueries` with `getCacheManager().invalidateForMutation('farmer-feedback', farmId)`.

### 8. Documentation headers for Group B hooks

Add `@cache-status MANUAL — Non-farm-scoped, CacheManager not applicable` comment block to:
- `useMerchantOrders.ts`
- `useMerchantProducts.ts`
- `useInvoices.ts`
- `usePlatformSettings.ts`
- `useGovernmentFeedback.ts` (already has `@online-only`; add cache-status note)

### 9. Documentation updates

- `docs/ssot-architecture.md`: Update Hook Inventory with all Phase 4 changes.
- `changelog.md`: Add Phase 4 entry.

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| `usePendingActivities` optional farmId | Conditional: use CacheManager when farmId present, manual invalidation otherwise |
| `useAnimalExpenses` needs farmId in delete | Add farmId to delete mutation variables (minor interface change) |
| No IndexedDB stores for new types | Intentional — these are low-priority caches without offline requirements |

