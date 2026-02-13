
# Auto-Seed Demo Farm Data

## Overview

Create a backend function that assesses all 65 demo farms, identifies missing/stale data, and seeds realistic records to keep them presentation-ready. The function runs daily via cron and can also be triggered manually from the Admin System tab.

## Current State

- **65 demo farms**: 38 cattle, 18 goat, 9 carabao (~713 active animals)
- **Data gaps**: Almost all farms have 0 recent milking records, 0 recent weights, and minimal health/AI records
- **Existing pattern**: The `populate-weights` edge function already seeds weight data per-farm using species-specific logic -- we'll follow this same architecture

## What Gets Seeded

For each demo farm, the function will assess what's missing in the **last 7 days** and fill gaps:

| Data Type | Logic | Frequency |
|-----------|-------|-----------|
| **Milking Records** | For lactating females (cattle: 5-15L, goat: 1-4L, carabao: 3-8L). AM/PM sessions with realistic daily variance | Daily for last 7 days if missing |
| **Weight Records** | Estimated from age/species using existing `populate-weights` logic. Monthly cadence | If no record in last 30 days |
| **Health Records** | Routine checkups (deworming, vaccination, general exam) | If no record in last 30 days |
| **Body Condition Scores** | Score 2.5-4.0 based on species and stage | If no BCS in last 30 days |
| **Feeding Records** | Species-appropriate feed types and amounts | Daily for last 7 days if missing |

The function will NOT overwrite existing data -- it only fills gaps.

## Technical Plan

### 1. New Edge Function: `seed-demo-data/index.ts`

A single comprehensive edge function that:

1. Fetches all farms where `data_category = 'demo'`
2. For each farm, fetches active animals (not deleted, no exit date)
3. For each animal, checks what records exist in the recent window
4. Inserts realistic records to fill gaps using species-specific parameters
5. Returns a summary of what was seeded

**Key design decisions:**
- Uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS (admin-only function)
- Authentication enforced: verifies JWT + `is_super_admin` check
- Batch inserts per farm to minimize round trips
- Deterministic seeding: uses animal ID as seed for consistent "random" variance so re-runs don't create wildly different data
- `created_by` set to the admin user running it

**Species-specific realistic ranges:**

```text
Milking (liters/session):
  Cattle:  4-15L (avg ~8L)
  Goat:    0.5-3L (avg ~1.5L)  
  Carabao: 2-6L (avg ~3.5L)

Weight (kg):
  Uses existing populate-weights ranges per life stage

Feed (kg/day):
  Cattle:  8-15kg (napier, concentrate)
  Goat:    2-5kg (forage, pellets)
  Carabao: 10-20kg (grass, rice straw)

BCS: 2.5-4.0 (species-adjusted)
```

### 2. Config: `supabase/config.toml`

Add entry:
```toml
[functions.seed-demo-data]
verify_jwt = false
```
(JWT validated in code, not at gateway)

### 3. Daily Cron Job (SQL)

Schedule via `pg_cron` + `pg_net` to run at 2 AM UTC daily:
```sql
SELECT cron.schedule(
  'seed-demo-data-daily',
  '0 2 * * *',
  $$ SELECT net.http_post(
    url := 'https://sxorybjlxyquxteptdyk.supabase.co/functions/v1/seed-demo-data',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <service_role_key>"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  ) $$
);
```
Note: The cron call uses service role key directly so it bypasses the JWT admin check (the function will detect `source: cron` and allow it).

### 4. Admin UI: Button in `SystemAdmin.tsx`

Add a new card section "Demo Data Management" with:
- **"Seed Demo Farm Data"** button that invokes the edge function
- Shows a results dialog with farm-by-farm summary (records created per type)
- Loading state while running

### Files Changed

| File | Action |
|------|--------|
| `supabase/functions/seed-demo-data/index.ts` | **New** -- Main edge function |
| `supabase/config.toml` | **Edit** -- Add function config |
| `src/components/admin/SystemAdmin.tsx` | **Edit** -- Add trigger button + results UI |
| Database (pg_cron) | **SQL insert** -- Schedule daily job |

### Safety Guardrails

- Only processes farms where `data_category = 'demo'` -- live farms are never touched
- Only inserts new records, never updates or deletes existing ones
- All seeded records tagged with notes like "Auto-seeded demo data" for traceability
- Rate-limited to prevent accidental spam
- Admin-only access (super admin check)
