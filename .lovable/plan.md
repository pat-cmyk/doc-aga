
# Phase 2: Clean Up Legacy Government Code from Doc Aga

## Overview

Remove all government context handling from the Doc Aga edge function and frontend component, making Doc Aga purely a farmer-focused "barangay vet" persona. RICO is now the dedicated government analyst (already deployed in Phase 1).

---

## Files to Modify

| File | Action | Lines Affected |
|------|--------|----------------|
| `supabase/functions/doc-aga/index.ts` | MODIFY | Remove ~200+ lines of gov code |
| `supabase/functions/doc-aga/tools.ts` | MODIFY | Remove ~1100+ lines of gov tools |

---

## Detailed Changes

### 1. `supabase/functions/doc-aga/index.ts`

**Remove:**

| Section | Lines | Description |
|---------|-------|-------------|
| Schema validation | 59-61 | Remove `context` enum and `dataCategory` from schema |
| `getGovernmentAnalystPrompt()` | 166-262 | Full function removal (~100 lines) |
| `getGovernmentTools()` | 264-277 | Full function removal (~15 lines) |
| Government role check | 519-534 | Remove government access verification block |
| Context branching | 475-478 | Remove `isGovernmentContext` variable |
| Prompt/Tools selection | 724-730 | Simplify to always use farmer prompt/tools |
| executeToolCall context param | 787 | Remove context and dataCategory from call |

**Keep unchanged:**
- Rate limiting infrastructure
- Farmer tools and prompt
- FAQ matching
- Date context building
- Tool execution for farmer context
- Logging infrastructure

**After cleanup:** 
- `docAgaRequestSchema` removes `context` and `dataCategory` 
- Main handler only builds farmer system prompt
- `executeToolCall` only receives farmer context

### 2. `supabase/functions/doc-aga/tools.ts`

**Remove:**

| Section | Lines | Description |
|---------|-------|-------------|
| `DataCategory` type | 4 | Moved to `_shared/analyst-tools.ts` |
| PCRS calculations | 9-129 | Moved to shared |
| `batchQuery()` helper | 131-168 | Moved to shared |
| `getFilteredFarmIds()` | 170-193 | Moved to shared |
| `getFilteredAnimalIds()` | 195-224 | Moved to shared |
| Government context branch in executeToolCall | 238-271 | Remove entire `if (context === 'government')` block |
| Government tools comment | 368 | Remove section header |
| `getNationalOverview()` | 370-460 | Moved to shared |
| `getRegionalStats()` | 462-531 | Moved to shared |
| `getBreedingAnalytics()` | 533-663 | Moved to shared |
| `getHealthAnalytics()` | 665-739 | Moved to shared |
| `getProductionTrends()` | 741-805 | Moved to shared |
| `getFarmerFeedbackSummary()` | 807-864 | Moved to shared |
| Deep analytics header | 866 | Remove section header |
| `getExpectedDeliveriesAnalysis()` | 868-1140 | Moved to shared |
| `getDeliveryRiskAssessment()` | 1142-1501 | Moved to shared |
| `getCohortHealthAnalysis()` | 1503-1726 | Moved to shared |

**Keep:**
- All farmer tools (animal profiles, health records, milking, breeding, etc.)
- `executeToolCall` but only with farmer switch cases (starting at line 274)

**After cleanup:**
- File reduces from ~3656 lines to ~2400 lines
- Only farmer-related database operations remain
- Simpler executeToolCall signature (remove context, dataCategory params)

---

## Simplified executeToolCall Signature

**Before:**
```typescript
export async function executeToolCall(
  toolName: string,
  args: any,
  supabase: SupabaseClient,
  farmId: string | undefined,
  context: 'farmer' | 'government' = 'farmer',
  userId?: string,
  conversationId?: string,
  dataCategory?: DataCategory
)
```

**After:**
```typescript
export async function executeToolCall(
  toolName: string,
  args: any,
  supabase: SupabaseClient,
  farmId: string | undefined,
  userId?: string,
  conversationId?: string
)
```

---

## Cleanup Summary

```text
Before Phase 2:
┌─────────────────────────────────────────────┐
│  doc-aga edge function                      │
│  ├── Farmer Tools (~2400 lines)             │
│  ├── Government Tools (~1100 lines)   ❌    │
│  ├── Gov Prompt (~100 lines)           ❌    │
│  └── Context switching (~50 lines)     ❌    │
└─────────────────────────────────────────────┘

After Phase 2:
┌─────────────────────────────────────────────┐
│  doc-aga edge function (FARMER ONLY)        │
│  └── Farmer Tools (~2400 lines)             │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  rico edge function (GOVERNMENT ONLY)       │
│  └── Imports from _shared/analyst-tools.ts  │
└─────────────────────────────────────────────┘
```

---

## Code Size Impact

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| `doc-aga/index.ts` | ~908 lines | ~700 lines | ~23% |
| `doc-aga/tools.ts` | ~3656 lines | ~2400 lines | ~34% |

---

## Technical Implementation

### Step 1: Update `doc-aga/tools.ts`

1. Remove lines 1-224 (DataCategory, PCRS, helper functions)
2. Remove lines 238-271 (government context branch in executeToolCall)
3. Remove lines 368-1726 (all government tools)
4. Update executeToolCall signature to remove context/dataCategory params

### Step 2: Update `doc-aga/index.ts`

1. Remove schema fields (lines 59-61): `context` and `dataCategory`
2. Remove `getGovernmentAnalystPrompt()` function (lines 166-262)
3. Remove `getGovernmentTools()` function (lines 264-277)
4. Remove government role check block (lines 519-534)
5. Remove `isGovernmentContext` variable and conditionals (lines 475-478, 724-730)
6. Simplify executeToolCall call to remove context/dataCategory (line 787)

### Step 3: Deploy and Test

1. Deploy updated `doc-aga` edge function
2. Verify farmer chat flow works
3. Confirm RICO handles government dashboard

---

## Verification Checklist

After implementation:

1. **Doc Aga (Farmer):**
   - [ ] Voice input works
   - [ ] Image upload works
   - [ ] Animal queries work
   - [ ] Health record creation works
   - [ ] No government-related code paths

2. **RICO (Government):**
   - [ ] Already working from Phase 1
   - [ ] Uses shared tools from `_shared/analyst-tools.ts`
   - [ ] Blue FAB with Landmark icon

3. **No regressions:**
   - [ ] Deploy `doc-aga` function
   - [ ] Test farmer chat flow
   - [ ] Verify government dashboard uses RICO (not Doc Aga)

---

## Implementation Order

1. Update `supabase/functions/doc-aga/tools.ts` - remove government tools and helpers
2. Update `supabase/functions/doc-aga/index.ts` - remove government prompt, schema, and context logic
3. Deploy updated `doc-aga` edge function
4. Update plan documentation
5. Verify both personas work independently
