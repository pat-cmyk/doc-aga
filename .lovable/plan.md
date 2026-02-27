

# Shift Demo AI Records Into Current Date Range

## Problem
The 251 demo AI records have dates ranging from Dec 2021 to Nov 13, 2025. The "Last 90 Days" filter on the Government Breeding Overview covers Nov 29, 2025 - Feb 27, 2026, so none of the records appear, resulting in all-zero stats cards.

## Solution: Two-Part Fix

### Part 1: One-Time Data Update (immediate)
Shift all date columns on demo AI records forward by **109 days** (the gap between the latest record and today). This moves the data window from Sep-Nov 2025 into Dec 2025 - Feb 2026.

Affected columns:
- `scheduled_date` (+109 days)
- `performed_date` (+109 days, where not null)
- `confirmed_at` (+109 days, where not null)
- `expected_delivery_date` (+109 days, where not null)

This affects only records belonging to animals on `data_category = 'demo'` farms (251 records).

### Part 2: Add AI Record Seeding to Edge Function (ongoing)
Update `supabase/functions/seed-demo-data/index.ts` to also generate AI records for demo farm animals, so future daily runs keep the breeding data current. The logic will:

- For each lactating female without an AI record in the last 30 days, create a new AI record with:
  - `scheduled_date` within the last 7 days
  - `performed_date` 0-2 days after scheduled
  - ~40% marked as `pregnancy_confirmed = true` with `expected_delivery_date` ~283 days (cattle) / ~150 days (goat) / ~310 days (carabao) after performed date
  - `confirmed_at` set ~60 days after performed date for confirmed pregnancies
- Link to existing semen codes or use generic breed-appropriate codes

## Files Modified

| File | Change |
|------|--------|
| Database (data update) | UPDATE `ai_records` dates +109 days for demo animals |
| `supabase/functions/seed-demo-data/index.ts` | Add AI record gap-fill logic alongside existing milking/weight/health/BCS/feeding seeding |
| `src/components/admin/SeedDemoDataButton.tsx` | Add `ai_inserted` to results display table |

## Technical Details

### Data Update SQL
```sql
UPDATE ai_records
SET
  scheduled_date = scheduled_date + INTERVAL '109 days',
  performed_date = performed_date + INTERVAL '109 days',
  confirmed_at = confirmed_at + INTERVAL '109 days',
  expected_delivery_date = expected_delivery_date + INTERVAL '109 days'
WHERE animal_id IN (
  SELECT id FROM animals
  WHERE farm_id IN (SELECT id FROM farms WHERE data_category = 'demo')
);
```

### Edge Function Addition
New seeding block in the per-farm loop:
1. Query existing `ai_records` for farm animals in the last 30 days
2. For eligible females missing records, generate 1 AI record per animal
3. Use species-specific gestation periods for `expected_delivery_date`
4. Batch insert like existing record types
5. Track `ai_inserted` count in summary

### UI Update
Add an "AI" column to the seed results table in `SeedDemoDataButton.tsx`, following the same pattern as the existing Milk/Weight/Health/BCS/Feed columns.
