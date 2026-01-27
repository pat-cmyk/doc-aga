

# Enhance Tagalog/Taglish Language Support

## Overview

This plan enhances the app's Tagalog/Taglish language understanding by:
1. Adding comprehensive discourse markers and particles to `stt-prompts.ts`
2. Adding preprocessing logic in `voiceFormExtractors.ts` to handle particles
3. Creating a dedicated `TAGLISH_LANGUAGE_GUIDE.md` documentation file

---

## Part 1: Enhanced Discourse Markers in stt-prompts.ts

### New Section: TAGALOG_DISCOURSE_MARKERS

Add a comprehensive section covering all Tagalog discourse particles with their meanings and how they affect context interpretation:

```typescript
export const TAGALOG_DISCOURSE_MARKERS = `
=== TAGALOG DISCOURSE MARKERS & PARTICLES ===

CRITICAL: These particles affect meaning and should be PRESERVED in transcription
but may be STRIPPED during extraction depending on context.

=== EPISTEMIC/EVIDENTIAL MARKERS (Knowledge & Certainty) ===
- "pala" = realization/correction ("so it turns out", "I just realized")
  Example: "Ay pala, kahapon yung feeding" → "Oh wait, the feeding was yesterday"
  EXTRACTION IMPACT: May indicate a CORRECTION to previous statement

- "talaga" = emphasis/certainty ("really", "truly", "definitely")
  Example: "Talaga bang 50 liters?" → "Is it really 50 liters?"
  EXTRACTION IMPACT: Strengthens confidence in the number

- "daw/raw" = hearsay/reported speech ("they said", "apparently")
  Example: "30 kilos daw ang feed" → "They said the feed is 30 kilos"
  EXTRACTION IMPACT: May indicate secondhand information

- "yata" = uncertainty ("I think", "probably", "maybe")
  Example: "20 liters yata" → "I think it's 20 liters"
  EXTRACTION IMPACT: Lower confidence in extracted value

=== TEMPORAL MARKERS (Time & Sequence) ===
- "muna" = priority/first ("first", "for now")
  Example: "I-record muna ang milk" → "Record the milk first"
  EXTRACTION IMPACT: Indicates task prioritization

- "na" = already/now (completion or urging)
  Example: "Nag-feed na" → "Already fed" / "Fed now"
  EXTRACTION IMPACT: Confirms action is COMPLETED

- "pa" = still/yet (ongoing or addition)
  Example: "Nag-milk pa" → "Still milking" / "Milked more"
  EXTRACTION IMPACT: May indicate ADDITIONAL quantity

- "ulit" = again/repeat
  Example: "Pakibasa ulit" → "Please read again"
  EXTRACTION IMPACT: User wants repetition

- "agad" = immediately/right away
  Example: "Nag-inject agad" → "Injected immediately"
  EXTRACTION IMPACT: Indicates urgency

=== ADDITIVE/CONTRASTIVE MARKERS ===
- "din/rin" = also/too
  Example: "Yung kambing din" → "The goat too"
  EXTRACTION IMPACT: Indicates ADDITIONAL animals/items

- "lang" = only/just (limiter)
  Example: "10 liters lang" → "Only 10 liters"
  EXTRACTION IMPACT: Confirms exact amount, no more

- "naman" = on the other hand / for one's part / also
  Example: "Okay naman ang baka" → "The cow is fine though"
  EXTRACTION IMPACT: Often filler, may indicate contrast

- "kaya" = perhaps/that's why/can
  Example: "Kaya mababa ang milk" → "That's why the milk is low"
  EXTRACTION IMPACT: Indicates reasoning/cause

=== POLITENESS & RESPECT MARKERS ===
- "po/opo" = polite/respect markers
  Example: "30 liters po" → "30 liters (respectful)"
  EXTRACTION IMPACT: STRIP during extraction, doesn't affect data

- "ho" = informal polite marker
  Example: "Opo ho" → "Yes (polite)"
  EXTRACTION IMPACT: STRIP during extraction

=== QUESTION & FILLER PARTICLES ===
- "ba" = question marker
  Example: "Okay ba ang record?" → "Is the record okay?"
  EXTRACTION IMPACT: Indicates question, not statement

