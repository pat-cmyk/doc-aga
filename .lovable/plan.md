

# Fix: `get_government_health_stats` RPC Runtime Error

## Root Cause

The RPC fails at runtime with **`column hr.cycle_length_days does not exist`**. The `heat_records` table uses:
- `detected_at` (not `observed_date`)
- No `cycle_length_days` column exists — cycle length must be derived

This means the RPC was created with wrong column references, so it throws an error on every call. The frontend receives an error, catches it, and shows zeros.

## Fix — Single Database Migration

Recreate the RPC with corrected `heat_stats` and `optimal_window` CTEs:

1. **`hr.observed_date`** → **`hr.detected_at`**
2. **`hr.cycle_length_days`** → derive via window function: `detected_at - LAG(detected_at) OVER (PARTITION BY hr.animal_id ORDER BY hr.detected_at)`
3. Everything else stays the same (BCS and preventive health schemas are correct)

No frontend changes needed.

