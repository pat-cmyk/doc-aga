

# Phase 2 Completion: Remove Unused Government Functions

## Summary

The `doc-aga/index.ts` file still contains two unused government functions that were left behind after the cleanup. These need to be removed to complete the Phase 2 refactor.

---

## Current State Analysis

The file is 868 lines, with lines 164-275 containing legacy code:

| Lines | Function | Status |
|-------|----------|--------|
| 164-260 | `getGovernmentAnalystPrompt()` | **UNUSED** - Remove |
| 262-275 | `getGovernmentTools()` | **UNUSED** - Remove |

The main handler (lines 688-690) already correctly uses only farmer functions:
```typescript
const systemPrompt = getFarmerSystemPrompt(faqContext, dateContext);
const tools = getFarmerTools();
```

---

## Changes to Make

### `supabase/functions/doc-aga/index.ts`

**Remove lines 164-275** (~112 lines):

```typescript
// ❌ DELETE: getGovernmentAnalystPrompt() - lines 164-260
function getGovernmentAnalystPrompt(currentDate: string): string {
  return `You are Doc Aga Analytics...`;
}

// ❌ DELETE: getGovernmentTools() - lines 262-275
function getGovernmentTools(): any[] {
  return [...];
}
```

**Keep everything else intact:**
- Rate limiting (lines 11-46)
- Request schema (lines 49-60)
- FAQ matching (lines 63-116)
- Query logging (lines 118-162)
- DateContext interface (lines 277-282)
- `getFarmerSystemPrompt()` (lines 285-402)
- `getFarmerTools()` (lines 405-437)
- Main handler (lines 440-868)

---

## File Size Impact

| Metric | Before | After |
|--------|--------|-------|
| Total Lines | 868 | ~756 |
| Reduction | - | ~13% |

---

## After This Change

The Doc Aga edge function will be completely farmer-focused:

```text
doc-aga/index.ts structure:
├── Rate limiting (35 lines)
├── Schema validation (12 lines)
├── FAQ matching (54 lines)
├── Query logging (45 lines)
├── DateContext interface (6 lines)
├── getFarmerSystemPrompt() (118 lines)
├── getFarmerTools() (33 lines)
└── Main handler (428 lines)
```

All government analytics are now handled exclusively by the RICO edge function.

---

## Verification

After deployment:
1. ✅ Farmer dashboard - Doc Aga works (voice, image, chat)
2. ✅ Government dashboard - RICO handles analytics (blue FAB)
3. ✅ No unused code in doc-aga function

