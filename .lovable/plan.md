
# Fix: Government Dashboard Broken RPC Functions

## Problem Summary

The "Reproduction & Breeding" and "Animal Health & Welfare" sections of the government dashboard are displaying all zeros despite data existing in the database. This is caused by **two broken RPC functions** that fail when executed.

## Root Cause Analysis

### Issue 1: `get_government_breeding_stats` - Nested Aggregate Error
```
ERROR: aggregate function calls cannot be nested
```
The function's `deliveries_json` CTE incorrectly nests `jsonb_object_agg` inside `SUM`, which PostgreSQL doesn't allow.

**Location**: `deliveries_json AS (...)`
```sql
-- BROKEN CODE:
SELECT jsonb_object_agg(
  month,
  jsonb_build_object(
    'total', SUM(delivery_count),  -- ❌ Can't nest agg inside agg
    'by_type', jsonb_object_agg(livestock_type, delivery_count)
  )
)
```

### Issue 2: `get_government_health_stats` - Missing Column Reference
```
ERROR: column hr.cycle_length_days does not exist
```
The function references `hr.cycle_length_days` which doesn't exist in the `heat_records` table.

**Actual `heat_records` columns**: `id`, `animal_id`, `farm_id`, `detected_at`, `detection_method`, `intensity`, `standing_heat`, `optimal_breeding_start`, `optimal_breeding_end`, `notes`, `created_by`, `created_at`, `client_generated_id`

## Data Verification

The underlying data is present and correct:

| Table | Records in Date Range | Notes |
|-------|----------------------|-------|
| AI Records | 21 | Oct 2025 - Feb 2026 |
| Heat Records | 146 | Ready for display |
| BCS Scores | 97 | Avg score: 2.97 |
| Animal Exits | 35 | Multiple exit reasons |
| Semen Codes | 21 unique | For genetic tracking |

---

## Technical Fix Plan

### Step 1: Fix `get_government_breeding_stats` RPC

**Problem**: Nested aggregate functions in the monthly deliveries JSON construction

**Solution**: Rewrite the CTE to pre-aggregate totals before building JSON:
1. First CTE: Group by month and livestock type
2. Second CTE: Calculate monthly totals
3. Final CTE: Build JSON without nesting aggregates

### Step 2: Fix `get_government_health_stats` RPC

**Problem**: References non-existent `cycle_length_days` column

**Solution**: Compute average cycle length dynamically using a LAG window function:
```sql
-- Calculate cycle length from consecutive heat events
WITH heat_intervals AS (
  SELECT 
    animal_id,
    detected_at,
    LAG(detected_at) OVER (PARTITION BY animal_id ORDER BY detected_at) as prev_heat
  FROM heat_records
)
SELECT AVG(EXTRACT(EPOCH FROM (detected_at - prev_heat)) / 86400)
FROM heat_intervals
WHERE prev_heat IS NOT NULL
  AND interval BETWEEN 15 AND 30 days  -- Valid estrous range
```

Also fix:
- BCS join path uses `animal_id` for proper filtering through demo farms
- Optimal breeding window column name: `optimal_breeding_start` not `optimal_breeding_window_start`

---

## Database Changes Required

**Migration**: Drop and recreate both RPC functions with corrected SQL:

1. `get_government_breeding_stats` - Fix nested aggregate in JSON construction
2. `get_government_health_stats` - Compute cycle length dynamically, fix column names

---

## Expected Outcomes After Fix

### Reproduction & Breeding Section
- **Heat Events**: ~146 (from `heat_records`)
- **Avg Cycle**: ~21-27 days (computed dynamically)
- **Ready for AI**: Animals with `optimal_breeding_start` in date range
- **AI Procedures**: 21 scheduled
- **AI Success Rate**: Based on `pregnancy_confirmed` records
- **Semen Sources**: 21 unique genetic lines

### Animal Health & Welfare Section
- **Vaccination Compliance**: From `preventive_health_schedules`
- **BCS Distribution**: 97 assessments, avg 2.97
- **Mortality Rate**: Based on 5 deaths / total animals

---

## Files to Modify

No frontend code changes required. The fix is entirely in the database layer:
- **Drop and recreate**: `get_government_breeding_stats`
- **Drop and recreate**: `get_government_health_stats`