- "eh" = filler/hesitation
  Example: "Eh, mga 20 kilos" → "Uh, about 20 kilos"
  EXTRACTION IMPACT: STRIP during extraction

- "kasi" = because/you see
  Example: "Kasi maulan" → "Because it's rainy"
  EXTRACTION IMPACT: Indicates reason/explanation

=== APPROXIMATION MARKERS ===
- "mga" = approximately ("around", "about")
  Example: "Mga 40 liters" → "Around 40 liters"
  EXTRACTION IMPACT: Value is APPROXIMATE, not exact

- "halos" = almost/nearly
  Example: "Halos 50 liters" → "Almost 50 liters"
  EXTRACTION IMPACT: Value is slightly LESS than stated

- "mahigit" = more than/over
  Example: "Mahigit 30 kilos" → "Over 30 kilos"
  EXTRACTION IMPACT: Value is AT LEAST the stated amount
`.trim();
```

### Update TAGLISH_PATTERNS

Expand the existing section with more verb patterns and compound markers:

```typescript
export const TAGLISH_PATTERNS = `
=== TAGLISH (Tagalog-English Code-Switching) PATTERNS ===

VERB PATTERNS (Tagalog prefix + English verb):
- nag-feed, nag-milk, nag-gatas, nag-weigh
- nag-inject, nag-check, nag-confirm, nag-record
- nag-calve, nanganak, nag-dry off
- nag-heat, nag-init, nag-AI
- naka-schedule, na-check, na-confirm, na-record
- mag-save, mag-submit, mag-cancel

MARKER WORD COMBINATIONS (often appear together):
- "na po" = already (polite)
- "pa po" = still/more (polite)
- "din po" = also (polite)
- "lang po" = only (polite)
- "daw po" = they said (polite hearsay)

COMMON SENTENCE STARTERS:
- "Nag-[verb] ako..." = I [verb]ed...
- "Yung [noun]..." = The [noun]...
- "Meron [noun]..." = There is [noun]...
- "Gusto ko [verb]..." = I want to [verb]...
- "Pwede ba..." = Can I/we...
- "Paano ba..." = How do I...

CONFIRMATION PATTERNS:
- "Oo" / "Opo" / "Oo nga" = Yes
- "Hindi" / "Hindi po" = No
- "Sige" / "Sige po" = Okay/Go ahead
- "Tama" / "Tama po" = Correct
- "Mali" = Wrong/Incorrect

POLITE FORMS:
- "po", "opo" = respect markers (STRIP during extraction)
- "Gusto ko po..." = I would like... (polite)
- "Patulong po..." = Please help... (polite)
`.trim();
```

---

## Part 2: Preprocessing Logic in voiceFormExtractors.ts

### New Helper Functions

Add preprocessing functions to normalize Tagalog particles before extraction:

```typescript
// ==================== TAGALOG PARTICLE PREPROCESSING ====================

/**
 * Particles that should be STRIPPED during data extraction (don't affect values)
 */
const NOISE_PARTICLES = ['po', 'opo', 'ho', 'eh', 'ah', 'ay'];

/**
 * Particles that indicate APPROXIMATION (lower confidence)
 */
const APPROXIMATION_MARKERS = ['mga', 'halos', 'parang', 'siguro', 'yata'];

/**
 * Particles that indicate EMPHASIS (higher confidence)
 */
const EMPHASIS_MARKERS = ['talaga', 'mismo', 'exactly', 'talagang'];

/**
 * Particles that indicate ADDITION (may mean multiple items/quantities)
 */
const ADDITION_MARKERS = ['din', 'rin', 'pa', 'pati', 'kasama'];

/**
 * Particles that indicate CORRECTION (previous statement may be wrong)
 */
const CORRECTION_MARKERS = ['pala', 'ay', 'este', 'ay pala'];

/**
 * Particles that indicate COMPLETION (action already done)
 */
const COMPLETION_MARKERS = ['na', 'tapos na', 'done na', 'finish na'];

/**
 * Preprocess transcription by analyzing Tagalog particles
 * Returns the cleaned text and context flags
 */
export function preprocessTagalogParticles(text: string): {
  cleanedText: string;
  isApproximate: boolean;
  isEmphatic: boolean;
  hasAddition: boolean;
  hasCorrection: boolean;
  isCompleted: boolean;
  confidence: 'high' | 'medium' | 'low';
} {
  const lowerText = text.toLowerCase();
  let cleanedText = text;
  
  // Strip noise particles
  for (const particle of NOISE_PARTICLES) {
    cleanedText = cleanedText.replace(new RegExp(`\\b${particle}\\b`, 'gi'), '');
  }
  
  // Detect context markers
  const isApproximate = APPROXIMATION_MARKERS.some(p => lowerText.includes(p));
  const isEmphatic = EMPHASIS_MARKERS.some(p => lowerText.includes(p));
  const hasAddition = ADDITION_MARKERS.some(p => 
    new RegExp(`\\b${p}\\b`).test(lowerText)
  );
  const hasCorrection = CORRECTION_MARKERS.some(p => lowerText.includes(p));
  const isCompleted = COMPLETION_MARKERS.some(p => lowerText.includes(p));
  
  // Determine confidence based on markers
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (isEmphatic) confidence = 'high';
  if (isApproximate || hasCorrection) confidence = 'low';
  
  return {
    cleanedText: cleanedText.replace(/\s+/g, ' ').trim(),
    isApproximate,
    isEmphatic,
    hasAddition,
    hasCorrection,
    isCompleted,
    confidence
  };
}
```

