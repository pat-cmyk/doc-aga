
# Fix: Doc Aga AI Animal Selection Defaulting to G002

## Problem Summary

When users record voice activities mentioning an animal name (e.g., "Tita Bessie"), the system incorrectly matches **G002** (an animal with `name: null`) instead of finding the correct animal or prompting for selection.

## Root Cause Analysis

The bug is in `supabase/functions/process-farmhand-activity/index.ts` at lines 760-765:

```javascript
const animal = animals?.find(a => 
  a.ear_tag?.toLowerCase().includes(identifier) ||
  a.name?.toLowerCase().includes(identifier) ||
  identifier.includes(a.ear_tag?.toLowerCase() || '') ||
  identifier.includes(a.name?.toLowerCase() || '')  // BUG HERE!
);
```

**The Problem:**
When `a.name` is `null`, the expression `a.name?.toLowerCase() || ''` evaluates to an **empty string** (`''`). 

Then `identifier.includes('')` is **always `true`** because every string contains the empty string!

**Example:**
- User says: "Tita Bessie" → `identifier = "tita bessie"`
- Animal G002 has `name: null`
- `"tita bessie".includes('')` → `true` (BUG!)
- G002 is matched incorrectly

## Solution

Replace the loose `includes()` matching with a stricter matching algorithm:

1. **Remove empty string fallback** - Only match when the field actually has a value
2. **Prioritize exact matches** - Score-based matching to prefer better matches
3. **Add minimum length check** - Don't match on very short strings that could cause false positives
4. **Return null if no confident match** - Let the UI prompt for animal selection

## Technical Implementation

### File: `supabase/functions/process-farmhand-activity/index.ts`

**Lines 750-773 - Replace the animal matching logic:**

```typescript
if (!animalId && extractedData.animal_identifier) {
  const identifier = extractedData.animal_identifier.toLowerCase().trim();
  
  // Skip if identifier is too short to be reliable
  if (identifier.length < 2) {
    console.log('Animal identifier too short for reliable matching:', identifier);
  } else {
    // Try to find by ear tag or name with strict matching
    const { data: animals } = await supabase
      .from('animals')
      .select('id, ear_tag, name')
      .eq('farm_id', farmId)
      .eq('is_deleted', false);

    // Score-based matching: prioritize exact matches, then partial matches
    let bestMatch: { animal: any; score: number } | null = null;
    
    for (const animal of animals || []) {
      const earTag = animal.ear_tag?.toLowerCase() || '';
      const name = animal.name?.toLowerCase() || '';
      
      // Skip animals with no identifiable fields
      if (!earTag && !name) continue;
      
      let score = 0;
      
      // Exact match scores highest
      if (earTag === identifier || name === identifier) {
        score = 100;
      }
      // Ear tag is contained in identifier (e.g., "A002 Bessie" contains "A002")
      else if (earTag && identifier.includes(earTag) && earTag.length >= 2) {
        score = 80;
      }
      // Name is contained in identifier (e.g., "Tita Bessie" contains "Bessie")
      else if (name && identifier.includes(name) && name.length >= 2) {
        score = 70;
      }
      // Identifier is contained in ear tag (partial ear tag match)
      else if (earTag && earTag.includes(identifier) && identifier.length >= 2) {
        score = 60;
      }
      // Identifier is contained in name (partial name match)
      else if (name && name.includes(identifier) && identifier.length >= 2) {
        score = 50;
      }
      
      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { animal, score };
      }
    }
    
    if (bestMatch && bestMatch.score >= 50) {
      finalAnimalId = bestMatch.animal.id;
      console.log('Found animal match:', {
        animal: bestMatch.animal,
        score: bestMatch.score,
        searchTerm: identifier
      });
    } else {
      console.log('No confident animal match for identifier:', identifier);
    }
  }
}
```

## Expected Behavior After Fix

| Scenario | Before (Bug) | After (Fixed) |
|----------|-------------|---------------|
| User says "Tita Bessie" | Matches G002 (null name) | Matches A002 (Bessie) with score 70 |
| User says "Bessie" | Matches G002 (null name) | Matches A002 (Bessie) with score 100 |
| User says "A002" | May match incorrectly | Matches A002 with score 100 |
| User says "unknown animal" | Matches G002 (null name) | No match, prompts for selection |
| Animal has no name or ear tag | Could match anything | Skipped in matching |

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/process-farmhand-activity/index.ts` | Replace loose `includes()` matching with score-based strict matching algorithm |

## Testing Scenarios

After implementation, test these voice inputs:

1. **"Nagpakain ako kay Bessie ng 2 kilos"** → Should match animal with name "Bessie" (A002)
2. **"Feeding A002 with 5 bales"** → Should match ear tag A002
3. **"Gatas ng G001"** → Should match ear tag G001 (Tsibato)
4. **"Nagpakain kay unknown animal"** → Should NOT match, prompt for selection
5. **"Nagpakain kay Tita Bessie"** → Should match "Bessie" (A002), not G002

## Additional Improvements (Optional)

Consider also adding:
1. **Levenshtein distance matching** for typos/transcription errors (import from existing `src/lib/fuzzyMatch.ts`)
2. **Logging of all match attempts** for easier debugging
3. **Confidence threshold configuration** per farm
