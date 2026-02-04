

# Generate Missing Demo Data for Trends & Insights

## Objective

Generate comprehensive demo data for the 50 new farms (added Feb 4, 2026) to fill temporal gaps in the Trends & Insights charts. All data will be strictly isolated to farms where `data_category = 'demo'`.

---

## Data Generation Scope

### 1. Milking Records (Oct 2025 - Feb 2026)

| Parameter | Value |
|-----------|-------|
| Target Farms | 50 demo farms |
| Target Animals | ~300 lactating females (cattle, goats, carabao) |
| Date Range | October 1, 2025 → February 5, 2026 (127 days) |
| Sessions | AM and PM daily |
| Expected Records | ~50,000-75,000 records |

**Species-Appropriate Volumes:**
- Cattle: 3-9 liters per session
- Goat: 0.3-1.6 liters per session
- Carabao: 2-6 liters per session

**Pricing:** Regional DA Bulletin rates (35-70 PHP/L)

### 2. Health Records (Oct 2025 - Feb 2026)

| Parameter | Value |
|-----------|-------|
| Target Farms | 50 demo farms |
| Date Range | October 2025 → February 2026 |
| Records per Farm | 3-5 events |
| Expected Records | ~150-250 records |
| Event Types | Checkups, vaccinations, treatments, follow-ups |

### 3. Doc Aga Queries (Oct 2025 - Feb 2026)

| Parameter | Value |
|-----------|-------|
| Target Farms | 50 demo farms |
| Date Range | October 2025 → February 2026 |
| Queries per Farm | 2-5 questions |
| Expected Records | ~100-250 records |
| Topics | Feeding, breeding, health symptoms, milk production |

---

## Data Isolation Guarantee

All SQL INSERT statements will use explicit filtering:

```sql
-- Example pattern for all inserts
INSERT INTO milking_records (animal_id, farm_id, ...)
SELECT a.id, a.farm_id, ...
FROM animals a
INNER JOIN farms f ON a.farm_id = f.id
WHERE f.data_category = 'demo'
  AND f.id IN (SELECT id FROM farms WHERE created_at >= '2026-02-04')
  AND a.sex = 'female'
  AND a.reproductive_status IN ('lactating', 'pregnant');
```

**No live/production data will be affected.**

---

## Expected Dashboard Impact

After data generation, the Trends & Insights section will display:

| Chart | Current State | After Generation |
|-------|---------------|------------------|
| Total Milk Production | 0-50L/day (Jan-Feb 2026) | 5,000-8,000L/day |
| Health Events | 0-6 events/day | 15-30 events/day |
| Doc Aga Queries | 0-35 queries/day | 10-40 queries/day |
| Farm Growth | 11 → 65 farms (correct) | No change needed |
| Livestock Composition | Correct totals | No change needed |

---

## Execution Steps

1. **Query lactating animals** from the 50 new demo farms
2. **Generate milking records** using date series with randomized volumes
3. **Insert health records** with varied visit types and dates
4. **Insert doc_aga_queries** with common farmer questions
5. **Verify data** by re-running timeseries RPC

