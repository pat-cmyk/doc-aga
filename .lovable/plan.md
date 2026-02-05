
# Phase 2: Clean Up Legacy Government Code from Doc Aga

## Overview

Remove all government context handling from the Doc Aga edge function and frontend component, making Doc Aga purely a farmer-focused "barangay vet" persona. RICO is now the dedicated government analyst (already deployed in Phase 1).

---

## Files to Modify

| File | Action | Lines Affected |
|------|--------|----------------|
| `supabase/functions/doc-aga/index.ts` | MODIFY | Remove ~200+ lines of gov code |
| `supabase/functions/doc-aga/tools.ts` | MODIFY | Remove ~1100+ lines of gov tools |
| `src/components/DocAga.tsx` | MODIFY | Remove ~50+ lines of gov context |

---

## Detailed Changes

### 1. `supabase/functions/doc-aga/index.ts`

**Remove:**

| Section | Lines | Description |
|---------|-------|-------------|
| Schema validation | ~59-62 | Remove `context` enum and `dataCategory` from schema |
| `getGovernmentAnalystPrompt()` | 166-262 | Full function removal (~100 lines) |
| `getGovernmentTools()` | 264-277 | Full function removal (~15 lines) |
| Government role check | 519-534 | Remove government access verification block |
| Context branching | 477-478, 724-730 | Remove `isGovernmentContext` logic |

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
- `executeToolCall` only handles farmer context

### 2. `supabase/functions/doc-aga/tools.ts`

**Remove:**

| Section | Lines | Description |
|---------|-------|-------------|
| PCRS calculations | 9-129 | Moved to `_shared/analyst-tools.ts` |
| `batchQuery()` helper | 131-168 | Moved to shared |
| `getFilteredFarmIds()` | 170-193 | Moved to shared |
| `getFilteredAnimalIds()` | 195-224 | Moved to shared |
| Government context branch | 238-271 | Remove entire `if (context === 'government')` block |
| `getNationalOverview()` | 370-460 | Moved to shared |
| `getRegionalStats()` | 462-510+ | Moved to shared |
| `getBreedingAnalytics()` | ~390-520 | Moved to shared |
| `getHealthAnalytics()` | ~520-650 | Moved to shared |
| `getProductionTrends()` | ~650-750 | Moved to shared |
| `getFarmerFeedbackSummary()` | ~750-850 | Moved to shared |
| `getExpectedDeliveriesAnalysis()` | ~850-1000 | Moved to shared |
| `getDeliveryRiskAssessment()` | ~1000-1200 | Moved to shared |
| `getCohortHealthAnalysis()` | ~1200-1400 | Moved to shared |

**Keep:**
- All farmer tools (animal profiles, health records, milking, breeding, etc.)
- `executeToolCall` but only with farmer switch cases

**After cleanup:**
- File reduces from ~3656 lines to ~2400 lines
- Only farmer-related database operations remain
- Remove `DataCategory` type and related helpers (now in shared)

### 3. `src/components/DocAga.tsx`

**Remove:**

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 16, 19 | `useGovernmentAccess`, government icons |
| Government context detection | 64, 68-72 | `hasGovernmentAccess`, `isGovernmentContext`, `dataCategory` |
| Government welcome message | 84-93 | `governmentWelcomeMessage` constant |
| Welcome message conditional | 76-82 | Simplify to always use farmer message |
| Government quick actions | 109-117 | Remove government-specific quick actions array |
| Force chat mode for gov | 138-143 | Remove `useEffect` that forces chat mode |
| Mode label for gov | 475-477 | Remove government `getModeLabel()` case |
| Mode color for gov | 486-488 | Remove government `getModeColor()` case |
| Input tabs conditional | 507-508 | Remove `!isGovernmentContext` conditional |
| Voice mode conditional | 639 | Remove `!isGovernmentContext` check |
| API call context param | 288-290 | Remove `context` and `dataCategory` from request body |

**Keep:**
- All farmer functionality (voice, image, chat)
- TTS queue
- Intent parsing
- Quick actions for farmers

**After cleanup:**
- Component becomes simpler farmer-only chat
- Remove `useGovernmentAccess` import
- Remove `useLocation` and `useSearchParams` if only used for gov context

---

## Cleanup Summary

```text
Before Phase 2:
┌─────────────────────────────────────────────┐
│  doc-aga edge function                      │
│  ├── Farmer Tools (~2500 lines)             │
│  ├── Government Tools (~1100 lines)   ❌    │
│  ├── Gov Prompt (~100 lines)           ❌    │
│  └── Context switching (~50 lines)     ❌    │
└─────────────────────────────────────────────┘

After Phase 2:
┌─────────────────────────────────────────────┐
│  doc-aga edge function (FARMER ONLY)        │
│  └── Farmer Tools (~2500 lines)             │
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
| `doc-aga/index.ts` | ~908 lines | ~650 lines | ~28% |
| `doc-aga/tools.ts` | ~3656 lines | ~2400 lines | ~34% |
| `DocAga.tsx` | ~702 lines | ~620 lines | ~12% |

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
3. Update `src/components/DocAga.tsx` - remove government context handling
4. Deploy updated `doc-aga` edge function
5. Verify both personas work independently
