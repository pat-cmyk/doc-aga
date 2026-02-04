

# Complete Demo Milking Data: Fill Nov 2025 - Feb 2026 Gap

## Problem Summary

The Trends & Insights charts show a dramatic decline in milk production from October to January because the previous data generation only partially covered the Nov 2025 - Feb 2026 period:

| Month | Current Daily Avg | Animals Milked/Day | Gap |
|-------|-------------------|-------------------|-----|
| Oct 2025 | 3,771 L | ~440 | ✅ Complete |
| Nov 2025 | 2,254 L | ~240 | ❌ ~200 animals missing |
| Dec 2025 | 1,664 L | ~100 | ❌ ~340 animals missing |
| Jan 2026 | 1,190 L | ~100 | ❌ ~340 animals missing |
| Feb 2026 | 1,170 L | ~100 | ❌ ~340 animals missing |

### Root Cause

The earlier batch inserts covered:
- **October**: All animals (cattle, goat, carabao)
- **November onwards**: Only the first 100 cattle

Missing from November 2025 - February 2026:
- 183 cattle
- 124 goats  
- 45 carabao

---

## Data Generation Plan

### Step 1: Generate Cattle Milking Records (183 animals × 97 days × 2 sessions)

Generate ~35,500 records for the 183 cattle missing Nov-Feb data:
- Date range: November 1, 2025 → February 5, 2026
- Sessions: AM and PM daily
- Volume: 3-9 liters per session (randomized)
- Pricing: 35-50 PHP/L

### Step 2: Generate Goat Milking Records (124 animals × 97 days × 2 sessions)

Generate ~24,000 records for all 124 goats:
- Date range: November 1, 2025 → February 5, 2026
- Sessions: AM and PM daily
- Volume: 0.3-1.6 liters per session (randomized)
- Pricing: 50-70 PHP/L

### Step 3: Generate Carabao Milking Records (45 animals × 97 days × 2 sessions)

Generate ~8,700 records for all 45 carabao:
- Date range: November 1, 2025 → February 5, 2026
- Sessions: AM and PM daily
- Volume: 2-6 liters per session (randomized)
- Pricing: 40-55 PHP/L

---

## Expected Outcomes

### Before vs After Daily Averages

| Month | Current | After Fix | Change |
|-------|---------|-----------|--------|
| Oct 2025 | 3,771 L | 3,771 L | — |
| Nov 2025 | 2,254 L | ~4,500 L | +100% |
| Dec 2025 | 1,664 L | ~4,500 L | +170% |
| Jan 2026 | 1,190 L | ~4,500 L | +278% |
| Feb 2026 | 1,170 L | ~4,500 L | +285% |

### New Record Counts

| Species | New Records | Additional Liters |
|---------|-------------|-------------------|
| Cattle | ~35,500 | ~213,000 L |
| Goat | ~24,000 | ~22,800 L |
| Carabao | ~8,700 | ~34,800 L |
| **Total** | **~68,200** | **~270,600 L** |

---

## Technical Implementation

### Batch Insert Strategy

To avoid timeouts, inserts will be batched by:
1. Species (cattle first, then goat, then carabao)
2. Date ranges (Nov, Dec, Jan, Feb separately if needed)

### SQL Pattern

```sql
INSERT INTO milking_records (animal_id, record_date, liters, session, price_per_liter, is_sold, created_by, created_at)
SELECT 
  a.id,
  d.date,
  -- Species-appropriate random volume
  CASE a.livestock_type
    WHEN 'cattle' THEN 3 + random() * 6
    WHEN 'goat' THEN 0.3 + random() * 1.3
    WHEN 'carabao' THEN 2 + random() * 4
  END,
  s.session,
  -- Regional pricing
  CASE a.livestock_type
    WHEN 'cattle' THEN 35 + random() * 15
    WHEN 'goat' THEN 50 + random() * 20
    WHEN 'carabao' THEN 40 + random() * 15
  END,
  true,
  'c8514ae7-f603-415e-8603-039515f7189e',
  NOW()
FROM animals a
INNER JOIN farms f ON a.farm_id = f.id
CROSS JOIN generate_series('2025-11-01'::date, '2026-02-05'::date, '1 day'::interval) d(date)
CROSS JOIN (VALUES ('AM'), ('PM')) s(session)
WHERE f.data_category = 'demo'
  AND f.created_at >= '2026-02-04'
  AND a.gender = 'female'
  AND a.is_currently_lactating = true
  AND a.livestock_type = '[species]'
  -- Exclude animals that already have records
  AND NOT EXISTS (
    SELECT 1 FROM milking_records mr 
    WHERE mr.animal_id = a.id 
    AND mr.record_date >= '2025-11-01'
  )
ON CONFLICT (animal_id, record_date, session) DO NOTHING;
```

### Data Isolation Guarantee

All inserts explicitly filter:
- `f.data_category = 'demo'`
- `f.created_at >= '2026-02-04'` (new demo farms only)
- Animals without existing Nov-Feb records

**No live/production data will be affected.**

---

## Dashboard Impact

After completion, the Trends & Insights milk production chart will show:
- Consistent daily production of 4,000-5,000 L across all months
- Realistic growth trend can be simulated if needed
- All 452 eligible animals contributing to daily totals

