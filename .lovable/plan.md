
# Fix Doc Aga AI Query Failure on ai_records

## Problem Identified

The Doc Aga AI correctly retrieves 65 demo farms and 765 demo animals, but returns **0 pregnant animals** from `ai_records` despite 120 pregnant records existing in the database.

### Root Cause
All `ai_records` queries in `tools.ts` **silently ignore errors**:

```typescript
// Current code - error is discarded
const { data: aiRecords } = await aiQuery;
```

The query is failing, but we don't know why because the error is never logged.

### Suspected Causes
1. PostgREST complexity with nested `!inner` relations combined with RLS
2. Large `.in()` clause (765 IDs) exceeding query limits
3. Auth context issues specific to complex joins

---

## Solution: Two-Part Fix

### Part 1: Add Error Logging (Diagnostic)
Add error handling to all `ai_records` queries to capture the actual failure reason.

### Part 2: Simplify Query Pattern
Replace complex nested relation queries with simpler two-stage queries:
- **Stage 1**: Query `ai_records` with simple column filters (no nested relations)
- **Stage 2**: Fetch related `animals` and `farms` data separately if needed

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/doc-aga/tools.ts` | Add error handling + simplify queries |

---

## Implementation Details

### Pattern: Before (Complex Nested Query)

```typescript
let aiQuery = supabase
  .from('ai_records')
  .select(`
    id, expected_delivery_date, performed_date, pregnancy_confirmed,
    animals!inner(id, name, ear_tag, livestock_type, farm_id, 
      farms!inner(name, region, municipality, data_category))
  `)
  .eq('pregnancy_confirmed', true)
  .not('expected_delivery_date', 'is', null);

if (animalIds) {
  aiQuery = aiQuery.in('animal_id', animalIds);
}

const { data: aiRecords } = await aiQuery;  // ❌ Error ignored!
```

### Pattern: After (Simple Two-Stage Query)

```typescript
// Stage 1: Get ai_records with simple filter
let aiQuery = supabase
  .from('ai_records')
  .select('id, animal_id, expected_delivery_date, performed_date, pregnancy_confirmed')
  .eq('pregnancy_confirmed', true)
  .not('expected_delivery_date', 'is', null);

if (animalIds) {
  aiQuery = aiQuery.in('animal_id', animalIds);
}

const { data: aiRecords, error: aiError } = await aiQuery;

// Log any errors
if (aiError) {
  console.error('[getExpectedDeliveriesAnalysis] ai_records query error:', aiError.message);
  return {
    total_pregnant: 0,
    message: `Query error: ${aiError.message}`,
    error: true
  };
}

if (!aiRecords || aiRecords.length === 0) {
  return {
    total_pregnant: 0,
    message: "No pregnant animals with expected delivery dates found"
  };
}

// Stage 2: Get animal details separately
const animalIdsWithRecords = [...new Set(aiRecords.map(r => r.animal_id))];
const { data: animalDetails } = await supabase
  .from('animals')
  .select('id, name, ear_tag, livestock_type, farm_id')
  .in('id', animalIdsWithRecords);

// Stage 3: Get farm details
const farmIdsForAnimals = [...new Set(animalDetails?.map(a => a.farm_id) || [])];
const { data: farmDetails } = await supabase
  .from('farms')
  .select('id, name, region, municipality, data_category')
  .in('id', farmIdsForAnimals);

// Combine data
const animalMap = new Map(animalDetails?.map(a => [a.id, a]) || []);
const farmMap = new Map(farmDetails?.map(f => [f.id, f]) || []);

const enrichedRecords = aiRecords.map(record => ({
  ...record,
  animal: animalMap.get(record.animal_id),
  farm: farmMap.get(animalMap.get(record.animal_id)?.farm_id)
}));
```

---

## Affected Functions

All government tools that query `ai_records` need this fix:

| Function | Line | Status |
|----------|------|--------|
| `getBreedingAnalytics` | ~389-399 | Needs fix |
| `getExpectedDeliveriesAnalysis` | ~659-673 | Needs fix |
| `getDeliveryRiskAssessment` | ~858-880 | Needs fix |
| `getCohortHealthAnalysis` | ~1012-1030 | Needs fix |

---

## Expected Outcome

After implementation:

1. **Diagnostic phase**: Error messages will reveal the actual failure reason
2. **Production fix**: Simplified queries will bypass PostgREST/RLS complexity issues
3. **Doc Aga AI** will correctly report "25 animals due in March 2026" matching the dashboard

---

## Testing Plan

1. Deploy updated edge function
2. Test via curl: Query "How many animals are due for delivery in March 2026?"
3. Check edge function logs for:
   - Any error messages from the diagnostic logging
   - Successful data retrieval: "120 pregnant records found"
4. Verify AI response matches dashboard data

---

## Technical Notes

### Why Nested Relations May Fail
PostgREST translates nested `.select()` with `!inner` into SQL JOINs. When combined with:
- RLS policies on multiple tables
- Large `.in()` clauses
- Complex join paths

The query can fail silently or return unexpected results. Using separate queries avoids this complexity.

### SSOT Compliance
This fix maintains the SSOT architecture:
- `dataCategory` still flows from URL → component → edge function → tools
- The change is purely in how the database is queried, not in the data flow

