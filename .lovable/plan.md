
# Fix Animal Count Discrepancy: Data Repair + Query Alignment

## Problem

Two animals (ear tags 2722 and 0029) have `exit_date` values in the database that should not be there. This causes the Breeding Hub to show only 6 females instead of 8, while the Animals tab and admin dashboard show all 9 because they don't check `exit_date`.

## Two-Part Fix

### Part 1: Data Repair (Database)

Clear the erroneous `exit_date` and `exit_reason` values from these two animals:

```text
Animal: ear_tag 2722 (id: ecf995b9-...) -- exit_date: 2026-01-23, reason: transferred
Animal: ear_tag 0029 (id: 9c1dfee7-...) -- exit_date: 2025-11-21, reason: slaughtered
```

Both will be updated to set `exit_date = NULL` and `exit_reason = NULL`, restoring them as active animals.

**Verification**: After the fix, a query will confirm all 9 animals have `exit_date IS NULL`.

### Part 2: Code Alignment (3 files)

Even after clearing the bad data, the code has an inconsistency: some queries filter by `exit_date` and others don't. If any animal is legitimately exited in the future, the same mismatch will occur. All animal-list queries should be aligned.

#### 2a. `src/lib/dataCache.ts` (~line 501)

Add `.is('exit_date', null)` to the `updateAnimalCache` query, matching what `useBreedingHub`, `useFarmAnimals`, and 15+ other hooks already do.

```typescript
const { data: animals, error } = await supabase
  .from('animals')
  .select('*')
  .eq('farm_id', farmId)
  .eq('is_deleted', false)
  .is('exit_date', null)          // ADD THIS
  .order('created_at', { ascending: false });
```

#### 2b. `src/lib/animalCache.ts` (~line 55)

Add the same filter to the offline parent-picker cache so it stays consistent.

```typescript
const { data: animals, error } = await supabase
  .from('animals')
  .select('id, name, ear_tag, breed, livestock_type, gender, birth_date')
  .eq('farm_id', farmId)
  .eq('is_deleted', false)
  .is('exit_date', null)          // ADD THIS
```

#### 2c. `src/components/admin/FarmOversight.tsx` (~line 148-152)

Update the admin "active count" query to also exclude animals with `exit_date`, so the admin dashboard accurately reflects true active animals vs exited ones.

```typescript
// Current (only checks is_deleted):
supabase.from("animals").select("*", { count: "exact", head: true })
  .eq("farm_id", farm.id)
  .eq("is_deleted", false)

// Fixed (also checks exit_date):
supabase.from("animals").select("*", { count: "exact", head: true })
  .eq("farm_id", farm.id)
  .eq("is_deleted", false)
  .is("exit_date", null)          // ADD THIS
```

The admin column header currently shows "active / deleted". We can also add a third counter for "exited" animals (those with `exit_date` set but `is_deleted = false`) to make the admin view fully transparent.

## Expected Result After Fix

- Animals tab: 9 animals (all active, no exit dates)
- Breeding Hub: 8 females (all active, excluding 1 male)
- Admin dashboard: 9 / 0 (accurately reflecting reality)
- Future exits will be consistently hidden from all active views

## Files Summary

| File | Action |
|------|--------|
| Database (animals table) | Data repair -- clear exit_date on 2 animals |
| `src/lib/dataCache.ts` | Add `.is('exit_date', null)` to updateAnimalCache |
| `src/lib/animalCache.ts` | Add `.is('exit_date', null)` to offline cache query |
| `src/components/admin/FarmOversight.tsx` | Add `.is('exit_date', null)` to admin active count |

## Verification Steps

1. Before: Show the 2 animals with exit_date values
2. Execute: Clear exit_dates + apply code fixes
3. After: Query confirming all 9 animals have exit_date IS NULL
4. After: Confirm Breeding Hub shows 8 females
