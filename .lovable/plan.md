
# Fix Voice Feed Recording: Date, Spelled-Out Numbers, and Feed Type Matching

## Problem Summary

Based on investigation of the FAB feeding voice record:

**User said**: *"Nagpakain tayo kahapon January 26, 2026 ng 47 kilos na corn silage para sa lahat"*

**System extracted**:
- Date: January 27th (today) - **WRONG** (should be January 26th)
- Total Kilograms: 26 - **WRONG** (should be 47)
- Feed Type: Empty in form - **WRONG** (should be Corn Silage)

### Root Causes Identified

| Issue | Cause | Location |
|-------|-------|----------|
| **Date not extracted** | `extractFeedData()` doesn't call `extractDateFromText()` unlike milk extractor | `voiceFormExtractors.ts` line 309-341 |
| **47 became 26** | Numbers spelled out as "forty-seven" don't match digit regex patterns | `voiceFormExtractors.ts` line 317-339 |
| **Feed type empty** | Extractor returns feed name ("Corn Silage") but form needs inventory ID | `RecordBulkFeedDialog.tsx` line 355-358 |

---

## Solution Overview

### Fix 1: Add Date Extraction to Feed Extractor

Update `extractFeedData()` to use the existing `extractDateFromText()` function.

### Fix 2: Add Spelled-Out Number Parsing

Create a `parseSpokenNumber()` helper that converts English and Filipino spoken numbers to digits:
- "forty-seven" → 47
- "twenty-six" → 26
- "dalawampu't lima" → 25
- "apatnapu't pito" → 47

### Fix 3: Match Feed Type to Inventory ID

Update the `matchFeedFromInventory()` function to return the inventory **ID** instead of just the name, and update `handleVoiceDataExtracted` to properly set both the ID and handle the matching.

---

## Implementation Details

### File 1: `src/lib/voiceFormExtractors.ts`

#### Add `ExtractedFeedData.recordDate` field

```typescript
export interface ExtractedFeedData {
  totalKg?: number;
  feedType?: string;
  feedInventoryId?: string; // NEW: For matching to inventory
  animalSelection?: string;
  recordDate?: Date;        // NEW: For backdating
  warnings?: string[];
}
```

#### Add Spoken Number Parser

```typescript
// Number word mappings (English + Filipino)
const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
  // Filipino
  isa: 1, dalawa: 2, tatlo: 3, apat: 4, lima: 5, anim: 6, pito: 7, walo: 8, siyam: 9,
  sampu: 10, labing: 10, dalawampu: 20, tatlumpu: 30, apatnapu: 40, limampu: 50,
};

function parseSpokenNumber(text: string): number | undefined {
  // First try to find digits
  const digitMatch = text.match(/\b(\d+(?:\.\d+)?)\b/);
  if (digitMatch) return parseFloat(digitMatch[1]);
  
  // Parse compound spoken numbers: "forty-seven", "forty seven", "apatnapu't pito"
  const lowerText = text.toLowerCase().replace(/['-]/g, ' ');
  let total = 0;
  let current = 0;
  
  const words = lowerText.split(/\s+/);
  for (const word of words) {
    const value = NUMBER_WORDS[word];
    if (value !== undefined) {
      if (value >= 100) {
        current = (current || 1) * value;
      } else if (value >= 10 && value % 10 === 0) {
        current += value;
      } else {
        current += value;
      }
    }
  }
  
  total += current;
  return total > 0 ? total : undefined;
}
```

#### Update `extractFeedData()` to include date and spoken numbers

