
# Fix Voice Feed Recording: Fuzzy Matching, Spoken Numbers, and Suggestions

## Problem Summary

Audio: "Nagpakain tayo ng RumSol Feeds na ten kilos kahapon para sa lahat"

| Field | Expected | Got | Status |
|-------|----------|-----|--------|
| Date | January 26, 2026 | January 26, 2026 | Working |
| Animals | All Animals (5) | All Animals (5) | Working |
| Feed Type | Rumsol Feeds Cattle Grower | Empty | Broken |
| Total KG | 10 | Empty | Broken |

### Root Causes

1. **Feed type matching is too rigid**: "RumSol Feeds" doesn't match any hardcoded keyword patterns, and exact inventory name matching fails because the inventory is "Rumsol Feeds Cattle Grower"

2. **"ten kilos" not captured**: The spoken number parser exists but the regex `(\w+(?:[\s'\-t]+\w+)?)\s*(?:kg|kilo|kilograms?|kilos)` captures "na ten" instead of just "ten", and "na" is not in NUMBER_WORDS

3. **No suggestions UI**: When the system can't auto-pick with high confidence, there's no way to show close alternatives to the user

---

## Solution: Auto-pick + Suggest with Fuzzy Matching

### Part 1: Enhanced Feed Type Extraction with Fuzzy Matching

**File: `src/lib/voiceFormExtractors.ts`**

Add fuzzy matching for feed types using the existing `findBestMatch` and `findAllMatches` utilities:

```typescript
import { findBestMatch, findAllMatches } from './fuzzyMatch';

// In ExtractedFeedData interface, add:
export interface ExtractedFeedData {
  totalKg?: number;
  feedType?: string;
  feedInventoryId?: string;
  animalSelection?: string;
  recordDate?: Date;
  warnings?: string[];
  suggestedFeeds?: Array<{ id: string; name: string; score: number }>; // NEW
  matchConfidence?: 'high' | 'low' | 'none'; // NEW
}
```

Update the feed extraction logic:

1. First try hardcoded keyword matching (existing logic)
2. If no match, extract potential feed name from transcription
3. Use fuzzy matching against inventory with confidence scoring
4. If high confidence (score >= 0.7): auto-pick
5. If low confidence (0.4 <= score < 0.7): suggest alternatives
6. If no match: show all inventory as suggestions

### Part 2: Fix Spoken Number Extraction

**File: `src/lib/voiceFormExtractors.ts`**

The current regex captures "na ten" because of the pattern. Fix by:

1. Extract the number word directly (not as part of a compound capture)
2. Handle Tagalog articles like "na", "ng" before the number

```typescript
// Improved pattern matching for spoken numbers
const spokenKgPatterns = [
  // "ten kilos" - direct number word before unit
  /\b(zero|one|two|three|...|ten|twenty|thirty|...)\s*(?:kilos?|kg)/i,
  // "ng ten kilos" - Tagalog article before number
  /(?:na|ng|of)\s+(zero|one|two|...|ten|twenty|...)\s*(?:kilos?|kg)/i,
];
```

Also: Add fallback to scan entire transcription for standalone number words near "kilo"/"kg".

### Part 3: UI for Feed Suggestions

**File: `src/components/feed-recording/RecordBulkFeedDialog.tsx`**

When `extractedData.suggestedFeeds` is present and `matchConfidence === 'low'`:

1. Show a toast with the top suggestion(s)
2. Auto-open the Feed Type dropdown with suggestions highlighted
3. Display extracted info in toast: "Heard: RumSol Feeds, Did you mean: Rumsol Feeds Cattle Grower?"

```tsx
const handleVoiceDataExtracted = (data: ExtractedFeedData) => {
  // ... existing logic ...

  // NEW: Handle suggestions
  if (data.matchConfidence === 'low' && data.suggestedFeeds?.length) {
    toast({
      title: "Feed Suggestion",
      description: `Heard "${data.rawSpokenFeed}". Did you mean "${data.suggestedFeeds[0].name}"?`,
      action: (
        <Button 
          size="sm" 
          onClick={() => setFeedType(data.suggestedFeeds![0].id)}
        >
          Yes
        </Button>
      ),
    });
  }
};
```

---

## Implementation Details

### File 1: `src/lib/voiceFormExtractors.ts`

**Changes:**

