

# Fix: Government Dashboard RPC Column Name Errors

## Problem Summary

The migration `20260204112600` (data category split) introduced SQL column name errors in 4 government RPC functions, causing the dashboard to fail with "Failed to load government statistics."

## Root Cause

The migration referenced incorrect column names that don't exist in the actual database schema:

| RPC Function | Wrong Column | Correct Column |
|-------------|--------------|----------------|
| `get_government_stats` | `mr.record_datetime` | `mr.record_date` |
| `get_government_stats` | `hr.record_date` | `hr.visit_date` |
| `get_government_stats_timeseries` | `mr.record_datetime` | `mr.record_date` |
| `get_government_stats_timeseries` | `hr.record_date` | `hr.visit_date` |
| `get_health_heatmap_data` | `hr.record_date` | `hr.visit_date` |
| `get_health_heatmap_data` | `hr.symptoms` | `hr.diagnosis` |
| `get_government_health_stats` | `hr.cycle_length_days` | (calculate from `detected_at`) |
| `get_government_health_stats` | `hr.observed_date` | `hr.detected_at` |

## Fix Strategy

Create a corrective SQL migration that uses `CREATE OR REPLACE FUNCTION` to fix all 4 broken RPC functions with the correct column references:

1. **`get_government_stats`**: Fix `milking_records.record_date` and `health_records.visit_date`

2. **`get_government_stats_timeseries`**: Fix same column references in the timeseries variant

3. **`get_health_heatmap_data`**: 
   - Change `hr.record_date` to `hr.visit_date`
   - Change `hr.symptoms` to `hr.diagnosis`

4. **`get_government_health_stats`**: 
   - Replace `hr.cycle_length_days` with a lateral join calculation using previous heat records
   - Change `hr.observed_date` to `hr.detected_at`

## Technical Details

### Heat Cycle Calculation Fix

Since `heat_records` doesn't have a `cycle_length_days` column, calculate it dynamically:

```sql
heat_stats AS (
  SELECT
    COUNT(*) AS heat_count,
    AVG(
      CASE 
        WHEN prev_heat.detected_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (hr.detected_at - prev_heat.detected_at)) / 86400
        ELSE NULL
      END
    ) AS avg_cycle
  FROM heat_records hr
  INNER JOIN animals a ON hr.animal_id = a.id
  INNER JOIN filtered_farms ff ON a.farm_id = ff.id
  LEFT JOIN LATERAL (
    SELECT detected_at
    FROM heat_records hr2
    WHERE hr2.animal_id = hr.animal_id
      AND hr2.detected_at < hr.detected_at
    ORDER BY hr2.detected_at DESC
    LIMIT 1
  ) prev_heat ON true
  WHERE hr.detected_at::date BETWEEN start_date AND end_date
)
```

### Optimal Window Fix

Change the optimal breeding window logic to use `detected_at`:

```sql
optimal_window AS (
  SELECT COUNT(DISTINCT a.id) AS optimal_count
  FROM animals a
  INNER JOIN filtered_farms ff ON a.farm_id = ff.id
  INNER JOIN heat_records hr ON hr.animal_id = a.id
  WHERE a.is_deleted = false
    AND a.exit_date IS NULL
    AND a.gender = 'female'
    AND hr.detected_at >= CURRENT_TIMESTAMP - INTERVAL '21 days'
    AND hr.detected_at <= CURRENT_TIMESTAMP - INTERVAL '18 days'
)
```

## Files to Modify

| File | Action |
|------|--------|
| `supabase/migrations/YYYYMMDD_fix_rpc_columns.sql` | **NEW** - Corrective migration with all 4 fixed RPCs |

## Testing Checklist

- [ ] Government dashboard loads without errors on "Demo" filter
- [ ] Government dashboard loads without errors on "Live" filter  
- [ ] Government dashboard loads without errors on "All" filter
- [ ] Overview statistics card shows real numbers
- [ ] Timeseries charts render data correctly
- [ ] Health heatmap displays municipalities
- [ ] Health stats section shows vaccination/breeding data

