

# Fix Demo Data Seeder: Per-Animal Species + Full Day Sessions

## Problems Found

1. **Wrong species config**: The seeder uses `farm.livestock_type` for ALL animals on a farm, but **128 out of ~713 demo animals** have a different `livestock_type` than their farm. For example, RUM-2601-57406456 is cattle on a goat farm, so it got goat-level milk values (0.5-3L instead of 4-15L).

2. **Still using AM/PM sessions**: The seeder still generates two separate AM/PM milking records instead of a single "Full Day" record per the recent migration.

3. **Milk volumes are per-session, not daily totals**: Since Full Day represents the whole day, the ranges need to reflect combined output.

## Changes (single file)

**File: `supabase/functions/seed-demo-data/index.ts`**

### A. Add `livestock_type` to animal query (line 165)

Add `livestock_type` to the SELECT so each animal's own species is available:
```typescript
.select('id, gender, life_stage, is_currently_lactating, birth_date, unique_code, livestock_type')
```

### B. Use per-animal species config (inside animal loop, line 199)

Move the species config lookup inside the animal loop so each animal uses its own `livestock_type`:
```typescript
for (const animal of animals) {
  const animalSpecies = (animal.livestock_type || farm.livestock_type || 'cattle').toLowerCase()
  const config = SPECIES_CONFIG[animalSpecies] || SPECIES_CONFIG.cattle
  // ... rest of animal processing
}
```

Remove the farm-level `const species = ...` and `const config = ...` from line 158-160.

### C. Update milk ranges for Full Day daily totals

| Species | Old (per session) | New (Full Day) |
|---------|-------------------|----------------|
| Cattle  | 4-15L             | 8-25L          |
| Goat    | 0.5-3L            | 1-5L           |
| Carabao | 2-6L              | 4-10L          |

### D. Switch milking from AM/PM loop to single Full Day record (lines 204-222)

Replace the `for (const session of ['AM', 'PM'])` inner loop with a single Full Day insert. The dedup check will look for ANY existing session (AM, PM, or Full Day) for that animal+date to avoid double-ups on farms with pre-existing AM/PM history:

```typescript
// Check if ANY session exists for this animal+date
const hasAM = existingMilk.has(`${animal.id}_${dateStr}_AM`)
const hasPM = existingMilk.has(`${animal.id}_${dateStr}_PM`)
const hasFullDay = existingMilk.has(`${animal.id}_${dateStr}_Full Day`)

if (!hasAM && !hasPM && !hasFullDay) {
  const liters = roundTo(randBetween(config.milkMin, config.milkMax, `${animal.id}_${dateStr}_FD`), 1)
  milkInserts.push({
    animal_id: animal.id,
    record_date: dateStr,
    session: 'Full Day',
    liters,
  })
}
```

### E. No other files need changes

The UI, compliance hooks, database constraint, and RPC already support "Full Day" from the previous migration. This is a single-file fix confined to the edge function.

## Summary

| What | Detail |
|------|--------|
| Root cause | Seeder used farm species instead of animal species; 128 animals affected |
| Fix | Use `animal.livestock_type` for per-animal species config |
| Session fix | Switch from AM/PM to single "Full Day" record |
| Volume fix | Adjust ranges to daily totals (e.g., cattle 8-25L) |
| Files changed | `supabase/functions/seed-demo-data/index.ts` only |

