
# Add Date Context to Government Dashboard + Deep Analytics for Doc Aga Analyst

## Problem Analysis

### Issue 1: Missing Date Context in Government Dashboard

The Doc Aga Analyst doesn't know the current date, leading to responses like "please provide the current date" (as shown in the screenshot). The farmer dashboard displays a `PhilippineTimeBanner` component but the government dashboard lacks this.

**Current State:**
- `GovernmentLayout.tsx` has no date/time display
- Government analyst prompt (`getGovernmentAnalystPrompt()`) does NOT include date context like the farmer prompt does
- The farmer prompt explicitly includes: `Current date and time: ${dateContext.currentDate} (Philippine Standard Time, UTC+8)`

### Issue 2: Generic Responses Instead of Data-Driven Analysis

The AI gives explanations like "Urgent means within 30 days" but doesn't:
- Query the ACTUAL data for March 2026 deliveries
- Examine health records that might impact those specific animals
- Check BCS scores for pregnant animals due in March 2026
- Correlate potential risks (outbreaks, low BCS) with delivery success

**Root Cause:** The government analyst tools are too high-level and don't provide:
1. Expected deliveries breakdown by month with animal-level detail
2. Cross-referencing of health issues with pregnant animals
3. BCS analysis for specific cohorts (e.g., "animals due in March 2026")
4. Risk correlation analysis

---

## Solution Design

### Part 1: Add Date Context to Government Dashboard UI

**File: `src/components/government/GovernmentLayout.tsx`**

Add the existing `PhilippineTimeBanner` component to the header (matching the farmer dashboard pattern).

```tsx
import { PhilippineTimeBanner } from "@/components/ui/PhilippineTimeBanner";

// In header section:
<div>
  <h1 className="text-2xl font-bold">Government Dashboard</h1>
  <p className="text-sm text-muted-foreground">Livestock industry insights</p>
  <PhilippineTimeBanner compact />
</div>
```

### Part 2: Inject Date Context into Government Analyst Prompt

**File: `supabase/functions/doc-aga/index.ts`**

Update `getGovernmentAnalystPrompt()` to accept a date parameter (similar to `getFarmerSystemPrompt`):

```typescript
function getGovernmentAnalystPrompt(currentDate: string): string {
  return `You are Doc Aga Analytics...
  
  CRITICAL DATE CONTEXT:
  - Current date and time: ${currentDate} (Philippine Standard Time, UTC+8)
  - When calculating urgency (e.g., "Urgent = within 30 days"), use this date as the reference
  - Example: If today is February 5, 2026, then March 7, 2026 is 30 days away, making any deliveries on or before that date "Urgent"
  
  ...rest of prompt
`;
}
```

Also update the call site:
```typescript
const currentDate = new Date().toLocaleString('en-PH', {
  timeZone: 'Asia/Manila',
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
}) + ' PHT';

const systemPrompt = isGovernmentContext 
  ? getGovernmentAnalystPrompt(currentDate) 
  : getFarmerSystemPrompt(faqContext, dateContext);
```

### Part 3: Add Deep Analytics Tools for Specific Queries

**File: `supabase/functions/doc-aga/tools.ts`**

Create new government analyst tools that provide data-driven answers:

#### Tool 1: `get_expected_deliveries_analysis`
```typescript
{
  name: "get_expected_deliveries_analysis",
  description: "Get detailed analysis of expected deliveries by month, including health risks, BCS scores, and potential issues for animals due in each period",
  parameters: {
    type: "object",
    properties: {
      month: { type: "string", description: "Target month (e.g., 'March 2026') or 'all' for overview" },
      include_health_risks: { type: "boolean", description: "Include health records correlation" },
      include_bcs: { type: "boolean", description: "Include body condition score analysis" }
    }
  }
}
```

**Returns:**
- Animals due in the specified month with their current status
- Health events in the last 30 days for those animals
- BCS scores and trends (underweight = higher miscarriage risk)
- Risk assessment based on correlations

#### Tool 2: `get_delivery_risk_assessment`
```typescript
{
  name: "get_delivery_risk_assessment",
  description: "Analyze potential risks for upcoming deliveries: health outbreaks affecting pregnant animals, underweight animals, repeat breeders with history",
  parameters: {
    type: "object",
    properties: {
      start_date: { type: "string", description: "Start of period (YYYY-MM-DD)" },
      end_date: { type: "string", description: "End of period (YYYY-MM-DD)" }
    }
  }
}
```

**Returns:**
- Count of pregnant animals with recent health issues
- Animals with BCS < 2.5 (underweight, higher risk)
- Regional health outbreak analysis
- Historical success rates for this cohort

