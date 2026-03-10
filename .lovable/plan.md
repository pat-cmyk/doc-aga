

# Plan: Fix Cooperative Dashboard Zero Metrics

## Problem
Two cooperative aggregation RPCs have column reference bugs causing zero metrics:
1. `get_cooperative_health_overview` references `hr.farm_id` which doesn't exist on `health_records` — needs JOIN through `animals`
2. `get_cooperative_milk_production` references `volume_liters` instead of correct column `liters`

## Fix
Run a single database migration containing `CREATE OR REPLACE` for all 4 cooperative aggregation RPCs with the corrected column references. No code changes needed — the frontend hooks already consume these RPCs correctly.

## No Code Changes
The existing hooks in `useCooperative.ts` and all cooperative dashboard components remain unchanged.

