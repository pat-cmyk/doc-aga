
# Consolidate Taglish SSOT + Add Preprocessing Tests

## Problem Summary

The `process-farmhand-activity` edge function contains ~200 lines of inline Taglish content (lines 530-700) that duplicates definitions already in the SSOT file (`stt-prompts.ts`). This violates the Single Source of Truth principle and creates maintenance risk.

**Current State:**
| File | Status |
|------|--------|
| `stt-prompts.ts` | ✅ SSOT - Contains `AGRICULTURAL_GLOSSARY`, `TAGALOG_DISCOURSE_MARKERS`, `TAGLISH_PATTERNS` |
| `process-farmhand-activity/index.ts` | ❌ Has inline duplicates (lines 530-700) |
| `voiceFormExtractors.ts` | ✅ Uses `preprocessTagalogParticles()` |

---

## Part 1: Consolidate Edge Function to Use SSOT

### File: `supabase/functions/process-farmhand-activity/index.ts`

**Current (Duplicated - Lines 512-701):**
```typescript
content: animalId && animalInfo
  ? `You are an assistant helping farmhands...
     
     **FILIPINO LANGUAGE SUPPORT**:
     You MUST recognize Filipino/Tagalog and Bisaya...
     
     Common Filipino/Tagalog Terms:
     - Feed Types: "dayami"=rice straw...
     [~180 lines of inline content]
```

**After (Using SSOT):**
```typescript
import { 
  getActivityExtractionPrompt,
  AGRICULTURAL_GLOSSARY,
  TAGALOG_DISCOURSE_MARKERS,
  TAGLISH_PATTERNS,
  NUMBER_DISAMBIGUATION_RULES
} from "../_shared/stt-prompts.ts";

// In the AI request:
content: animalId && animalInfo
  ? getActivityExtractionPrompt(animalInfo, animalId)
  : animalId
  ? getActivityExtractionPrompt(undefined, animalId)
  : getActivityExtractionPrompt()
```

### Changes Required

1. **Update imports** (line 6): Add all SSOT exports
2. **Replace inline prompts** (lines 512-701): Use `getActivityExtractionPrompt()` function
3. **Enhance `getActivityExtractionPrompt()`** in `stt-prompts.ts`: Add missing content that exists in the edge function but not in SSOT:
   - Bisaya/Cebuano terms ("gabie", "karon", "ugma")
   - Livestock type detection for milking
   - Feed type vs unit distinction rules
   - Tool call parameters specification

---

## Part 2: Enhance stt-prompts.ts with Missing Content

### File: `supabase/functions/_shared/stt-prompts.ts`

Add missing content to `getActivityExtractionPrompt()` that currently only exists inline:

```typescript
export function getActivityExtractionPrompt(
  animalInfo?: { name?: string; ear_tag?: string }, 
  animalId?: string
): string {
  const animalContext = animalInfo 
    ? `The farmhand is recording an activity for animal: ${animalInfo.name || 'Unknown'} (Ear Tag: ${animalInfo.ear_tag || 'N/A'}, ID: ${animalId}).
       IMPORTANT: The animal is already identified. DO NOT need to extract animal_identifier unless a DIFFERENT animal is mentioned.`
    : animalId
    ? `The farmhand is recording an activity for a SPECIFIC ANIMAL (ID: ${animalId}). The animal is already identified.`
    : 'Extract animal identifier if mentioned (ear tag, name, or description).';

  return `
You are an assistant helping farmhands log their daily activities. Extract structured information from voice transcriptions.

${animalContext}

${AGRICULTURAL_GLOSSARY}

${TAGALOG_DISCOURSE_MARKERS}

${TAGLISH_PATTERNS}

${NUMBER_DISAMBIGUATION_RULES}

**BISAYA/CEBUANO SUPPORT**:
- Time: "gabie"=yesterday, "karon"=now, "ugma"=tomorrow (FUTURE - reject!)
- Activities: "papakaon"=feeding, "pagatas"=milking

**LIVESTOCK TYPE DETECTION FOR MILKING**:
Detect livestock type from milk-related keywords:
- "goat milk"/"gatas ng kambing" → livestock_type: 'goat'
- "cow milk"/"gatas ng baka" → livestock_type: 'cattle'
- "carabao milk"/"gatas ng kalabaw" → livestock_type: 'carabao'
- "sheep milk"/"gatas ng tupa" → livestock_type: 'sheep'
- No type mentioned → livestock_type: null

**CRITICAL - Feed Type vs Unit Distinction**:
FEED_TYPE = WHAT the feed is (material name): "corn silage", "hay", "concentrates"
UNIT = HOW it's measured: "bales", "bags", "barrels", "kg"

EXTRACTION RULES:
1. "5 bales" alone → feed_type: null, unit: "bales", quantity: 5
2. "5 bales of corn silage" → feed_type: "corn silage", unit: "bales", quantity: 5
3. "8 bales of baled corn silage" → feed_type: "baled corn silage", unit: "bales", quantity: 8

**NEVER use the unit name as the feed_type!**

**ACTIVITY TYPES**:
- feeding: Recording feed given to animals (requires quantity, feed_type, unit)
- milking: Recording milk production (requires quantity in liters)
- health_observation: General health checks (requires notes)
- weight_measurement: Recording animal weight (requires quantity in kg)
- injection: Medicine or vaccine administration (requires medicine_name)
- cleaning: General cleaning tasks

**OUTPUT FORMAT** (JSON only):
{
  "activity_type": "feeding" | "milking" | "health_observation" | "weight_measurement" | "injection",
  "quantity": number | null,
  "unit": "bales" | "bags" | "barrels" | "kg" | "liters" | null,
  "feed_type": string | null,
  "livestock_type": "cattle" | "goat" | "carabao" | "sheep" | null,
  "animal_identifier": string | null,
  "date_reference": string | null,
  "notes": string | null,
  "medicine_name": string | null,
  "dosage": string | null,
  "session": "AM" | "PM" | null
}
`.trim();
}
```

---

## Part 3: Add Tagalog Preprocessing Unit Tests

### File: `src/__tests__/lib/tagalogPreprocessing.test.ts` (NEW)

Create comprehensive tests for `preprocessTagalogParticles()`:

```typescript
import { describe, it, expect } from 'vitest';
import { 
  preprocessTagalogParticles, 
  type TagalogParticleInfo 
} from '@/lib/voiceFormExtractors';

