

# Root Cause: Column Name Mismatch — `get_government_health_stats` RPC

## Problem

The database has **two overloads** of `get_government_health_stats`:
- **5-param version** (no `data_category_filter`): returns columns matching the hook (e.g., `avg_bcs_score`, `completed_vaccinations`)
- **6-param version** (with `data_category_filter`): returns **different column names** (e.g., `avg_bcs`, `vaccination_count`)

The frontend hook calls the **6-param version** (passing `data_category_filter`), but maps the response using the 5-param column names. This causes every field to be `undefined`, falling back to 0.

**Example**: Hook reads `row.avg_bcs_score` → RPC returns `avg_bcs` → `Number(undefined) || 0 = 0`

The migration `20260305100000` was supposed to fix this by dropping and recreating the 6-param version with correct column names, but **it was never applied to the database**.

## What Has Data vs What Shows Zero

| Field | RPC Returns | Hook Expects | Result |
|-------|------------|-------------|--------|
| Avg BCS | `avg_bcs: 3.20` | `avg_bcs_score` | Shows 0.00 |
| Vaccinations | `vaccination_count: 9` | `completed_vaccinations` | Shows 0 |
| Deworming | `deworming_count: 6` | `completed_deworming` | Shows 0 |

The distribution counts (`animals_underweight`, `animals_optimal`, `animals_overweight`, `bcs_assessments_count`) DO match between both versions, which is why the pie chart and counts display correctly.

## Fix

**Run a single database migration** that:
1. Drops the stale 6-param overload
2. Drops the stale 5-param overload (cleanup)
3. Recreates **one** 6-param function with `data_category_filter` and the correct RETURNS TABLE column names matching the hook (`avg_bcs_score`, `completed_vaccinations`, `scheduled_vaccinations`, `overdue_vaccinations`, `completed_deworming`, `scheduled_deworming`, `vaccination_compliance_rate`, `heat_events_count`, `avg_cycle_length_days`, `animals_in_optimal_window`, exit breakdown columns, `mortality_rate`, `total_sales_revenue`)

The SQL from migration `20260305100000` already has the correct function body — it just needs to be applied.

No frontend code changes needed.

