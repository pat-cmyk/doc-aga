
# Fix Data Category SSOT Violations in Doc Aga Government AI

## SSOT Violations Found

### Violation 1: Duplicated Type Definition
`DataCategory` is defined **7 times** in different files:

| File | Line |
|------|------|
| `src/pages/GovernmentDashboard.tsx` | 62 |
| `src/hooks/useBreedingStats.ts` | 22 |
| `src/hooks/useGrantAnalytics.ts` | 35 |
| `src/hooks/useGovernmentStats.ts` | 32 |
| `src/hooks/useGovernmentHealthStats.ts` | 40 |
| `src/hooks/useRegionalStats.ts` | 5 |
| `src/components/government/RegionalLivestockMap.tsx` | 11 |

**SSOT Fix**: Create single definition in `src/types/government.ts`

### Violation 2: Doc Aga Tools Ignore Data Category
The dashboard uses `data_category_filter` in all RPC calls, but the Doc Aga tools query **ALL farms**:

```typescript
// Dashboard (correct - uses filter):
await supabase.rpc("get_government_breeding_stats", {
  data_category_filter: dataCategory === 'all' ? null : dataCategory,
});

// Doc Aga tool (wrong - no filter):
const { data: aiRecords } = await supabase
  .from('ai_records')
  .select('...')  // No data_category filter!
```

**Result**: Dashboard shows 25 deliveries (demo), AI sees 0 (live data is empty)

---

## Solution Design

### Step 1: Create Centralized Type Definition

**New File: `src/types/government.ts`**

```typescript
/**
 * Data category for live/demo data segregation
 * Single Source of Truth - used across all government analytics
 */
export type DataCategory = 'live' | 'demo' | 'all';

/**
 * Default data category when not specified
 */
export const DEFAULT_DATA_CATEGORY: DataCategory = 'live';
```

### Step 2: Update All Files to Import from SSOT

Refactor all 7 files to import from the centralized location:

```typescript
// Before (in each file):
type DataCategory = 'live' | 'demo' | 'all';

// After (import from SSOT):
import { DataCategory } from '@/types/government';
```

### Step 3: Pass Data Category to Edge Function

**File: `src/components/DocAga.tsx`**

Extract `data_source` from URL and send to edge function:

```typescript
// Add to DocAga component
const [searchParams] = useSearchParams();
const dataCategory = searchParams.get('data_source') || 'live';

// Update fetch body
body: JSON.stringify({ 
  messages: messagesToSend, 
  context: isGovernmentContext ? 'government' : 'farmer',
  dataCategory: isGovernmentContext ? dataCategory : undefined,
  conversationId 
}),
```

### Step 4: Accept Data Category in Edge Function

**File: `supabase/functions/doc-aga/index.ts`**

Update schema and pass to tools:

```typescript
const docAgaRequestSchema = z.object({
  messages: z.array(...),
  farmId: z.string().uuid().optional(),
  context: z.enum(['farmer', 'government']).optional().default('farmer'),
  dataCategory: z.enum(['live', 'demo', 'all']).optional().default('live'),
  conversationId: z.string().uuid().optional(),
});

// Pass to executeToolCall
const toolResult = await executeToolCall(
  toolName, toolArgs, userSupabase, farmId, context, userId, conversationId, dataCategory
);
```

### Step 5: Create Helper Function for Farm Filtering

**File: `supabase/functions/doc-aga/tools.ts`**

Add centralized helper (SSOT pattern for tools):

```typescript
/**
 * Get farm IDs filtered by data category
 * Returns null if 'all' or no filter needed
 */
async function getFilteredFarmIds(
  supabase: SupabaseClient, 
  dataCategory?: 'live' | 'demo' | 'all'
): Promise<string[] | null> {
  if (!dataCategory || dataCategory === 'all') return null;
  
  const { data: farms } = await supabase
    .from('farms')
    .select('id')
    .eq('data_category', dataCategory)
    .eq('is_deleted', false);
  
  return farms?.map(f => f.id) || [];
}
```

### Step 6: Update All Government Tools

Apply consistent filter pattern to all 9 government tools:

