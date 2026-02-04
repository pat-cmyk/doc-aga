

# Fix: Government Dashboard Data Connection Issues

## Problem Summary

The government dashboard's "Reproduction & Breeding", "Animal Health & Welfare", and "Trends & Insights" sections are not displaying data due to a broken database function and data date range gaps.

## Root Cause Analysis

### 1. Critical RPC Function Error
The `get_government_health_stats` function (version with `data_category_filter` parameter) references a table called `vaccination_records` that does not exist in the database. The error in the console confirms this:
```
relation "vaccination_records" does not exist
```

**Impact**: All health-related cards fail to load (Vaccination Compliance, BCS Distribution, Mortality Analytics, Heat Detection Metrics).

### 2. AI Records Date Gap
- Dashboard viewing: November 6, 2025 to February 4, 2026
- Demo AI records end at: November 3, 2025
- Result: 0 breeding/AI records appear, causing empty breeding charts

### 3. Existing Data Not Being Displayed
Despite the errors, demo data exists:
| Table | Records in Date Range |
|-------|----------------------|
| Body Condition Scores | 97 |
| Heat Records | 66 |
| Preventive Health Schedules | 205 |
| AI Records | 0 (date gap) |

---

## Technical Implementation Plan

### Step 1: Fix the RPC Function
Drop and recreate `get_government_health_stats` to:
- Remove reference to non-existent `vaccination_records` table
- Use `preventive_health_schedules` with `schedule_type = 'vaccination'` for vaccination data
- Support the `data_category_filter` parameter properly
- Return all expected columns for the health stats interface

### Step 2: Generate Demo AI/Breeding Records
Insert AI records for the demo farms with:
- Scheduled dates from October 2025 through February 2026
- Mix of performed and pending procedures
- Pregnancy confirmations with expected delivery dates
- Species distribution (cattle, goat, carabao)

### Step 3: Extend Demo Heat Detection Records
Add heat records for:
- December 2025 through February 2026
- Realistic estrous cycle patterns (18-24 day intervals)
- Optimal breeding window timestamps

### Step 4: Verify and Update Mortality Data
Ensure exit records exist within the date range for:
- Sales with sale prices
- Deaths (for mortality rate calculation)
- Other exit reasons (culled, transferred, slaughtered)

---

## Expected Outcomes

After implementation:

| Section | Component | Expected Result |
|---------|-----------|-----------------|
| Reproduction & Breeding | Heat Detection Metrics | Shows heat events, avg cycle length, optimal window count |
| Reproduction & Breeding | Breeding Overview Cards | Shows AI procedures, pregnancies, success rates |
| Reproduction & Breeding | Breeding Success Chart | Shows success rates by livestock type |
| Reproduction & Breeding | Expected Deliveries Timeline | Shows upcoming deliveries by month |
| Animal Health & Welfare | Vaccination Compliance Card | Shows vaccination/deworming completion rates |
| Animal Health & Welfare | BCS Distribution Chart | Shows pie chart of underweight/optimal/overweight |
| Animal Health & Welfare | Mortality Analytics Card | Shows exit breakdown and mortality rate |
| Trends & Insights | GovTrendCharts | Shows farm growth, livestock composition, health events, milk production |

---

## Database Changes Required

1. **Replace RPC Function**: `get_government_health_stats` with corrected version
2. **Insert Data**: 
   - ~150 AI records (Oct 2025 - Feb 2026)
   - ~50 additional heat records (Dec 2025 - Feb 2026)
   - ~20 animal exit records with date range coverage

---

## Files to Modify

No frontend code changes are required. The issue is entirely in the database layer:
- Database function: `get_government_health_stats`
- Database data: `ai_records`, `heat_records`, `animals` (exit_date/exit_reason)

