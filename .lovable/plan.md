

# Plan: Run 2 Database Migrations + Fix Build Error

## Migration 1: Species-Specific VWP

The file `supabase/migrations/20260304120000_species_specific_vwp.sql` is ready. It replaces `update_animal_fertility_status()` to use 45-day VWP for goat/sheep and 60-day for cattle/carabao. This is a `CREATE OR REPLACE FUNCTION` — safe, no data changes.

**SQL to run via migration tool:**
The full contents of `supabase/migrations/20260304120000_species_specific_vwp.sql` (lines 14-95).

## Migration 2: Revenue Source Standardization (Critical)

The file `supabase/migrations/20260304130000_standardize_revenue_sources.sql` is ready. It has 5 steps:
1. Drop old CHECK constraint on `farm_revenues.source`
2. Update legacy source names ("Milk Sales" → "Milk Sale", "Livestock Sales" → "Animal Sale", etc.)
3. Add new CHECK constraint with the 6 allowed values
4. Replace `fix_missing_milk_revenues` RPC to use "Milk Sale"
5. Replace `sync_milk_sale_to_revenue` trigger to use "Milk Sale"

## Verification Queries (after both migrations)

1. `SELECT source, COUNT(*) FROM farm_revenues GROUP BY source ORDER BY source;` — should only show the 6 standard values
2. `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.farm_revenues'::regclass AND contype = 'c';` — should show `farm_revenues_source_check`
3. `SELECT prosrc FROM pg_proc WHERE proname = 'sync_milk_sale_to_revenue';` — should contain `'Milk Sale'` not `'Milk Sales'`

## Build Error Fix

`src/components/dashboard/OnboardingChecklist.tsx` line 55 has `TS2589: Type instantiation is excessively deep`. The `.from("milking_records").select("id", { count: "exact", head: true })` call needs an explicit type cast (e.g., `.select("id" as any, ...)`) or restructuring to avoid the deep type recursion from the generated Supabase types.

## Execution Order

1. Run Migration 1 (VWP)
2. Run Migration 2 (Revenue sources)
3. Run verification queries
4. Fix the OnboardingChecklist build error

