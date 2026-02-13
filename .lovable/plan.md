

# Update Demo Data Seeder: Start from T-1 (Yesterday)

## Rationale

The seeder currently generates records starting from T-0 (today), which creates data for a day still in progress. Shifting to T-1 ensures all seeded records represent completed days only.

## Changes (single file)

**File: `supabase/functions/seed-demo-data/index.ts`**

### A. Milking records loop (around line 156)

Change the loop from `d = 0` to `d = 1` so it generates records for yesterday (T-1) through 7 days ago (T-7):

```typescript
// Before
for (let d = 0; d < 7; d++) {

// After
for (let d = 1; d <= 7; d++) {
```

### B. Feeding records loop (around line 188)

Same change for the feeding loop:

```typescript
// Before
for (let d = 0; d < 7; d++) {

// After
for (let d = 1; d <= 7; d++) {
```

### C. Weight, Health, and BCS records (single-record inserts)

These currently use `now.toISOString().split('T')[0]` (today) as the record date. Change to yesterday:

```typescript
const yesterday = new Date(now)
yesterday.setDate(yesterday.getDate() - 1)
const yesterdayStr = yesterday.toISOString().split('T')[0]
```

Then use `yesterdayStr` instead of `now.toISOString().split('T')[0]` for:
- `weight_records.measurement_date`
- `health_records.visit_date` (the random offset already goes back 0-14 days, so the base shifts by 1 day)
- `body_condition_scores.assessment_date`

### D. DRM/Changelog update

Add a changelog entry in `docs/data-relationships-map.md` noting the T-1 shift.

## Summary

| What | Detail |
|------|--------|
| Change | Seed from T-1 through T-7 instead of T-0 through T-6 |
| Reason | Avoid creating records for a day still in progress |
| Files | `seed-demo-data/index.ts`, `docs/data-relationships-map.md` |