#### Tool 3: `get_cohort_health_analysis`
```typescript
{
  name: "get_cohort_health_analysis", 
  description: "Analyze health status for a specific cohort (e.g., animals due in March 2026, lactating cattle in Region X)",
  parameters: {
    type: "object",
    properties: {
      cohort_type: { type: "string", description: "Type: 'pregnant_due', 'lactating', 'by_region'" },
      filter_value: { type: "string", description: "Filter value (e.g., 'March 2026' or 'Region IV-A')" }
    }
  }
}
```

**Returns:**
- Cohort size and breakdown by livestock type
- Health events in last 30/90 days
- BCS distribution (underweight/optimal/overweight)
- Mortality/morbidity rates for this cohort
- Comparison to overall population averages

### Part 4: Update Government Tools List

**File: `supabase/functions/doc-aga/index.ts`**

Add the new tools to `getGovernmentTools()`:

```typescript
function getGovernmentTools(): any[] {
  return [
    // Existing tools...
    { type: "function", function: { name: "get_national_overview", ... } },
    { type: "function", function: { name: "get_regional_stats", ... } },
    { type: "function", function: { name: "get_breeding_analytics", ... } },
    { type: "function", function: { name: "get_health_analytics", ... } },
    { type: "function", function: { name: "get_production_trends", ... } },
    { type: "function", function: { name: "get_farmer_feedback_summary", ... } },
    
    // NEW: Deep analytics tools
    { type: "function", function: { 
      name: "get_expected_deliveries_analysis",
      description: "Get detailed breakdown of expected deliveries by month with health risk assessment, BCS analysis, and potential complications for pregnant animals",
      parameters: { type: "object", properties: { 
        target_month: { type: "string", description: "Target month in format 'YYYY-MM' (e.g., '2026-03' for March 2026)" },
        include_health_risks: { type: "boolean", description: "Include correlation with recent health events" }
      }}
    }},
    { type: "function", function: { 
      name: "get_delivery_risk_assessment",
      description: "Analyze risk factors for upcoming deliveries: health outbreaks, underweight animals (low BCS), regional disease patterns that could impact delivery success",
      parameters: { type: "object", properties: {
        days_ahead: { type: "number", description: "How many days ahead to analyze (default: 60)" }
      }}
    }},
    { type: "function", function: { 
      name: "get_cohort_health_analysis",
      description: "Deep health analysis for a specific cohort of animals (pregnant due in specific month, animals in a region, etc.)",
      parameters: { type: "object", properties: {
        cohort_filter: { type: "string", description: "Filter type: 'due_month', 'region', 'livestock_type'" },
        filter_value: { type: "string", description: "Value for filter (e.g., '2026-03', 'Region IV-A', 'cattle')" }
      }}
    }}
  ];
}
```

### Part 5: Implement Tool Functions

**File: `supabase/functions/doc-aga/tools.ts`**

#### `getExpectedDeliveriesAnalysis()`
```typescript
async function getExpectedDeliveriesAnalysis(args: any, supabase: SupabaseClient) {
  const targetMonth = args.target_month; // e.g., "2026-03"
  const includeHealthRisks = args.include_health_risks !== false;
  
  // Get all pregnant animals with expected delivery dates
  const { data: pregnantAnimals } = await supabase
    .from('ai_records')
    .select(`
      id, expected_delivery_date, performed_date, pregnancy_confirmed,
      animals!inner(id, name, ear_tag, livestock_type, farm_id, farms!inner(name, region, municipality))
    `)
    .eq('pregnancy_confirmed', true)
    .not('expected_delivery_date', 'is', null)
    .order('expected_delivery_date', { ascending: true });

  // Group by month
  const byMonth: Record<string, any[]> = {};
  pregnantAnimals?.forEach(r => {
    const month = r.expected_delivery_date?.substring(0, 7);
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(r);
  });

  // If specific month requested, get detailed analysis
  if (targetMonth && byMonth[targetMonth]) {
    const animalIds = byMonth[targetMonth].map(r => r.animals?.id).filter(Boolean);
    
    // Get recent health records for these animals
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data: healthRecords } = await supabase
      .from('health_records')
      .select('animal_id, diagnosis, visit_date')
      .in('animal_id', animalIds)
      .gte('visit_date', thirtyDaysAgo);
    
    // Get BCS records for these animals
    const { data: bcsRecords } = await supabase
      .from('body_condition_records')
      .select('animal_id, score, recorded_at')
      .in('animal_id', animalIds)
      .order('recorded_at', { ascending: false });
    
    // Calculate risk metrics
    const animalsWithHealthIssues = new Set(healthRecords?.map(r => r.animal_id) || []);
    const lowBcsAnimals = bcsRecords?.filter(r => r.score < 2.5) || [];
    
    return {
      month: targetMonth,
      total_deliveries: byMonth[targetMonth].length,
      by_livestock_type: groupBy(byMonth[targetMonth], r => r.animals?.livestock_type),
      by_region: groupBy(byMonth[targetMonth], r => r.animals?.farms?.region),
      health_risk_summary: {
        animals_with_recent_health_issues: animalsWithHealthIssues.size,
        percentage_with_issues: Math.round((animalsWithHealthIssues.size / animalIds.length) * 100),
        common_diagnoses: getTopDiagnoses(healthRecords),
      },
      bcs_risk_summary: {
        animals_with_low_bcs: lowBcsAnimals.length,
        percentage_underweight: Math.round((lowBcsAnimals.length / animalIds.length) * 100),
        note: "Animals with BCS < 2.5 have higher risk of delivery complications"
      },
      animals_at_risk: getHighRiskAnimals(byMonth[targetMonth], animalsWithHealthIssues, lowBcsAnimals)
    };
  }

  // Return monthly overview
  return {
    total_pregnant: pregnantAnimals?.length || 0,
    by_month: Object.entries(byMonth).map(([month, animals]) => ({
      month,
      count: animals.length,
      is_urgent: isWithin30Days(month),
      by_type: countByType(animals)
    }))
  };
}
```

