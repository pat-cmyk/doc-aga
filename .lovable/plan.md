

# Fix Doc Aga AI Data Category Filtering - Root Cause and Solution

## Problem Identified

### Symptom
- Dashboard shows **25 deliveries** in March 2026 (demo data)
- Doc Aga AI says "**No pregnant animals found**" when asked about the same data
- Both are supposed to use `data_source=demo` filter

### Root Cause
The Doc Aga tools use **nested relation filtering** which is NOT supported by Supabase PostgREST:

```typescript
// BROKEN - PostgREST doesn't support .in() on nested relations
aiQuery = aiQuery.in('animals.farm_id', farmIds);
```

This query silently fails and returns no results, while the dashboard uses a proper SQL RPC with JOINs that works correctly.

### Evidence from Logs
```
INFO Tool result: {
  total_pregnant: 0,
  message: "No pregnant animals with expected delivery dates found in the system"
}
```

### Evidence from Database
The data EXISTS - direct SQL query returns 30+ pregnant animals in demo farms:
```sql
-- This works and returns data:
SELECT * FROM ai_records a
JOIN animals an ON a.animal_id = an.id
JOIN farms f ON an.farm_id = f.id
WHERE f.data_category = 'demo' AND a.pregnancy_confirmed = true
```

---

## Solution: Two-Stage Query Pattern

Instead of nested relation filtering, use a two-stage query:

1. **Stage 1**: Get animal IDs from filtered farms
2. **Stage 2**: Query target table using animal IDs directly

### Before (Broken)
```typescript
let aiQuery = supabase
  .from('ai_records')
  .select('..., animals!inner(..., farms!inner(...))')
  .eq('pregnancy_confirmed', true);

if (farmIds) {
  aiQuery = aiQuery.in('animals.farm_id', farmIds);  // ❌ DOESN'T WORK
}
```

### After (Fixed)
```typescript
// Stage 1: Get animal IDs from filtered farms
let animalIds: string[] | null = null;
if (farmIds && farmIds.length > 0) {
  const { data: animals } = await supabase
    .from('animals')
    .select('id')
    .in('farm_id', farmIds)
    .eq('is_deleted', false);
  animalIds = animals?.map(a => a.id) || [];
  
  if (animalIds.length === 0) {
    return { total_pregnant: 0, message: "No animals found in selected farms" };
  }
}

// Stage 2: Query ai_records filtering by animal IDs directly
let aiQuery = supabase
  .from('ai_records')
  .select('..., animals!inner(..., farms!inner(...))')
  .eq('pregnancy_confirmed', true);

if (animalIds) {
  aiQuery = aiQuery.in('animal_id', animalIds);  // ✅ WORKS - direct column
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/doc-aga/tools.ts` | Refactor all government tools to use two-stage query pattern |

---

## Affected Tools (9 Total)

All government tools need this fix:

1. `getExpectedDeliveriesAnalysis` - Expected deliveries timeline
2. `getDeliveryRiskAssessment` - Risk assessment for deliveries
3. `getCohortHealthAnalysis` - Cohort health analysis
4. `getNationalOverview` - National statistics
5. `getRegionalStats` - Regional statistics
6. `getBreedingAnalytics` - Breeding success rates
7. `getHealthAnalytics` - Health patterns
8. `getProductionTrends` - Milk production trends
9. `getFarmerFeedbackSummary` - Farmer feedback summary

---

## Implementation Pattern

Create a helper function to standardize the pattern:

```typescript
/**
 * Get animal IDs filtered by data category (two-stage query helper)
 * This works around PostgREST limitation with nested .in() filters
 */
async function getFilteredAnimalIds(
  supabase: SupabaseClient,
  dataCategory?: DataCategory
): Promise<string[] | null> {
  // Get farm IDs first
  const farmIds = await getFilteredFarmIds(supabase, dataCategory);
  
  if (farmIds === null) return null; // No filter needed
  if (farmIds.length === 0) return []; // No farms found
  
  // Get animal IDs from those farms
  const { data: animals, error } = await supabase
    .from('animals')
    .select('id')
    .in('farm_id', farmIds)
    .eq('is_deleted', false);
  
  if (error) {
    console.error('[getFilteredAnimalIds] Error:', error.message);
    return null;
  }
  
  console.log(`[getFilteredAnimalIds] Found ${animals?.length || 0} animals for dataCategory '${dataCategory}'`);
  return animals?.map(a => a.id) || [];
}
```

---

## Logging Improvements

Add explicit logging for dataCategory to aid debugging:

```typescript
// In index.ts, add to the request log:
console.log(`Doc Aga request - context: ${context}, dataCategory: ${dataCategory || 'none'}`);

// In tools.ts, add to getFilteredFarmIds:
console.log(`[getFilteredFarmIds] Category: ${dataCategory}, Found: ${farms?.length || 0} farms`);
```

---

## Expected Outcome

### After Fix:
- **User asks**: "How many animals are due in March 2026?"
- **Dashboard shows**: 25 deliveries (demo data)
- **Doc Aga responds**: "There are 25 animals due in March 2026 (15 goats, 9 cattle, 1 carabao)..."

### Data Flow After Fix:
```
URL: data_source=demo
     │
     ▼
DocAga.tsx reads dataCategory='demo'
     │
     ▼
Edge function receives dataCategory='demo'
     │
     ▼
getFilteredAnimalIds(supabase, 'demo')
├── getFilteredFarmIds → 65 demo farm IDs
└── Get animals from those farms → ~765 animal IDs
     │
     ▼
Query ai_records.in('animal_id', animalIds) → 25 March 2026 ✓
```

---

## Technical Details

### Why PostgREST Nested .in() Fails

PostgREST translates Supabase queries to API calls. The `.in()` method on nested relations like `animals.farm_id` generates a query that PostgREST cannot properly interpret, resulting in either:
- Silent failure (returns empty results)
- Incorrect filtering

The RPC functions work because they use raw SQL with proper JOINs:
```sql
-- RPC uses proper SQL JOIN (works)
SELECT * FROM ai_records air
INNER JOIN animals a ON a.id = air.animal_id
INNER JOIN farms f ON f.id = a.farm_id
WHERE f.data_category = 'demo'
```

### SSOT Compliance

This fix maintains SSOT architecture:
1. `DataCategory` type defined in `src/types/government.ts`
2. URL `data_source` param is the single source of truth
3. Both dashboard RPCs and AI tools filter the same way
4. Helper functions ensure consistent filtering across all tools

