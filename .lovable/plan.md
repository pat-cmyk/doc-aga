
# Implementation Plan: Data Quality Dashboard & Regional PCRS Aggregation

## Overview

This plan implements two complementary features for the government dashboard:
1. **Data Quality Dashboard** - Shows GPS coverage, weight data completeness, and production tracking rates by region
2. **Regional PCRS Aggregation** - Pre-Calving Risk Scores aggregated by region and month for veterinary resource planning

Both features will be placed in the **Programs & Insights** tab under a new "Data Quality & Risk Management" section.

---

## Feature 1: Data Quality Dashboard

### Purpose
Enable government officials to identify regions with data gaps that require extension support, prioritize training resources, and monitor adoption quality across the program.

### Data Quality Metrics to Track

| Metric | Definition | Source Tables |
|--------|------------|---------------|
| GPS Coverage | % of farms with valid gps_lat/gps_lng | farms |
| Weight Data Completeness | % of animals with entry/birth weight recorded | animals |
| Production Tracking | % of farms with milking logs in last 30 days | milking_records |
| Health Recording | % of farms with health/vaccination logs | health_records, preventive_health_schedules |

### Components Created

**1. New RPC Function: `get_regional_data_quality`**
- Location: Database migration
- Parameters: `region_filter`, `province_filter`, `municipality_filter`, `data_category_filter`
- Returns: Regional breakdown of data quality metrics

**2. New Hook: `useRegionalDataQuality`**
- Location: `src/hooks/useRegionalDataQuality.ts`
- Calls the RPC with dataCategory propagation
- Returns typed summary with regional breakdown

**3. New Component: `DataQualityDashboardCard`**
- Location: `src/components/government/DataQualityDashboardCard.tsx`
- Shows:
  - Overall Data Quality Score (0-100%)
  - Four metric cards (GPS, Weight, Production, Health)
  - Regional breakdown with color-coded status
  - Expandable list of regions needing attention

---

## Feature 2: Regional PCRS Aggregation

### Purpose
Aggregate Pre-Calving Risk Scores by region and month to enable proactive veterinary resource planning, identify high-risk regions before calving season peaks, and allocate intervention resources effectively.

### PCRS Aggregation Logic

Uses existing PCRS scoring from `src/lib/urgencyGlossary.ts`:
- **Critical (75-100)**: Immediate veterinary review
- **High (50-74)**: Priority monitoring needed
- **Moderate (25-49)**: Standard close-up protocols
- **Low (0-24)**: Routine monitoring

### Regional Aggregation Strategy

| Aggregation Level | Calculation |
|-------------------|-------------|
| By Region | Sum of animals in each PCRS tier |
| By Month | Expected deliveries grouped by month with PCRS tier distribution |
| Risk Score | Weighted average: (critical * 4 + high * 3 + moderate * 2 + low * 1) / total |

### Components Created

**1. New RPC Function: `get_regional_pcrs_summary`**
- Location: Database migration
- Parameters: `region_filter`, `province_filter`, `municipality_filter`, `data_category_filter`
- Returns: Per-region PCRS tier counts, monthly breakdown, risk scores

**2. New Hook: `useRegionalPCRS`**
- Location: `src/hooks/useRegionalPCRS.ts`
- Calls the RPC with dataCategory propagation
- Enriches with PCRS calculations client-side for accuracy

**3. New Component: `RegionalPCRSCard`**
- Location: `src/components/government/RegionalPCRSCard.tsx`
- Shows:
  - National PCRS summary (total by tier with icons)
  - Regional risk heatmap (sorted by risk score)
  - Monthly timeline showing expected delivery peaks with risk distribution
  - Expandable details per region

---

## Technical Implementation Details

### Database Migration

```sql
-- Function 1: get_regional_data_quality
CREATE OR REPLACE FUNCTION get_regional_data_quality(
  region_filter TEXT DEFAULT NULL,
  province_filter TEXT DEFAULT NULL,
  municipality_filter TEXT DEFAULT NULL,
  data_category_filter TEXT DEFAULT NULL
) RETURNS TABLE (
  region TEXT,
  province TEXT,
  total_farms BIGINT,
  farms_with_gps BIGINT,
  gps_coverage_pct NUMERIC,
  total_animals BIGINT,
  animals_with_weight BIGINT,
  weight_completeness_pct NUMERIC,
  farms_with_production_logs BIGINT,
  production_tracking_pct NUMERIC,
  farms_with_health_logs BIGINT,
  health_recording_pct NUMERIC,
  overall_quality_score NUMERIC
) AS $$ ... $$;

-- Function 2: get_regional_pcrs_summary  
CREATE OR REPLACE FUNCTION get_regional_pcrs_summary(
  region_filter TEXT DEFAULT NULL,
  province_filter TEXT DEFAULT NULL,
  municipality_filter TEXT DEFAULT NULL,
  data_category_filter TEXT DEFAULT NULL
) RETURNS TABLE (
  region TEXT,
  province TEXT,
  total_pregnant BIGINT,
  critical_count BIGINT,
  high_count BIGINT,
  moderate_count BIGINT,
  low_count BIGINT,
  avg_pcrs_score NUMERIC,
  monthly_breakdown JSONB
) AS $$ ... $$;
```

