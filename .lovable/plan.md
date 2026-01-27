
# Fix Taglish Voice Parsing: Feed Name + Spoken Numbers

## Problem Summary

The voice input **"nagpakain tayo ng rumsol feeds ngayon araw na two kilos para sa lahat"** has TWO extraction issues:

| Issue | Current Behavior | Expected |
|-------|------------------|----------|
| **Feed Name** | Not extracted (regex fails due to "ngayon araw" between feed and "na") | "Rumsol Feeds Cattle Grower" |
| **Quantity** | "two kilos" may not be extracted | 2 kg |

---

## Root Cause Analysis

### Issue 1: Feed Name Extraction Fails

**Current Pattern (line ~533):**
```javascript
/(?:ng|of)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?(?:\s+feeds?)?)\s+(?:na|that|ng)/i
```

**Input:** `"ng rumsol feeds ngayon araw na two kilos"`

**Problem:** Pattern expects `(feed name) + (na|that|ng)` immediately adjacent. But there's **"ngayon araw"** between "feeds" and "na".

### Issue 2: "two kilos" Should Work But May Not

**Pattern 2 in extractSpokenKilograms:**
```javascript
/(?:na|ng|of)\s+(two)\s*(?:kilos)\b/i
```

This SHOULD match "na two kilos" - but I suspect either:
- The function isn't being reached, OR
- There's a word boundary issue with the generated regex pattern

---

## Solution: Dual Fix

### Part 1: Enhanced Feed Name Extraction Patterns

Add new patterns to handle Taglish sentence structures where time words appear between feed name and quantity:

```typescript
// In extractFeedNameFromText() - add these patterns:

// NEW Pattern: "ng [brand feeds] ngayon/today/kanina/kahapon" 
// Handles time words after feed name
/(?:ng|of)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?(?:\s+feeds?)?)\s+(?:ngayon|today|kanina|kahapon|araw)/i,

// NEW Pattern: "nagpakain (tayo/ako) ng [brand]"
// Direct feeding verb pattern
/(?:nagpakain|nagfeed|pinakain)\s+(?:tayo|ako|sila|kami)?\s*(?:ng|of)?\s*([A-Za-z]+(?:\s+[A-Za-z]+)?(?:\s+feeds?)?)/i,

// NEW Pattern: Standalone "[brand] feeds" anywhere
/\b([A-Za-z]+\s+feeds?)\b/i,
```

### Part 2: Brand Name Normalization (STT Error Handling)

Add mapping for common STT transcription errors:

```typescript
const FEED_BRAND_ALIASES: Record<string, string[]> = {
  'rumsol': ['rumsol', 'rum sol', 'rum sulfid', 'rum sulfids', 'rumsole', 'rum sole'],
  'vitarich': ['vitarich', 'vita rich', 'vita-rich'],
  'bmeg': ['bmeg', 'b-meg', 'b meg'],
};

function normalizeFeedBrand(spoken: string): string {
  const lower = spoken.toLowerCase();
  for (const [canonical, aliases] of Object.entries(FEED_BRAND_ALIASES)) {
    if (aliases.some(alias => lower.includes(alias))) {
      return canonical;
    }
  }
  return spoken;
}
```

### Part 3: Prefix-Aware Fuzzy Matching

When user says "rumsol feeds", match against "Rumsol Feeds Cattle Grower" with high confidence:

```typescript
// In fuzzyMatchFeedType() - add prefix check BEFORE Levenshtein:

// Check if spoken feed is a prefix/beginning of any inventory item
for (const item of inventory) {
  const itemLower = item.feed_type.toLowerCase();
  const spokenLower = spokenFeed.toLowerCase();
  
  // "rumsol feeds" is prefix of "rumsol feeds cattle grower"
  if (itemLower.startsWith(spokenLower)) {
    return { 
      bestMatch: item, 
      confidence: 'high', 
      suggestions: [] 
    };
  }
}
```

### Part 4: Robust Spoken Number Pattern

Add explicit pattern for "X kilos para sa" structure:

```typescript
// In extractSpokenKilograms() - add Pattern 4:

// Pattern 4: "X kilos para sa" - spoken number before "para"
const paraPattern = new RegExp(
  `\\b(${NUMBER_WORD_PATTERN})\\s*(?:kilo|kg|kilos)\\s+(?:para|for)\\b`,
  'i'
);
const paraMatch = lowerText.match(paraPattern);
if (paraMatch) {
  const parsed = parseSpokenNumber(paraMatch[1]);
  if (parsed && parsed >= 0.5 && parsed <= 500) {
    console.log(`[VoiceExtractor] Para pattern match: "${paraMatch[1]}" → ${parsed}`);
    return parsed;
  }
}
```

---

## File Changes

### `src/lib/voiceFormExtractors.ts`

| Location | Change |
|----------|--------|
| ~Line 60 | Add `FEED_BRAND_ALIASES` constant |
| ~Line 75 | Add `normalizeFeedBrand()` helper function |
| ~Line 505 | Add Pattern 4 (para pattern) in `extractSpokenKilograms()` |
| ~Line 533 | Add 3 new patterns in `extractFeedNameFromText()` |
| ~Line 555 | Add prefix matching in `fuzzyMatchFeedType()` |
| ~Line 680 | Call `normalizeFeedBrand()` before matching |

---

## Expected Flow After Fix

**Input:** `"nagpakain tayo ng rumsol feeds ngayon araw na two kilos para sa lahat"`

1. **Feed Extraction:**
   - New pattern matches: `"ng rumsol feeds ngayon"` → extracts "rumsol feeds"
   - Brand normalization: "rumsol feeds" stays as-is (correct spelling)
   - Prefix match: "rumsol feeds" matches "Rumsol Feeds Cattle Grower" ✅

2. **Quantity Extraction:**
   - Pattern 2: `"na two kilos"` → extracts "two" → parses to 2
   - OR Pattern 4: `"two kilos para"` → extracts "two" → parses to 2 ✅

**Result:**
```json
{
  "feedType": "Rumsol Feeds Cattle Grower",
  "feedInventoryId": "inventory-uuid",
  "totalKg": 2,
  "matchConfidence": "high"
}
```

---

## Testing Matrix

| Voice Input | Expected feedType | Expected totalKg |
|-------------|-------------------|------------------|
| "nagpakain tayo ng rumsol feeds ngayon araw na two kilos para sa lahat" | Rumsol Feeds Cattle Grower | 2 |
| "rum sulfids two kilos" | Rumsol Feeds Cattle Grower | 2 |
| "rumsol feeds 10 kilos" | Rumsol Feeds Cattle Grower | 10 |
| "dalawang kilo ng rumsol" | Rumsol Feeds Cattle Grower | 2 |
| "twenty kilos of napier" | Napier | 20 |