```typescript
export function extractFeedData(
  transcription: string, 
  context?: ExtractorContext
): ExtractedFeedData {
  const result: ExtractedFeedData = {};
  const lowerText = transcription.toLowerCase();

  // NEW: Extract date (same as milk extractor)
  const extractedDate = extractDateFromText(transcription);
  if (extractedDate) {
    result.recordDate = extractedDate;
  }

  // Extract kilograms - check digit patterns first
  const kgPatterns = [
    /(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilograms?|kilos)/i,
    /(\d+(?:\.\d+)?)\s*(?:na\s+)?(?:kilo|kg)/i,
  ];

  for (const pattern of kgPatterns) {
    const match = transcription.match(pattern);
    if (match) {
      result.totalKg = parseFloat(match[1]);
      break;
    }
  }

  // NEW: If no digit pattern, try spoken numbers
  if (!result.totalKg) {
    // Look for spoken number patterns near kg/kilo keywords
    const spokenPatterns = [
      /(\w+(?:['\-\s]\w+)?)\s*(?:kg|kilo|kilograms?|kilos)/i,
      /(\w+(?:['\-\s]\w+)?)\s*(?:na\s+)?(?:kilo|kg)/i,
    ];
    
    for (const pattern of spokenPatterns) {
      const match = transcription.match(pattern);
      if (match) {
        const parsed = parseSpokenNumber(match[1]);
        if (parsed && parsed >= 0.5 && parsed <= 500) {
          result.totalKg = parsed;
          break;
        }
      }
    }
  }
  
  // Fallback: any number in text
  if (!result.totalKg) {
    const parsed = parseSpokenNumber(transcription);
    if (parsed && parsed >= 0.5 && parsed <= 500) {
      result.totalKg = parsed;
    }
  }

  // ... rest of extractor (feed type matching enhanced below)
}
```

#### Update Feed Type Matching to Return ID

```typescript
function matchFeedFromInventory(keyword: string, inventory: FeedInventoryItem[]): { id: string; name: string } | undefined {
  const keywordLower = keyword.toLowerCase();
  const match = inventory.find(item => 
    item.feed_type.toLowerCase().includes(keywordLower)
  );
  return match ? { id: match.id, name: match.feed_type } : undefined;
}

// In extractFeedData(), update feed type matching:
else if (lowerText.includes('corn') || lowerText.includes('mais') || lowerText.includes('silage')) {
  const matched = matchFeedFromInventory('Corn', feedInventory);
  if (matched) {
    result.feedType = matched.name;
    result.feedInventoryId = matched.id;
  } else {
    result.feedType = 'Corn Silage'; // Fallback name
  }
}
```

---

### File 2: `src/components/feed-recording/RecordBulkFeedDialog.tsx`

#### Update `handleVoiceDataExtracted` to use both ID and Date

```typescript
const handleVoiceDataExtracted = (data: ExtractedFeedData) => {
  if (data.totalKg) setTotalKg(data.totalKg.toString());
  
  // Use feedInventoryId if available, otherwise try to match feedType name
  if (data.feedInventoryId) {
    setFeedType(data.feedInventoryId);
  } else if (data.feedType) {
    // Check if it's the special Fresh Cut option
    if (data.feedType === FRESH_CUT_OPTION) {
      setFeedType(FRESH_CUT_OPTION);
    } else {
      // Try to find matching inventory item by name
      const matchedItem = displayFeedInventory.find(
        f => f.feed_type.toLowerCase().includes(data.feedType!.toLowerCase())
      );
      if (matchedItem) {
        setFeedType(matchedItem.id);
      }
    }
  }
  
  if (data.animalSelection) setSelectedOption(data.animalSelection);
  
  // NEW: Set date if extracted
  if (data.recordDate) {
    setRecordDate(data.recordDate);
  }
};
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/voiceFormExtractors.ts` | Add `recordDate` and `feedInventoryId` to interface, add `parseSpokenNumber()`, update `extractFeedData()` to parse dates and spoken numbers, update `matchFeedFromInventory()` to return ID |
| `src/components/feed-recording/RecordBulkFeedDialog.tsx` | Update `handleVoiceDataExtracted` to handle `feedInventoryId` and `recordDate` |

---

## Example After Fix

**User says**: "Nagpakain tayo kahapon January 26, 2026 ng 47 kilos na corn silage para sa lahat"

**Extracted correctly**:
- Date: January 26, 2026 ✅ (from "kahapon January 26, 2026")
- Total Kilograms: 47 ✅ (from "forty-seven" or "47")
- Feed Type: Corn Silage (ID matched) ✅
- Animals: All ✅ (from "para sa lahat")

---

## Testing Checklist

After implementation:
- [ ] "kahapon" extracts yesterday's date
- [ ] "January 26, 2026" extracts specific date
- [ ] "forty-seven kilos" extracts 47 kg
- [ ] "apatnapu't pitong kilo" extracts 47 kg (Filipino)
- [ ] "corn silage" matches inventory ID correctly
- [ ] Feed type dropdown shows correct selection after voice input
- [ ] Date picker shows correct extracted date
