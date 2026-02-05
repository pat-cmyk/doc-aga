
# Seed Complete Breeding Data for Government Dashboard

## Problem Summary

The Reproduction & Breeding section shows zero/empty values because:

| Metric | Current | Reason |
|--------|---------|--------|
| AI Success Rate | 0% | No `performed_date` on new farm AI records |
| Currently Pregnant | 0 | No `pregnancy_confirmed = true` |
| Due This Quarter | 0 | No `expected_delivery_date` in next 90 days |
| Semen Sources | 0 | RPC doesn't return this field + not passed to component |
| AI Success by Type | "No data" | No performed procedures with confirmations |

The 114 AI records on the 50 new demo farms only have `scheduled_date` set - they're missing `performed_date`, `pregnancy_confirmed`, and `expected_delivery_date`.

---

## Data Generation Plan

### Step 1: Update Existing AI Records (Set performed_date and confirmations)

For the 114 existing AI records on new demo farms:
- Set `performed_date` = `scheduled_date + 0-3 days` (realistic delay)
- Set `pregnancy_confirmed = true` for ~60% (realistic success rate)
- Set `expected_delivery_date` based on livestock-specific gestation:
  - Cattle: 283 days
  - Goat: 150 days
  - Carabao: 310 days

### Step 2: Add Unique Semen Codes to RPC

Update the `get_government_breeding_stats` RPC to return `unique_semen_count` as a new output column.

### Step 3: Pass Semen Codes to Component

Update the GovernmentDashboard.tsx to pass `uniqueSemenCodes` prop to BreedingOverviewCards.

---

## Expected Outcomes

After data update:

| Metric | Current | After Fix |
|--------|---------|-----------|
| AI Procedures | 17 (0 performed) | 17 (17 performed) |
| Currently Pregnant | 0 | ~10-12 |
| AI Success Rate | 0% | ~60-65% |
| Due This Quarter | 0 | ~5-8 |
| Semen Sources | 0 | ~15-20 |
| AI Success by Type | No data | Cattle: 60%, Goat: 55%, Carabao: 65% |

---

## Technical Implementation

### SQL Updates for AI Records

```text
1. Update performed_date for all scheduled AI records:
   - Set performed_date = scheduled_date + random(0-3) days
   - Filter: demo farms created >= 2026-02-04

2. Set pregnancy confirmations (~60% success rate):
   - pregnancy_confirmed = true for random subset
   - expected_delivery_date calculated by livestock type
   - confirmed_at = performed_date + 60 days (realistic pregnancy check timing)

3. Ensure due_this_quarter has data:
   - Some expected_delivery_date values between now and now + 90 days
```

### RPC Enhancement

Add new output column `unique_semen_count` to `get_government_breeding_stats`:
```text
- COUNT(DISTINCT ai.semen_code) within date range
- Return as part of result set
```

### Frontend Update

Update GovernmentDashboard.tsx line ~979:
```text
<BreedingOverviewCards
  ...
  uniqueSemenCodes={breedingStats?.unique_semen_count || 0}
/>
```

---

## Data Isolation Guarantee

All SQL updates filter by:
- `f.data_category = 'demo'`
- `f.created_at >= '2026-02-04'` (new demo farms only)

No live/production data will be affected.

---

## Dashboard Impact

After completion, the Reproduction & Breeding section will display:
- Meaningful AI success rates by livestock type
- Accurate pregnancy counts
- Due this quarter showing upcoming deliveries
- Semen sources showing genetic diversity
- BreedingSuccessChart populated with species-specific data
