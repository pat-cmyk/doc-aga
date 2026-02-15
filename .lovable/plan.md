
# Fix: Mother Dropdown Empty — Birth Date Filter Too Strict

## Root Cause (Verified via Database Query)

The mother dropdown shows **zero animals** because of an overly strict filter in the animal cache (`src/lib/animalCache.ts`).

The filter requires mothers to:
1. Be female -- all 7 animals pass
2. Have a `birth_date` set (not null) -- **6 out of 7 fail** (all have `birth_date: null` except SalRen)
3. Be born at least 16 months ago -- SalRen fails (born 2025-03-10, only ~11 months old)

**Result: 0 animals pass the mother filter. The dropdown is empty.**

This affects the **Add Animal form** (`AnimalForm.tsx`) which uses the cache. The **Edit Animal dialog** (`EditAnimalDialog.tsx`) uses a separate query without the birth_date filter, so it should work correctly.

### Database Evidence

```text
Name     | birth_date | Passes filter?
---------|------------|---------------
Balat    | null       | NO (no birth_date)
Black    | null       | NO (no birth_date)
Blessie  | null       | NO (no birth_date)
Cookie   | null       | NO (no birth_date)
Lavina   | null       | NO (no birth_date)
Pula     | null       | NO (no birth_date)
SalRen   | 2025-03-10 | NO (only 11 months old)
```

## The Fix

### File: `src/lib/animalCache.ts` (lines 61-68)

Change the mother/father filter to include animals with unknown birth dates. Animals without a `birth_date` should still be eligible as parents (the farmer entered them as adults without recording birth date).

**Current logic:**
```typescript
const mothers = (animals || [])
  .filter(a => 
    a.gender?.toLowerCase() === 'female' &&
    a.birth_date &&                              // PROBLEM: excludes null
    new Date(a.birth_date) <= sixteenMonthsAgo   // PROBLEM: excludes young
  )
```

**Fixed logic:**
```typescript
const mothers = (animals || [])
  .filter(a => 
    a.gender?.toLowerCase() === 'female' &&
    (!a.birth_date || new Date(a.birth_date) <= sixteenMonthsAgo)
  )
```

The same fix applies to the `fathers` filter on lines 70-76.

**Logic explanation:** If birth_date is unknown (null), include the animal as a potential parent. If birth_date IS known, only include if the animal is old enough (16+ months). This matches real-world usage: farmers enter adult animals without birth dates, and those animals are clearly old enough to be parents.

### File: `src/components/animal-details/hooks/useEditAnimalForm.ts`

No changes needed. This file already uses a simple gender-only filter (line 176), which is correct for the edit dialog.

## Files to Change

| File | Change |
|------|--------|
| `src/lib/animalCache.ts` | Update mother AND father filters to include animals with null birth_date |

## Verification Plan

1. After the fix, navigate to the farm page for SSG Cattle
2. Open "Add Animal" form and select "Offspring" type
3. Confirm the Mother dropdown now shows 6 female names (Balat, Black, Blessie, Cookie, Lavina, Pula) -- SalRen excluded as too young
4. Confirm the Edit dialog also shows mothers correctly (it should already work)