describe('preprocessTagalogParticles', () => {
  
  describe('Noise Particle Stripping', () => {
    it('strips "po" polite markers', () => {
      const result = preprocessTagalogParticles('30 liters po');
      expect(result.cleanedText).toBe('30 liters');
    });
    
    it('strips "opo" polite markers', () => {
      const result = preprocessTagalogParticles('Oo opo nagfeed na');
      expect(result.cleanedText).not.toContain('opo');
    });
    
    it('strips "eh" filler', () => {
      const result = preprocessTagalogParticles('Eh mga 20 kilos');
      expect(result.cleanedText).not.toContain('Eh');
    });
    
    it('strips multiple noise particles', () => {
      const result = preprocessTagalogParticles('50 liters po eh');
      expect(result.cleanedText).toBe('50 liters');
    });
  });
  
  describe('Approximation Detection', () => {
    it('detects "mga" as approximate', () => {
      const result = preprocessTagalogParticles('Mga 40 liters');
      expect(result.isApproximate).toBe(true);
      expect(result.particleConfidence).toBe('low');
    });
    
    it('detects "halos" as approximate', () => {
      const result = preprocessTagalogParticles('Halos 50 kilos');
      expect(result.isApproximate).toBe(true);
    });
    
    it('detects "yata" as uncertain', () => {
      const result = preprocessTagalogParticles('20 liters yata');
      expect(result.isApproximate).toBe(true);
      expect(result.particleConfidence).toBe('low');
    });
  });
  
  describe('Emphasis Detection', () => {
    it('detects "talaga" as emphatic', () => {
      const result = preprocessTagalogParticles('50 kilos talaga');
      expect(result.isEmphatic).toBe(true);
      expect(result.particleConfidence).toBe('high');
    });
    
    it('detects "mismo" as emphatic', () => {
      const result = preprocessTagalogParticles('100 liters mismo');
      expect(result.isEmphatic).toBe(true);
    });
  });
  
  describe('Correction Detection', () => {
    it('detects "pala" as correction', () => {
      const result = preprocessTagalogParticles('Ay pala kahapon yung feeding');
      expect(result.hasCorrection).toBe(true);
      expect(result.particleConfidence).toBe('low');
    });
    
    it('detects "ay pala" compound', () => {
      const result = preprocessTagalogParticles('Ay pala 30 liters');
      expect(result.hasCorrection).toBe(true);
    });
  });
  
  describe('Addition Detection', () => {
    it('detects "din" as addition', () => {
      const result = preprocessTagalogParticles('Yung kambing din');
      expect(result.hasAddition).toBe(true);
    });
    
    it('detects "rin" as addition', () => {
      const result = preprocessTagalogParticles('Yung baka rin');
      expect(result.hasAddition).toBe(true);
    });
    
    it('detects "pa" as addition', () => {
      const result = preprocessTagalogParticles('Nagmilk pa ako');
      expect(result.hasAddition).toBe(true);
    });
  });
  
  describe('Completion Detection', () => {
    it('detects "tapos na" as completed', () => {
      const result = preprocessTagalogParticles('Feeding tapos na');
      expect(result.isCompleted).toBe(true);
    });
    
    it('detects "done na" as completed', () => {
      const result = preprocessTagalogParticles('Milking done na');
      expect(result.isCompleted).toBe(true);
    });
  });
  
  describe('Confidence Scoring', () => {
    it('returns medium confidence by default', () => {
      const result = preprocessTagalogParticles('40 liters');
      expect(result.particleConfidence).toBe('medium');
    });
    
    it('returns high confidence with emphasis', () => {
      const result = preprocessTagalogParticles('40 liters talaga');
      expect(result.particleConfidence).toBe('high');
    });
    
    it('returns low confidence with approximation', () => {
      const result = preprocessTagalogParticles('mga 40 liters');
      expect(result.particleConfidence).toBe('low');
    });
    
    it('approximation overrides emphasis for confidence', () => {
      const result = preprocessTagalogParticles('mga 40 liters talaga');
      expect(result.particleConfidence).toBe('low');
    });
  });
  
  describe('Edge Cases', () => {
    it('handles empty string', () => {
      const result = preprocessTagalogParticles('');
      expect(result.cleanedText).toBe('');
    });
    
    it('handles string with only noise particles', () => {
      const result = preprocessTagalogParticles('po opo eh');
      expect(result.cleanedText).toBe('');
    });
    
    it('normalizes multiple spaces', () => {
      const result = preprocessTagalogParticles('40  liters   po');
      expect(result.cleanedText).toBe('40 liters');
    });
    
    it('preserves case for non-particles', () => {
      const result = preprocessTagalogParticles('Rumsol Feeds po');
      expect(result.cleanedText).toBe('Rumsol Feeds');
    });
  });
  
  describe('Real-World Scenarios', () => {
    it('processes "Mga 40 liters po ng gatas"', () => {
      const result = preprocessTagalogParticles('Mga 40 liters po ng gatas');
      expect(result.cleanedText).toBe('Mga 40 liters ng gatas');
      expect(result.isApproximate).toBe(true);
    });
    
    it('processes "Ay pala, kahapon yung feeding"', () => {
      const result = preprocessTagalogParticles('Ay pala, kahapon yung feeding');
      expect(result.hasCorrection).toBe(true);
    });
    
    it('processes "10 liters lang po"', () => {
      const result = preprocessTagalogParticles('10 liters lang po');
      expect(result.cleanedText).toBe('10 liters lang');
    });
  });
});
```

---

## Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| `supabase/functions/_shared/stt-prompts.ts` | Modify | Enhance `getActivityExtractionPrompt()` with missing Bisaya terms, livestock detection, feed type rules |
| `supabase/functions/process-farmhand-activity/index.ts` | Modify | Replace inline prompts (lines 512-701) with SSOT imports |
| `src/__tests__/lib/tagalogPreprocessing.test.ts` | Create | Unit tests for `preprocessTagalogParticles()` |

---

## SSOT Verification After Implementation

After changes, all Taglish content will flow from **one source**:

```text
stt-prompts.ts (SSOT)
├── AGRICULTURAL_GLOSSARY
├── TAGALOG_DISCOURSE_MARKERS  
├── TAGLISH_PATTERNS
├── NUMBER_DISAMBIGUATION_RULES
└── getActivityExtractionPrompt()
    │
    ├──> process-farmhand-activity (imports SSOT)
    ├──> process-animal-voice (imports SSOT)  
    └──> voice-to-text (imports SSOT)

voiceFormExtractors.ts (Client-side)
└── preprocessTagalogParticles()
    │
    └──> extractMilkData(), extractFeedData()
```

---

## Testing After Implementation

| Test | Expected Result |
|------|-----------------|
| Run `tagalogPreprocessing.test.ts` | All particle tests pass |
| Test voice: "Mga 40 liters po" | Approximate warning shown |
| Test voice: "50 kilos talaga" | High confidence extraction |
| Test voice: "Ay pala kahapon" | Correction warning shown |
| Edge function logs | SSOT imports used, no inline content |