### Hook Implementation Pattern

Following existing patterns from `useRegionalFeedSecurity`:

```typescript
// src/hooks/useRegionalDataQuality.ts
export const useRegionalDataQuality = (
  region?: string,
  province?: string,
  municipality?: string,
  dataCategory: DataCategory = 'live'
) => {
  return useQuery<DataQualitySummary>({
    queryKey: ["regional-data-quality", region, province, municipality, dataCategory],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_regional_data_quality", {
        region_filter: region || null,
        province_filter: province || null,
        municipality_filter: municipality || null,
        data_category_filter: dataCategory === 'all' ? null : dataCategory,
      });
      // ... process and return
    },
  });
};
```

### Component UI Pattern

Following `FeedSecurityCard` layout:
- Header with icon and title
- Summary stat cards in 2x2 grid
- Progress bars for each metric
- Regional breakdown list with status indicators

---

## Files to Create

| File | Type | Purpose |
|------|------|---------|
| `src/hooks/useRegionalDataQuality.ts` | Hook | Fetch data quality metrics |
| `src/hooks/useRegionalPCRS.ts` | Hook | Fetch regional PCRS aggregation |
| `src/components/government/DataQualityDashboardCard.tsx` | Component | Data quality visualization |
| `src/components/government/RegionalPCRSCard.tsx` | Component | PCRS regional aggregation display |
| Database migration | SQL | Two new RPC functions |

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/GovernmentDashboard.tsx` | Add new section and components in Programs tab |

---

## Integration into Government Dashboard

Location: **Programs & Insights** tab, new section "Data Quality & Risk Management"

```text
Programs & Insights Tab
├── Grant Program Analytics (existing)
├── Farmer Queries Analysis (existing)
├── Production Trends (existing)
├── Economic & Feed Security (existing)
├── Operational Compliance (existing)
├── **NEW: Data Quality & Risk Management**
│   ├── DataQualityDashboardCard
│   └── RegionalPCRSCard
└── Coming Soon sections (existing)
```

### Dashboard Integration Code

```tsx
{/* Data Quality & Risk Management */}
<div className="space-y-4">
  <div className="flex items-center gap-2 pb-2 border-b">
    <DatabaseIcon className="h-5 w-5 text-primary" />
    <h3 className="text-lg font-semibold">Data Quality & Risk Management</h3>
    <span className="text-sm text-muted-foreground">
      Monitoring data completeness and pre-calving risk
    </span>
  </div>
  
  <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
    <DataQualityDashboardCard
      region={primaryRegion}
      province={primaryProvince}
      municipality={primaryMunicipality}
      dataCategory={dataCategory}
    />
    <RegionalPCRSCard
      region={primaryRegion}
      province={primaryProvince}
      municipality={primaryMunicipality}
      dataCategory={dataCategory}
    />
  </div>
</div>
```

---

## Change Impact Summary

**Modified Files:**
- `src/pages/GovernmentDashboard.tsx` - Add import and section

**Data Flow:**
- `farms` + `animals` + `milking_records` + `health_records` -> `get_regional_data_quality` RPC -> `useRegionalDataQuality` -> `DataQualityDashboardCard`
- `ai_records` + `animals` + `farms` + `bcs_records` -> `get_regional_pcrs_summary` RPC -> `useRegionalPCRS` -> `RegionalPCRSCard`

**Consumers Verified:**
- Both new components receive `dataCategory` prop from GovernmentDashboard
- Hooks follow SSOT pattern with `data_category_filter` parameter
- Existing PCRS glossary functions reused for tier calculations

**Breaking Changes:** None

**Testing Points:**
- Navigate to Government Dashboard > Programs & Insights tab
- Verify Data Quality card shows GPS, Weight, Production, Health metrics
- Verify PCRS card shows tier distribution and monthly breakdown
- Test with Live/Demo/All data source toggle
- Test regional filtering works correctly

---

## QA Checklist

- [ ] TypeScript compiles without errors
- [ ] Both hooks handle loading states correctly
- [ ] Both hooks handle empty/null data gracefully
- [ ] Error boundaries display failures appropriately
- [ ] Console logs include `[DataQuality]` and `[PCRS]` prefixes
- [ ] Data category filter propagates correctly through the chain
- [ ] Regional filters cascade properly
- [ ] PCRS tier colors match urgencyGlossary definitions
- [ ] Mobile responsiveness verified
