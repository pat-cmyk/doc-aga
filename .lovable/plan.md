

# Programs & Insights Dashboard: Technical Assessment & Fix Plan

## Executive Summary

This assessment identifies **3 critical RPC failures** due to incorrect column name references, plus **2 major demo data gaps** that prevent the dashboard from telling a complete story.

---

## Part 1: Dataset Connection Failures (Critical)

### Failure 1: `get_regional_data_quality` RPC
**Error**: `column mr.record_datetime does not exist`

| Issue | Location | Current | Correct |
|-------|----------|---------|---------|
| Milking records column | Line 70 | `mr.record_datetime` | `mr.record_date` |
| Health records column | Line 82 | `hr.record_date` | `hr.visit_date` |

**Impact**: DataQualityDashboardCard displays error message instead of metrics

---

### Failure 2: `get_regional_pcrs_summary` RPC
**Error**: `column hr.record_date does not exist`

| Issue | Location | Current | Correct |
|-------|----------|---------|---------|
| Health records column | Line 52 (in CTE `animal_health_issues`) | `hr.record_date` | `hr.visit_date` |

**Impact**: RegionalPCRSCard displays error message instead of pre-calving risk data

---

### Failure 3: `get_farm_compliance_metrics` RPC
**Error**: `column mr.milking_date does not exist`

| Issue | Location | Current | Correct |
|-------|----------|---------|---------|
| Milking records column | Lines 306-311 | `mr.milking_date` | `mr.record_date` |
| Health records column | Lines 323-325 | `hr.check_date` | `hr.visit_date` |

**Impact**: FarmOperationalHealthCard displays error message instead of compliance metrics

---

## Part 2: Demo Data Completeness Assessment

### Current Demo Dataset State

| Entity | Total | Complete | Coverage |
|--------|-------|----------|----------|
| Farms with GPS | 65 | 65 | 100% |
| Animals with weight data | 711 | 7 | **1%** |
| Pregnant animals with BCS | 111 | 36 | 32% |
| Milking records (last 30 days) | 21,255 | 21,255 | 100% |
| Health records (last 90 days) | 1,131 | 220 | 19% |
| Feeding records | 610 | 610 | N/A |
| Vaccination schedules | 205 | 205 | N/A |

### Critical Data Gaps Identified

| Gap | Impact | Priority |
|-----|--------|----------|
| **704 animals missing weight data** | Data Quality score shows ~1% weight completeness instead of realistic 60-80% | High |
| **75 pregnant animals missing BCS** | PCRS calculations use "missing BCS" penalty score, skewing risk tiers | High |
| **Only 220 recent health records** | Health recording metric shows low adoption rates | Medium |
| **No recent feeding records date check** | Production tracking may appear incomplete | Medium |

---

## Part 3: Fix Implementation Plan

### Step 1: Fix RPC Column References (Database Migration)

Create a new migration to update all three RPC functions with correct column names:

```text
Files Modified:
- New migration file: supabase/migrations/[timestamp]_fix_rpc_column_names.sql

Column Corrections:
1. get_regional_data_quality:
   - mr.record_datetime -> mr.record_date
   - hr.record_date -> hr.visit_date

2. get_regional_pcrs_summary:
   - hr.record_date -> hr.visit_date

3. get_farm_compliance_metrics:
   - mr.milking_date -> mr.record_date  
   - hr.check_date -> hr.visit_date
```

### Step 2: Seed Missing Demo Data (Data Migration)

```text
Data Operations:
1. Update ~700 demo animals with realistic entry_weight_kg values:
   - Cattle: 350-550 kg range
   - Goats: 25-45 kg range
   - Carabao: 400-600 kg range

2. Insert BCS records for 75 pregnant animals without BCS:
   - Scores: 2.5-4.0 range (healthy)
   - Assessment dates: within last 60 days

3. Insert additional health records for demo farms:
   - Target: 500+ records in last 90 days
   - Diagnoses: routine checkups, vaccinations, deworming
```

---

## Part 4: Component Status Matrix

### Programs & Insights Tab Components

| Component | RPC/Hook | Status | Issue |
|-----------|----------|--------|-------|
| GrantDistributionCard | Direct query | Working | N/A |
| RegionalInvestmentCards | Direct query | Working | N/A |
| GrantEffectivenessPanel | Direct query | Working | N/A |
| FarmerQueriesTopics | useFarmerQueries | Working | N/A |
| MilkProductionBySpeciesChart | useGovernmentMilkAnalytics | Working | N/A |
| MarketPriceAnalyticsCard | useMarketPrices | Working | N/A |
| FeedSecurityCard | useRegionalFeedSecurity | Working | N/A |
| FarmOperationalHealthCard | useFarmComplianceMetrics | **FAILING** | Wrong column names |
| DataQualityDashboardCard | useRegionalDataQuality | **FAILING** | Wrong column names |
| RegionalPCRSCard | useRegionalPCRS | **FAILING** | Wrong column names |

---

## Part 5: Demo Data Seeding Recommendations

To enable meaningful dashboard storytelling, seed the following data:

### Weight Data (High Priority)
- **Purpose**: Show realistic data quality progression across regions
- **Target**: 70% of demo animals should have weight data
- **Distribution**: 
  - Region IV-A: 90% complete (model region)
  - Other regions: 50-70% complete (improvement opportunities)

### BCS Records (High Priority)
- **Purpose**: Enable accurate PCRS tier calculations
- **Target**: All 111 pregnant animals should have at least 1 BCS record
- **Distribution**:
  - 80% with BCS 2.5-3.5 (healthy)
  - 15% with BCS 2.0-2.5 (thin, higher risk)
  - 5% with BCS 4.0+ (overconditioned, higher risk)

### Health Records (Medium Priority)
- **Purpose**: Demonstrate health recording adoption rates
- **Target**: 500+ records in last 90 days
- **Types**: Routine checkups, vaccination records, treatments

### Feeding Records (Medium Priority)
- **Purpose**: Show feeding log compliance
- **Target**: Recent feeding logs for 50% of demo farms
- **Dates**: Spread across last 30 days

---

## Part 6: Testing Checklist

After implementation, verify:

- [ ] DataQualityDashboardCard loads with GPS, Weight, Production, Health metrics
- [ ] RegionalPCRSCard shows tier distribution (Critical/High/Moderate/Low)
- [ ] FarmOperationalHealthCard displays compliance rates
- [ ] Data Quality score shows realistic 50-70% (not ~25% due to missing weights)
- [ ] PCRS shows distribution across all tiers (not just "moderate" due to missing BCS penalty)
- [ ] Switch between Live/Demo/All modes works correctly
- [ ] Regional filtering updates all cards

---

## Change Impact Summary

**Modified Files:**
- New migration: Fix 3 RPC functions with correct column names
- Data seeding: ~700 animal weight updates, ~75 BCS inserts

**Data Flow:**
- `milking_records` (record_date) -> RPCs -> hooks -> components
- `health_records` (visit_date) -> RPCs -> hooks -> components
- `animals` (entry_weight_kg) -> RPCs -> hooks -> DataQualityDashboardCard
- `body_condition_scores` -> RPCs -> hooks -> RegionalPCRSCard

**Breaking Changes:** None (fixes existing broken functionality)

**Testing Points:**
- Navigate to Government Dashboard > Programs & Insights tab
- Scroll to "Operational Compliance" section
- Scroll to "Data Quality & Risk Management" section
- Toggle data source to Demo and verify cards load
- Check console for [DataQuality] and [PCRS] log prefixes

