
# RICO Policy Intelligence Enhancement: SSOT-Compliant Tool Expansion

## Executive Summary

This plan expands RICO's analytical capabilities to answer policy-level questions that government officials would ask, while strictly adhering to the project's Single Source of Truth (SSOT) architecture patterns.

---

## 1. Current State Analysis

### 1.1 RICO's Current Capabilities (9 Tools)

| Tool | Purpose | SSOT Compliance |
|------|---------|-----------------|
| `get_national_overview` | Farm/animal totals | Uses `getFilteredFarmIds()` |
| `get_regional_stats` | Region-specific stats | Uses `getFilteredFarmIds()` |
| `get_breeding_analytics` | AI success rates | Uses `getFilteredAnimalIds()` + batch pattern |
| `get_health_analytics` | Health patterns, mortality | Uses `getFilteredAnimalIds()` |
| `get_production_trends` | Milk production | Uses `getFilteredAnimalIds()` |
| `get_farmer_feedback_summary` | Feedback sentiment | Uses `getFilteredFarmIds()` |
| `get_expected_deliveries_analysis` | Pregnant animals | Uses batch + Map enrichment |
| `get_delivery_risk_assessment` | PCRS risk scoring | Uses batch + Map enrichment |
| `get_cohort_health_analysis` | Cohort deep-dive | Uses `getFilteredAnimalIds()` |

### 1.2 Identified Gaps (Policy Questions RICO Cannot Answer)

| Gap Category | Policy Question Example | Dashboard Has It? |
|--------------|------------------------|-------------------|
| **Genetics/Semen** | "What semen sources are being used?" | No hook exists |
| **Grant Programs** | "How are grant animals performing?" | `useGrantEffectiveness` |
| **Market Prices** | "What are regional milk prices?" | `useRegionalMarketPrices` |
| **Feed Security** | "Which regions have critical shortages?" | `useRegionalFeedSecurity` |
| **Farm Compliance** | "Which farms have poor record-keeping?" | `useFarmComplianceMetrics` |
| **Vaccination** | "What's our vaccination coverage?" | `preventive_health_schedules` |

---

## 2. SSOT Architecture Compliance Requirements

### 2.1 Core SSOT Principles (From Memory)

All new RICO tools MUST follow these established patterns:

