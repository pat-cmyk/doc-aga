

# Plan: Live/Demo Farm Data Segregation System

## Status: ✅ COMPLETE

## Overview

Implement a data segregation system that allows admins to classify farms as "live" (production) or "demo" (test/demo), with the government dashboard able to filter between these datasets for presentations and real-world analysis.

---

## Implementation Summary

### ✅ Database Changes (Complete)

1. **New Column on `farms` Table**
   - Added `data_category TEXT NOT NULL DEFAULT 'live'` with CHECK constraint
   - Created index `idx_farms_data_category` for efficient filtering
   - Auto-migrated existing `[TEST]` farms to 'demo' category

2. **Updated Government RPCs** (all now accept `data_category_filter` parameter)
   - `get_government_stats()`
   - `get_government_stats_timeseries()`
   - `get_health_heatmap_data()`
   - `get_government_health_stats()`
   - `get_government_breeding_stats()`

3. **Updated `gov_farm_analytics` View**
   - Now includes `data_category` column for filtering

---

### ✅ Frontend Changes (Complete)

1. **Government Dashboard** (`src/pages/GovernmentDashboard.tsx`)
   - Added `dataCategory` state with URL persistence (`?data_source=live|demo|all`)
   - Added prominent Data Source selector dropdown (Live/Demo/All)
   - All analytics hooks now receive dataCategory filter

2. **Government Hooks** (all updated with `dataCategory` parameter)
   - `src/hooks/useGovernmentStats.ts` - `useGovernmentStats`, `useHealthHeatmap`, `useGovernmentStatsTimeseries`
   - `src/hooks/useBreedingStats.ts` - `useBreedingStats`
   - `src/hooks/useGovernmentHealthStats.ts` - `useGovernmentHealthStats`
   - `src/hooks/useGrantAnalytics.ts` - `useGrantAnalytics`, `useRegionalGrantDistribution`

3. **Admin Dashboard** (`src/components/admin/FarmOversight.tsx`)
   - Added "Category" column to farm table
   - Added dropdown selector (Live 🟢 / Demo 🔵) per farm row
   - Added `updateDataCategoryMutation` for changing farm categories

4. **Regional Detail Panel** (`src/components/government/RegionalDetailPanel.tsx`)
   - Updated to use 'live' as default dataCategory

---

## Testing Checklist

- [x] Admin can see current category for each farm
- [x] Admin can change farm category (live ↔ demo)
- [x] Government dashboard defaults to "Live Data"
- [x] Switching to "Demo Data" shows only demo farms' statistics
- [x] "All Data" shows combined statistics
- [x] URL persists data source selection
- [x] Existing `[TEST]` farms are auto-categorized as demo
- [x] New farms default to `live`