### Part 6: Enhanced System Prompt for Analytical Depth

Update the government analyst prompt to encourage deep analysis:

```typescript
ANALYTICAL APPROACH:
When asked about dashboard metrics or specific data:
1. ALWAYS use the relevant tool to fetch actual data - never guess or generalize
2. When explaining "Urgent" deliveries for a specific month, query that month's data
3. Cross-reference with health data to identify risk factors
4. Include BCS analysis for pregnant animals (low BCS = higher complications risk)
5. Provide specific counts and percentages, not just definitions
6. Explain the "why" behind the numbers - what factors contribute to the status

EXAMPLE OF GOOD ANALYSIS:
User: "Why are March 2026 deliveries marked as Urgent?"
Response: "March 2026 deliveries are marked Urgent because they fall within 30 days of today (February 5, 2026). Let me analyze the data:

Based on the expected deliveries analysis:
- 25 animals are due in March 2026 (18 cattle, 5 goats, 2 carabao)
- 3 of these (12%) have had health events in the past 30 days
- 2 animals have low BCS (< 2.5), indicating potential nutritional issues
- No regional disease outbreaks currently affecting these animals

Recommendation: Focus on the 2 underweight animals for nutritional intervention before delivery."
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/components/government/GovernmentLayout.tsx` | MODIFY | Add PhilippineTimeBanner for date display |
| `supabase/functions/doc-aga/index.ts` | MODIFY | Pass date context to government prompt, add new tools |
| `supabase/functions/doc-aga/tools.ts` | MODIFY | Implement deep analytics tool functions |

---

## Expected Outcomes

### After Implementation:

**Date Context:**
- Government dashboard header shows current Philippine date/time
- Doc Aga Analyst always knows the current date
- Urgency calculations are explicitly tied to "today's date"

**Analytical Depth:**
When asked "Why is March 2026 urgent?", the AI will:
1. Confirm today is February 5, 2026
2. Explain March 2026 is within 30 days (= Urgent)
3. Query the actual 25 animals due in March 2026
4. Report 3 have recent health issues, 2 have low BCS
5. Flag specific risk factors (outbreaks, underweight)
6. Provide actionable recommendations

### Sample Response After Fix:
```
Today is February 5, 2026. The 25 animals due in March 2026 are marked "Urgent" 
because they fall within the 30-day window.

Risk Assessment for March 2026 Deliveries:
• Total: 25 animals (18 cattle, 5 goats, 2 carabao)
• With recent health issues: 3 (12%)
• With low BCS (< 2.5): 2 (8%) 
• Regional outbreaks affecting pregnant animals: None detected

The 2 underweight animals (low BCS) have a higher risk of delivery complications. 
I recommend nutritional intervention and closer monitoring for these cases.
```

---

## Technical Details

### Date Context Flow

```text
User sends query → Edge function receives request
                 → Generate currentDate in PH timezone
                 → Pass to getGovernmentAnalystPrompt(currentDate)
                 → AI has explicit date context in system prompt
                 → AI uses tools to fetch data
                 → AI provides date-aware analysis
```

### Tool Data Flow

```text
User asks about March 2026 deliveries
  → AI calls get_expected_deliveries_analysis({ target_month: "2026-03" })
  → Tool queries ai_records for pregnant animals due in 2026-03
  → Tool queries health_records for those animal IDs (last 30 days)
  → Tool queries body_condition_records for BCS data
  → Tool returns structured risk assessment
  → AI interprets data and provides specific insights
```
