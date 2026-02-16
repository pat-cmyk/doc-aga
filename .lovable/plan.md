
# Unify OVR Computation to a Single Source of Truth

## Problem

The same animal shows **three different OVR scores** (61, 73, 69) across three views because there are **two completely separate computation engines** that produce different results:

| Engine | Location | Used By | Writes To |
|--------|----------|---------|-----------|
| Server-side SQL | `calculate_animal_ovr()` PostgreSQL function | DB triggers on record changes | `animal_ovr_cache` |
| Client-side JS | `ovrScoreCalculator.ts` via `useBioCardData` hook | BioCard, BioCardSummary | Overwrites `animal_ovr_cache` |

### Key Differences Between the Two Engines

| Factor | Server SQL | Client JS |
|--------|-----------|-----------|
| Milk benchmark | Stage-specific (12/15/10/6) | Flat per type (cattle=15, goat=2) |
| Active health issues | Actually queries `health_records` | Hardcoded `false` |
| Withdrawal detection | Queries `milking_records` | Hardcoded `false` |
| Weight selection | dairy check via `milking_stage IS NOT NULL` | Check via `isMilking` flag |

The list view reads from cache (written by whichever engine ran last). The BioCard runs client-side live, then overwrites the cache -- so scores drift and conflict.

## Solution: Server-Side SQL as the Single Computation SSOT

Make the **server-side `calculate_animal_ovr()` SQL function** the ONLY place OVR is computed. All views -- list, BioCard, BioCardSummary -- read from `animal_ovr_cache`. No client-side recalculation.

```text
DB triggers (milking/weight/BCS/health/AI records)
       |
       v
calculate_animal_ovr() SQL function  <-- SINGLE COMPUTATION SSOT
       |
       v
animal_ovr_cache table  <-- SINGLE DATA SSOT
       |
       v
useBatchOVRSummary (list view) -- reads cache
useBioCardData (BioCard/Summary) -- reads cache (NO MORE client-side calc)
```

### Why Server-Side?

- It already queries actual health records and withdrawal status (client hardcodes these as `false`)
- DB triggers ensure the cache updates immediately when underlying data changes
- No race condition between client overwrite and trigger overwrite
- One algorithm to maintain, not two

## Changes (4 files)

### 1. EDIT: `src/hooks/useBioCardData.ts`

**Remove client-side OVR calculation and cache-writing.** Instead, read OVR from `animal_ovr_cache` (same source as the list view).

- Remove the import of `calculateOVRScore` and `OVRInputs` from `ovrScoreCalculator.ts`
- Add a query to read from `animal_ovr_cache` for the specific animal
- Remove the `ovrInputs` assembly block (lines 372-403)
- Remove the `calculateOVRScore(ovrInputs)` call (line 405)
- Remove the entire `useEffect` that writes to cache (lines 499-529)
- Use the cached OVR result (score, tier, trend, breakdown) directly
- Keep all other data (sparklines, repro status, immunity, market value) as-is -- those aren't duplicated
- The radar chart data will come from `breakdown` stored in the cache (it's already a JSONB column)

### 2. EDIT: `src/lib/ovrScoreCalculator.ts`

- Keep the file but add a deprecation comment at the top noting that the server-side SQL function is the SSOT
- Keep `calculateStatusAura()` (it's still used client-side for the status aura, which is a separate concern from OVR)
- Keep `getOVRTier()` and `getOVRTierColor()` as utility functions
- Remove or deprecate `calculateOVRScore()` since it should no longer be called

### 3. EDIT: `src/hooks/useBatchOVRSummary.ts`

- No logic changes needed -- it already reads from cache correctly
- Add a comment noting this is now the same data source as BioCard

### 4. EDIT: `docs/data-relationships-map.md`

- Update OVR SSOT flow documentation to reflect single computation path

## What This Fixes

- All three views (list pill, BioCard hexagon, BioCardSummary text) will show the **exact same score** because they all read from the same cache row
- No more race condition where opening BioCard overwrites the trigger-computed cache
- Health issues and withdrawal periods are properly factored into the score (no more hardcoded `false`)

## What This Does NOT Change

- The `calculate_animal_ovr()` SQL function (it's already correct and more complete)
- DB triggers that mark cache as stale
- The edge function for batch recalculation
- The `OVRScore` UI component (already unified)
- Status aura calculation (remains client-side, separate concern)
- All other BioCard data (sparklines, repro, immunity, market value)

## Risk Mitigation

- Animals that have never had a trigger fire (no records at all) will show score 0 from cache. The UI already handles this with a "not yet calculated" state in the list view.
- The 3 AM cron job already ensures all animals eventually get a cached score.