```text
SSOT COMPLIANCE CHECKLIST
┌─────────────────────────────────────────────────────────────────┐
│ 1. DataCategory Propagation                                     │
│    - All tools accept dataCategory parameter                    │
│    - Type imported from _shared/analyst-tools.ts                │
│    - Values: 'live' | 'demo' | 'all'                           │
├─────────────────────────────────────────────────────────────────┤
│ 2. Two-Stage Fetching Pattern                                   │
│    - Stage 1: Get filtered farm/animal IDs                     │
│    - Stage 2: Query records with .in() filter                  │
│    - Stage 3: Enrich with Map-based lookups                    │
├─────────────────────────────────────────────────────────────────┤
│ 3. Batch Query Pattern (for large ID sets)                      │
│    - Use batchQuery() helper for >200 IDs                      │
│    - Avoid PostgREST URL length limits                         │
├─────────────────────────────────────────────────────────────────┤
│ 4. Helper Function Usage                                        │
│    - getFilteredFarmIds(supabase, dataCategory)                │
│    - getFilteredAnimalIds(supabase, dataCategory)              │
│    - batchQuery(ids, queryFn)                                  │
├─────────────────────────────────────────────────────────────────┤
│ 5. No Direct RPC Calls (for new tools)                          │
│    - Tools should query tables directly                        │
│    - RPC functions are for frontend hooks, not RICO            │
│    - This ensures dataCategory filter is applied consistently  │
├─────────────────────────────────────────────────────────────────┤
│ 6. Console Logging                                              │
│    - Prefix all logs with [RICO]                               │
│    - Log data counts for debugging                             │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Terminology Alignment (From Memory: urgency-glossary-ssot)

New tools must use consistent terminology:

| Term | Definition | Source |
|------|------------|--------|
| "Critical" (Feed) | <7 days stock | `urgencyGlossary.ts` |
| "Low" (Feed) | 7-30 days stock | `urgencyGlossary.ts` |
| "Overdue" (Vaccination) | Past scheduled date | `urgencyGlossary.ts` |
| "Urgent" (Vaccination) | Due within 2 days | `urgencyGlossary.ts` |

---

## 3. New Tools to Implement

### Phase 1: High-Priority Policy Tools

#### 3.1 `get_semen_analytics`

**Purpose:** Answer questions about genetic diversity and AI technician performance.

**Database Fields Used:**
- `ai_records.semen_code` (text)
- `ai_records.technician` (text)
- `ai_records.pregnancy_confirmed` (boolean)

**SSOT Implementation Pattern:**
```text
Step 1: getFilteredAnimalIds(supabase, dataCategory)
Step 2: Query ai_records with .in('animal_id', filteredIds)
Step 3: Aggregate by semen_code and technician
Step 4: Calculate success rates per source/technician
```

**Returns:**
```typescript
{
  period_days: number;
  unique_semen_sources: number;
  total_procedures: number;
  top_semen_sources: Array<{
    semen_code: string;
    procedures: number;
    confirmed: number;
    success_rate: number;
  }>;
  technician_performance: Array<{
    technician: string;
    procedures: number;
    success_rate: number;
  }>;
}
```

---

#### 3.2 `get_grant_program_analytics`

**Purpose:** Compare performance of grant-distributed vs purchased animals.

**Database Fields Used:**
- `animals.acquisition_type` ("grant" | "purchased" | "born_on_farm")
- `animals.grant_source` (text)
- `animals.exit_date`, `animals.exit_reason`
- Related: `health_records`, `milking_records`, `ai_records`

**SSOT Implementation Pattern:**
```text
Step 1: getFilteredFarmIds(supabase, dataCategory)
Step 2: Query animals with .in('farm_id', filteredIds)
Step 3: Group by acquisition_type
Step 4: Fetch related records (health, milking, AI)
Step 5: Calculate metrics per group using Map lookups
```

**Mirrors:** `useGrantEffectiveness` hook logic

**Returns:**
```typescript
{
  total_animals: number;
  by_acquisition_type: {
    grant: { count, mortality_rate, breeding_success, avg_milk };
    purchased: { count, mortality_rate, breeding_success, avg_milk };
    born_on_farm: { count, mortality_rate, breeding_success, avg_milk };
  };
  grant_sources: Array<{
    source: string;
    count: number;
    mortality_rate: number;
    breeding_success: number;
  }>;
  comparison_summary: string;
}
```

---

### Phase 2: Intelligence Enhancement Tools

#### 3.3 `get_market_price_intelligence`

**Purpose:** Analyze regional price trends and estimate revenue.

**Database Fields Used:**
- `market_prices` table (livestock_type, price_per_kg, region, effective_date)
- Related: `farms.region`, `farms.data_category`

**SSOT Implementation Pattern:**
```text
Step 1: getFilteredFarmIds(supabase, dataCategory)
Step 2: Query market_prices for farms in filtered set
Step 3: Calculate trends (rising/falling/stable) per region/species
Step 4: Estimate revenue from production data
```

**Mirrors:** `useRegionalMarketPrices` hook logic

---

#### 3.4 `get_feed_security_status`

**Purpose:** Identify regional feed shortage hotspots.

**Database Fields Used:**
- `dashboard_stats.feed_stock_days` (or computed from `feed_inventory`)
- `farms.region`, `farms.province`

**SSOT Implementation Pattern:**
```text
Step 1: getFilteredFarmIds(supabase, dataCategory)
Step 2: Query dashboard_stats or feed_inventory for filtered farms
Step 3: Classify: Critical (<7 days), Low (7-30), Adequate (>30)
Step 4: Aggregate by region
```

**Terminology Alignment:** Uses `urgencyGlossary.ts` definitions

**Mirrors:** `useRegionalFeedSecurity` hook logic

---

### Phase 3: Operational Intelligence Tools

#### 3.5 `get_vaccination_compliance`

**Purpose:** Track preventive health program effectiveness.

**Database Fields Used:**
- `preventive_health_schedules.schedule_type` (vaccination/deworming)
- `preventive_health_schedules.status` (pending/completed/overdue)
- `preventive_health_schedules.scheduled_date`, `completed_date`

**SSOT Implementation Pattern:**
```text
Step 1: getFilteredFarmIds(supabase, dataCategory)
Step 2: Query preventive_health_schedules with .in('farm_id', filteredIds)
Step 3: Classify by status and schedule_type
Step 4: Calculate compliance rates
```

---

#### 3.6 `get_farm_compliance_metrics`

**Purpose:** Track record-keeping compliance across farms.

**Database Fields Used:**
- `milking_records`, `feeding_records`, `health_records` - activity counts
- `farms` - total farm counts

**SSOT Implementation Pattern:**
```text
Step 1: getFilteredFarmIds(supabase, dataCategory)
Step 2: Count distinct farms with activity in date range
Step 3: Calculate completion percentages
Step 4: Identify high vs low compliance farms
```

**Mirrors:** `useFarmComplianceMetrics` hook logic

---

## 4. Implementation Details

### 4.1 File Changes

| File | Changes |
|------|---------|
| `supabase/functions/_shared/analyst-tools.ts` | Add 6 new tool functions (~500 lines) |
| `supabase/functions/rico/index.ts` | Update system prompt with new tool descriptions |

### 4.2 Code Structure for New Tools

Each new tool will follow this template:

```typescript
export async function getSemenAnalytics(
  args: any, 
  supabase: SupabaseClient, 
  dataCategory?: DataCategory
) {
  const days = args.days || 90;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  // SSOT Step 1: Get filtered animal IDs
  const animalIds = await getFilteredAnimalIds(supabase, dataCategory);
  
  // Handle empty filter results
  if (animalIds && animalIds.length === 0) {
    return {
      period_days: days,
      unique_semen_sources: 0,
      total_procedures: 0,
      top_semen_sources: [],
      technician_performance: [],
      message: `No animals found for data category '${dataCategory}'`
    };
  }

  // SSOT Step 2: Query with batch pattern if needed
  let aiRecords: any[] = [];
  if (animalIds && animalIds.length > MAX_IDS_PER_BATCH) {
    const result = await batchQuery(animalIds, async (batchIds) => {
      return await supabase
        .from('ai_records')
        .select('semen_code, technician, pregnancy_confirmed, animal_id')
        .gte('performed_date', startDate)
        .not('semen_code', 'is', null)
        .in('animal_id', batchIds);
    });
    aiRecords = result.data;
  } else {
    let query = supabase
      .from('ai_records')
      .select('semen_code, technician, pregnancy_confirmed, animal_id')
      .gte('performed_date', startDate)
      .not('semen_code', 'is', null);
    
    if (animalIds) {
      query = query.in('animal_id', animalIds);
    }
    
    const { data } = await query;
    aiRecords = data || [];
  }

  console.log(`[RICO] getSemenAnalytics: Found ${aiRecords.length} AI records with semen data`);

  // SSOT Step 3: Aggregate with Map-based lookups
  const semenStats = new Map<string, { count: number; confirmed: number }>();
  const techStats = new Map<string, { count: number; confirmed: number }>();

  aiRecords.forEach(r => {
    // Semen aggregation
    const code = r.semen_code || 'Unknown';
    const current = semenStats.get(code) || { count: 0, confirmed: 0 };
    current.count++;
    if (r.pregnancy_confirmed) current.confirmed++;
    semenStats.set(code, current);
    
    // Technician aggregation
    const tech = r.technician || 'Unknown';
    const techCurrent = techStats.get(tech) || { count: 0, confirmed: 0 };
    techCurrent.count++;
    if (r.pregnancy_confirmed) techCurrent.confirmed++;
    techStats.set(tech, techCurrent);
  });

  // Build response
  return {
    period_days: days,
    unique_semen_sources: semenStats.size,
    total_procedures: aiRecords.length,
    top_semen_sources: Array.from(semenStats.entries())
      .map(([code, stats]) => ({
        semen_code: code,
        procedures: stats.count,
        confirmed: stats.confirmed,
        success_rate: stats.count > 0 
          ? Math.round((stats.confirmed / stats.count) * 100) 
          : 0
      }))
      .sort((a, b) => b.procedures - a.procedures)
      .slice(0, 10),
    technician_performance: Array.from(techStats.entries())
      .map(([name, stats]) => ({
        technician: name,
        procedures: stats.count,
        success_rate: stats.count > 0 
          ? Math.round((stats.confirmed / stats.count) * 100) 
          : 0
      }))
      .sort((a, b) => b.procedures - a.procedures)
      .slice(0, 10),
  };
}
```

### 4.3 Tool Definitions Update

Add to `getAnalystTools()`:

```typescript
{ 
  type: "function", 
  function: { 
    name: "get_semen_analytics", 
    description: "Get semen source distribution, genetic diversity metrics, and AI technician success rates. Use this to answer questions about breeding program quality and technician performance.", 
    parameters: { 
      type: "object", 
      properties: { 
        days: { type: "number", description: "Analysis period in days (default: 90)" },
        region: { type: "string", description: "Optional region filter" }
      } 
    } 
  } 
},
// ... similar for other 5 tools
```

### 4.4 RICO System Prompt Update

Add to `YOUR AVAILABLE TOOLS` section:

```text
10. get_semen_analytics - Semen source distribution, genetic diversity, technician performance
11. get_grant_program_analytics - Compare grant vs purchased animal performance, ROI analysis
12. get_market_price_intelligence - Regional price trends, revenue estimates
13. get_feed_security_status - Regional feed shortage hotspots, critical farms
14. get_vaccination_compliance - Vaccination/deworming coverage rates
15. get_farm_compliance_metrics - Record-keeping compliance rates
```

---

## 5. Testing Plan

### 5.1 Sample Policy Questions to Validate

| Question | Expected Tool | Expected Data |
|----------|--------------|---------------|
| "What semen sources are being used?" | `get_semen_analytics` | Unique sources, top performers |
| "How are grant animals performing?" | `get_grant_program_analytics` | Grant vs purchased comparison |
| "Which regions have feed shortages?" | `get_feed_security_status` | Critical/Low farm counts |
| "What's our vaccination coverage?" | `get_vaccination_compliance` | Compliance percentages |
| "What are current milk prices?" | `get_market_price_intelligence` | Regional price trends |

### 5.2 SSOT Compliance Verification

For each new tool:
1. Test with `dataCategory: 'live'` - should return only live farm data
2. Test with `dataCategory: 'demo'` - should return only demo farm data
3. Test with `dataCategory: 'all'` - should return combined data
4. Verify counts match corresponding frontend hooks

---

## 6. Deployment Steps

1. Update `supabase/functions/_shared/analyst-tools.ts` with new tools
2. Update `supabase/functions/rico/index.ts` system prompt
3. Deploy RICO edge function
4. Test with sample policy questions
5. Verify dataCategory filtering works correctly

---

## Technical Summary

| Metric | Value |
|--------|-------|
| New tools | 6 |
| Lines added | ~500 |
| Files modified | 2 |
| SSOT patterns used | getFilteredFarmIds, getFilteredAnimalIds, batchQuery, Map enrichment |
| Breaking changes | None |