### Update extractMilkData and extractFeedData

Integrate particle preprocessing into existing extractors:

```typescript
export function extractMilkData(
  transcription: string,
  context?: ExtractorContext
): ExtractedMilkData {
  // Preprocess Tagalog particles
  const particleInfo = preprocessTagalogParticles(transcription);
  
  const result: ExtractedMilkData = {
    rawTranscription: transcription,
  };
  
  // Use cleaned text for extraction
  const cleanedText = particleInfo.cleanedText;
  const lowerText = cleanedText.toLowerCase();

  // ... rest of extraction logic using cleanedText ...
  
  // Add warning if approximate
  if (particleInfo.isApproximate && result.totalLiters) {
    result.warnings = result.warnings || [];
    result.warnings.push(`Value is approximate ("mga/halos"). Actual: ~${result.totalLiters}L`);
  }
  
  // Add warning if correction detected
  if (particleInfo.hasCorrection) {
    result.warnings = result.warnings || [];
    result.warnings.push('Correction detected ("pala"). Please verify the values.');
  }

  return result;
}
```

---

## Part 3: TAGLISH_LANGUAGE_GUIDE.md Documentation

Create a comprehensive reference document at the project root:

```markdown
# Taglish Language Guide for Golden Forage

This guide documents all Tagalog/Taglish linguistic elements used in the Golden Forage 
voice interface. It serves as a reference for developers and the AI system to correctly 
interpret Filipino farmer voice input.

## Overview

**Taglish** = Tagalog + English code-switching, commonly used by Filipino farmers.
The app must handle:
- Pure Tagalog utterances
- Pure English utterances
- Mixed Taglish (most common in practice)

## 1. Discourse Particles

### Epistemic Markers (Knowledge/Certainty)

| Particle | Meaning | Impact on Extraction | Example |
|----------|---------|---------------------|---------|
| pala | realization/correction | Indicates correction | "Ay pala, 30 liters" → Value may correct previous |
| talaga | emphasis/certainty | High confidence | "Talaga 50 liters" → Confident in value |
| daw/raw | hearsay | Medium confidence | "30 kilos daw" → Reported, not witnessed |
| yata | uncertainty | Low confidence | "20 liters yata" → Uncertain value |

### Temporal Markers

| Particle | Meaning | Impact | Example |
|----------|---------|--------|---------|
| muna | first/priority | Task order | "Record muna" → Do this first |
| na | already/now | Completed | "Nag-feed na" → Already fed |
| pa | still/more | Ongoing/additional | "Mag-milk pa" → Will milk more |
| ulit | again | Repetition | "Ulit po" → Repeat please |
| agad | immediately | Urgency | "Nag-inject agad" → Immediate action |

### Approximation Markers

| Particle | Meaning | Impact | Example |
|----------|---------|--------|---------|
| mga | approximately | Value ±10% | "Mga 40L" → About 40L |
| halos | almost | Slightly less | "Halos 50kg" → ~48-49kg |
| mahigit | more than | At least | "Mahigit 30" → 30+ |

### Additive/Contrastive

| Particle | Meaning | Impact | Example |
|----------|---------|--------|---------|
| din/rin | also/too | Multiple items | "Kambing din" → Goat also |
| lang | only/just | Exact limit | "10L lang" → Exactly 10L |
| naman | though/also | Contrast/filler | Often skip in extraction |

### Noise Particles (Safe to Strip)

| Particle | Usage | Action |
|----------|-------|--------|
| po/opo | Politeness | Strip during extraction |
| ho | Informal polite | Strip during extraction |
| eh | Filler/hesitation | Strip during extraction |
| ah | Filler | Strip during extraction |

## 2. Taglish Verb Patterns

Filipino farmers often use Tagalog verb affixes with English root words:

### nag- prefix (completed action)
- nag-feed, nag-milk, nag-weigh, nag-inject, nag-check, nag-record

### mag- prefix (will do / doing)
- mag-feed, mag-milk, mag-weigh, mag-save, mag-submit

### na- prefix (passive/completed)
- na-record, na-check, na-confirm, na-save

### naka- prefix (able to / in state of)
- naka-schedule, naka-record

## 3. Common Sentence Patterns

### Activity Recording
- "Nag-feed ako ng [amount] [unit]" → I fed [amount] [unit]
- "Nag-milk ako ng [amount] liters" → I milked [amount] liters
- "Yung [animal] ay nag-produce ng [amount]" → The [animal] produced [amount]

### Date References
- "kahapon" → yesterday
- "kanina" → earlier today
- "ngayon" → now/today
- "kamakalawa" → day before yesterday
- "noong [day]" → last [day]

### Questions
- "Ano ba ang...?" → What is...?
- "Magkano na...?" → How much is...?
- "Kelan ba ang...?" → When is...?
- "Pwede ba...?" → Can I/we...?

## 4. Agricultural Terms (Filipino)

### Livestock
| English | Tagalog |
|---------|---------|
| Cattle/Cow | baka, mga baka |
| Calf | guya, batang baka |
| Carabao | kalabaw |
| Goat | kambing |

### Activities
| English | Tagalog/Taglish |
|---------|-----------------|
| Feeding | pagpapakain, nag-feed |
| Milking | paggatas, nag-milk |
| Weighing | pagtimbang, nag-weigh |

### Units
| English | Tagalog |
|---------|---------|
| Liters | litro |
| Kilograms | kilo |
| Bales | bigkis |
| Bags/Sacks | sako, supot |

## 5. Implementation Notes

### Preprocessing Order
1. Strip noise particles (po, opo, eh, ah)
2. Detect approximation markers (mga, halos)
3. Detect emphasis markers (talaga)
4. Detect correction markers (pala)
5. Extract data from cleaned text
6. Apply confidence based on markers

### Confidence Scoring
- **High**: Contains "talaga", "mismo", or no uncertainty markers
- **Medium**: Default, no special markers
- **Low**: Contains "mga", "halos", "yata", "pala"

## 6. Files Reference

| File | Purpose |
|------|---------|
| `supabase/functions/_shared/stt-prompts.ts` | SSOT for STT prompts and glossaries |
| `src/lib/voiceFormExtractors.ts` | Extraction logic with preprocessing |
| `TAGLISH_LANGUAGE_GUIDE.md` | This documentation |

---

*Last updated: January 2026*
```

---

## Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| `supabase/functions/_shared/stt-prompts.ts` | Modify | Add `TAGALOG_DISCOURSE_MARKERS` export, expand `TAGLISH_PATTERNS` |
| `src/lib/voiceFormExtractors.ts` | Modify | Add `preprocessTagalogParticles()` helper, integrate into extractors |
| `TAGLISH_LANGUAGE_GUIDE.md` | Create | New comprehensive documentation file |

---

## Testing After Implementation

Voice inputs to test:

| Input | Expected Behavior |
|-------|-------------------|
| "Mga 40 liters po" | Extracts 40L, adds "approximate" warning |
| "50 kilos talaga" | Extracts 50kg, high confidence |
| "Ay pala, kahapon yung feeding" | Extracts yesterday's date, adds correction warning |
| "10 liters lang po" | Extracts exactly 10L, strips "po" |
| "Nag-feed din ng kambing" | Detects "din" for addition, animal=goat |