| Tool | Current Filter | After Fix |
|------|----------------|-----------|
| `getNationalOverview` | None | `.in('farm_id', farmIds)` on animals query |
| `getRegionalStats` | None | Add farms filter |
| `getBreedingAnalytics` | None | Add animal/farm join filter |
| `getHealthAnalytics` | None | Add animal/farm join filter |
| `getProductionTrends` | None | Add animal/farm join filter |
| `getFarmerFeedbackSummary` | None | Add farm join filter |
| `getExpectedDeliveriesAnalysis` | None | Add farms filter |
| `getDeliveryRiskAssessment` | None | Add farms filter |
| `getCohortHealthAnalysis` | None | Add farms filter |

**Example Tool Update:**

```typescript
async function getExpectedDeliveriesAnalysis(
  args: any, 
  supabase: SupabaseClient,
  dataCategory?: 'live' | 'demo' | 'all'
) {
  // Get filtered farm IDs based on data category
  const farmIds = await getFilteredFarmIds(supabase, dataCategory);
  
  if (farmIds && farmIds.length === 0) {
    return {
      total_pregnant: 0,
      message: `No farms found with data category '${dataCategory}'`
    };
  }

  // Build query
  let query = supabase
    .from('ai_records')
    .select(`
      id, expected_delivery_date, pregnancy_confirmed,
      animals!inner(id, name, ear_tag, livestock_type, farm_id, 
        farms!inner(name, region, municipality, data_category))
    `)
    .eq('pregnancy_confirmed', true)
    .not('expected_delivery_date', 'is', null);
  
  // Apply farm filter if specified
  if (farmIds) {
    query = query.in('animals.farm_id', farmIds);
  }

  const { data: aiRecords } = await query.order('expected_delivery_date', { ascending: true });
  // ... rest of function
}
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/types/government.ts` | CREATE | SSOT for DataCategory type |
| `src/pages/GovernmentDashboard.tsx` | MODIFY | Import from SSOT |
| `src/hooks/useBreedingStats.ts` | MODIFY | Import from SSOT |
| `src/hooks/useGrantAnalytics.ts` | MODIFY | Import from SSOT |
| `src/hooks/useGovernmentStats.ts` | MODIFY | Import from SSOT |
| `src/hooks/useGovernmentHealthStats.ts` | MODIFY | Import from SSOT |
| `src/hooks/useRegionalStats.ts` | MODIFY | Import from SSOT |
| `src/components/government/RegionalLivestockMap.tsx` | MODIFY | Import from SSOT |
| `src/components/DocAga.tsx` | MODIFY | Pass dataCategory to edge function |
| `supabase/functions/doc-aga/index.ts` | MODIFY | Accept dataCategory in schema |
| `supabase/functions/doc-aga/tools.ts` | MODIFY | Add helper + filter all government tools |

---

## Expected Outcome

### Before (Broken):
```
Dashboard: data_source=demo → Shows 25 March deliveries
Doc Aga:   Queries ALL data → "No pregnant animals found"
```

### After (Fixed):
```
Dashboard: data_source=demo → Shows 25 March deliveries
Doc Aga:   Queries demo data → "25 animals due in March 2026..."
```

---

## Technical Details

### Data Flow After Fix

```text
URL: /government?data_source=demo
         │
         ▼
GovernmentDashboard.tsx
├── useBreedingStats(dataCategory='demo')
│   └── RPC: data_category_filter='demo' → 25 deliveries
│
└── DocAga (via FloatingFab)
    └── Reads searchParams.get('data_source') = 'demo'
        └── POST to edge function: { dataCategory: 'demo' }
            └── executeToolCall(..., dataCategory='demo')
                └── getFilteredFarmIds(supabase, 'demo')
                    └── Queries only demo farms
                        └── Returns same 25 deliveries ✓
```

### SSOT Alignment

| SSOT Principle | Implementation |
|----------------|----------------|
| Single type definition | `src/types/government.ts` |
| Single filter helper | `getFilteredFarmIds()` in tools.ts |
| Consistent filter pattern | All government tools use helper |
| URL as source of truth | DocAga reads from `data_source` param |