1. Import fuzzy matching utilities
2. Expand `ExtractedFeedData` interface with `suggestedFeeds`, `matchConfidence`, `rawSpokenFeed`
3. Create `extractFeedNameFromText()` helper to pull potential feed names
4. Create `fuzzyMatchFeedType()` to score against inventory
5. Update `extractFeedData()` to use fuzzy matching with confidence levels
6. Fix spoken number extraction with improved patterns

```typescript
/**
 * Extract potential feed name from transcription
 * Looks for patterns like "ng [feedname] na" or "[feedname] feeds/feed"
 */
function extractFeedNameFromText(text: string): string | null {
  const patterns = [
    // "ng RumSol Feeds na" -> "RumSol Feeds"
    /(?:ng|of)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?(?:\s+feeds?)?)\s+(?:na|that)/i,
    // "[Brand] Feeds" standalone
    /\b([A-Za-z]+\s+(?:feeds?|pellets?|grower|concentrate))\b/i,
    // "[Something] Silage"
    /\b([A-Za-z]+\s+silage)\b/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

/**
 * Fuzzy match feed name against inventory
 */
function fuzzyMatchFeedType(
  spokenFeed: string,
  inventory: FeedInventoryItem[]
): { 
  bestMatch: { id: string; name: string } | null;
  confidence: 'high' | 'low' | 'none';
  suggestions: Array<{ id: string; name: string; score: number }>;
} {
  const inventoryNames = inventory.map(i => i.feed_type);
  const allMatches = findAllMatches(spokenFeed, inventoryNames, 0.4);
  
  if (allMatches.length === 0) {
    return { bestMatch: null, confidence: 'none', suggestions: [] };
  }
  
  const best = allMatches[0];
  const matchedInventory = inventory.find(i => i.feed_type === best.match);
  
  if (best.score >= 0.7) {
    return {
      bestMatch: matchedInventory ? { id: matchedInventory.id, name: matchedInventory.feed_type } : null,
      confidence: 'high',
      suggestions: allMatches.slice(0, 3).map(m => ({
        id: inventory.find(i => i.feed_type === m.match)?.id || '',
        name: m.match,
        score: m.score
      }))
    };
  }
  
  return {
    bestMatch: matchedInventory ? { id: matchedInventory.id, name: matchedInventory.feed_type } : null,
    confidence: 'low',
    suggestions: allMatches.slice(0, 3).map(m => ({
      id: inventory.find(i => i.feed_type === m.match)?.id || '',
      name: m.match,
      score: m.score
    }))
  };
}
```

**Spoken number fix:**

```typescript
// Improved extraction in extractFeedData()
if (!result.totalKg) {
  // Look for number words directly before kilo/kg
  const numberWordPattern = /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\s*(?:kilo|kg|kilos|kilograms?)/i;
  const wordMatch = transcription.match(numberWordPattern);
  if (wordMatch) {
    const parsed = parseSpokenNumber(wordMatch[1]);
    if (parsed && parsed >= 0.5 && parsed <= 500) {
      result.totalKg = parsed;
    }
  }
}
```

### File 2: `src/components/feed-recording/RecordBulkFeedDialog.tsx`

**Changes:**

1. Update `handleVoiceDataExtracted` to handle suggestions and show toast
2. If auto-pick succeeds (high confidence), set feedType directly
3. If low confidence, show actionable toast with "Did you mean?" suggestion

---

## Testing Scenarios

After implementation:

| Voice Input | Expected Behavior |
|-------------|-------------------|
| "RumSol Feeds na ten kilos" | Auto-picks "Rumsol Feeds Cattle Grower", sets 10kg |
| "Corn Silage twenty kilos" | Auto-picks "Baled Corn Silage" or "Bag Corn Silage" (suggests both) |
| "Rice Bran fifteen kilos" | Auto-picks "Rice Bran", sets 15kg |
| "XYZ Feed fifty kilos" | Shows suggestions from inventory, sets 50kg |
| "forty-seven kilos of hay" | Sets 47kg, suggests closest roughage |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/voiceFormExtractors.ts` | Add fuzzy matching for feeds, fix spoken number patterns, expand interface |
| `src/components/feed-recording/RecordBulkFeedDialog.tsx` | Handle suggestions in `handleVoiceDataExtracted`, show toast for low-confidence matches |

---

## Technical Notes

- Reuses existing `findBestMatch()` and `findAllMatches()` from `fuzzyMatch.ts`
- Threshold 0.7 for auto-pick balances accuracy vs. requiring manual selection
- Threshold 0.4 for suggestions ensures even partial matches surface
- Number word list covers 0-100 in English (Filipino numbers already in NUMBER_WORDS)
