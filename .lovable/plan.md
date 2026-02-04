

# Complete Remaining Demo Milking Data: Jan-Feb 2026

## Current Gap Analysis

| Species | Jan 2026 | Feb 2026 | Action Needed |
|---------|----------|----------|---------------|
| Cattle (283) | ✅ Has data (69,633 L) | ✅ Has data (16,986 L) | Minor gaps only |
| Goat (124) | ❌ 0 records | ❌ 0 records | Generate all |
| Carabao (45) | ❌ 0 records | ❌ 0 records | Generate all |

## Data Generation Plan

### Step 1: Generate Goat Milking Records (Jan 1 - Feb 5, 2026)

| Parameter | Value |
|-----------|-------|
| Animals | 124 lactating goats |
| Date Range | January 1 → February 5, 2026 (36 days) |
| Sessions | AM and PM daily |
| Expected Records | ~8,928 records |
| Volume | 0.3-1.6 liters per session |
| Pricing | 50-70 PHP/L |

### Step 2: Generate Carabao Milking Records (Jan 1 - Feb 5, 2026)

| Parameter | Value |
|-----------|-------|
| Animals | 45 lactating carabao |
| Date Range | January 1 → February 5, 2026 (36 days) |
| Sessions | AM and PM daily |
| Expected Records | ~3,240 records |
| Volume | 2-6 liters per session |
| Pricing | 40-55 PHP/L |

## Expected Outcomes

### Before vs After (Jan-Feb 2026)

| Month | Current | After Fix |
|-------|---------|-----------|
| Jan 2026 | 69,633 L (cattle only) | ~82,000 L (+goats/carabao) |
| Feb 2026 | 16,986 L (cattle only) | ~20,000 L (+goats/carabao) |

### Additional Data Generated

| Species | New Records | Additional Liters |
|---------|-------------|-------------------|
| Goat | ~8,928 | ~8,500 L |
| Carabao | ~3,240 | ~12,960 L |
| **Total** | **~12,168** | **~21,460 L** |

## Technical Implementation

### Batch Strategy

To avoid timeouts, inserts will be done in smaller batches:
- Goats: 2 batches (Jan 1-20, Jan 21 - Feb 5)
- Carabao: 2 batches (Jan 1-20, Jan 21 - Feb 5)

### SQL Pattern

```sql
INSERT INTO milking_records (animal_id, record_date, liters, session, price_per_liter, is_sold, created_by, created_at)
SELECT 
  a.id,
  d.date::date,
  0.3 + random() * 1.3,  -- Goat volumes
  s.session,
  50 + random() * 20,    -- Goat pricing
  true,
  'c8514ae7-f603-415e-8603-039515f7189e',
  NOW()
FROM animals a
INNER JOIN farms f ON a.farm_id = f.id
CROSS JOIN generate_series('2026-01-01'::date, '2026-01-20'::date, '1 day'::interval) d(date)
CROSS JOIN (VALUES ('AM'), ('PM')) s(session)
WHERE f.data_category = 'demo'
  AND f.created_at >= '2026-02-04'
  AND a.gender = 'female'
  AND a.is_currently_lactating = true
  AND a.livestock_type = 'goat'
ON CONFLICT (animal_id, record_date, session) DO NOTHING;
```

### Data Isolation Guarantee

All inserts filter by:
- `f.data_category = 'demo'`
- `f.created_at >= '2026-02-04'`
- Species-specific livestock_type

**No live/production data will be affected.**

## Dashboard Impact

After completion, the Trends & Insights charts will show:
- Consistent species mix across all months
- Goat and carabao contributions visible in Jan-Feb
- More realistic multi-species production profile

