# Taglish Language Guide for Golden Forage

This guide documents all Tagalog/Taglish linguistic elements used in the Golden Forage voice interface. It serves as a reference for developers and the AI system to correctly interpret Filipino farmer voice input.

## Overview

**Taglish** = Tagalog + English code-switching, commonly used by Filipino farmers.

The app must handle:
- Pure Tagalog utterances
- Pure English utterances
- Mixed Taglish (most common in practice)

---

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
| parang | like/seems | Approximate | "Parang 20 liters" → Seems like 20L |
| siguro | probably | Uncertain | "Siguro 15 kilos" → Probably 15kg |

### Additive/Contrastive

| Particle | Meaning | Impact | Example |
|----------|---------|--------|---------|
| din/rin | also/too | Multiple items | "Kambing din" → Goat also |
| lang | only/just | Exact limit | "10L lang" → Exactly 10L |
| naman | though/also | Contrast/filler | Often skip in extraction |
| pati | including/also | Additional | "Pati yung guya" → Including the calf |
| kasama | together with | Additional | "Kasama ang isa pa" → Together with another |

### Noise Particles (Safe to Strip)

| Particle | Usage | Action |
|----------|-------|--------|
| po/opo | Politeness | Strip during extraction |
| ho | Informal polite | Strip during extraction |
| eh | Filler/hesitation | Strip during extraction |
| ah | Filler | Strip during extraction |
| ay | Exclamation/filler | Strip during extraction |

---

## 2. Taglish Verb Patterns

Filipino farmers often use Tagalog verb affixes with English root words:

### nag- prefix (completed action)
```
nag-feed, nag-milk, nag-weigh, nag-inject, nag-check, nag-record
```

### mag- prefix (will do / doing)
```
mag-feed, mag-milk, mag-weigh, mag-save, mag-submit, mag-cancel
```

### na- prefix (passive/completed)
```
na-record, na-check, na-confirm, na-save
```

### naka- prefix (able to / in state of)
```
naka-schedule, naka-record
```

### i- prefix (imperative/put)
```
i-record, i-save, i-submit, i-check
```

---

## 3. Common Sentence Patterns

### Activity Recording
- `"Nag-feed ako ng [amount] [unit]"` → I fed [amount] [unit]
- `"Nag-milk ako ng [amount] liters"` → I milked [amount] liters
- `"Yung [animal] ay nag-produce ng [amount]"` → The [animal] produced [amount]
- `"Binigyan ko ng [amount] [feed]"` → I gave [amount] [feed]

### Date References
| Tagalog | English |
|---------|---------|
| kahapon | yesterday |
| kanina | earlier today |
| ngayon | now/today |
| kamakalawa | day before yesterday |
| noong [day] | last [day] |
| bukas | tomorrow (FUTURE - reject for records!) |

### Questions
- `"Ano ba ang...?"` → What is...?
- `"Magkano na...?"` → How much is...?
- `"Kelan ba ang...?"` → When is...?
- `"Pwede ba...?"` → Can I/we...?
- `"Paano ba...?"` → How do I...?

### Confirmations
| Affirmative | Negative |
|-------------|----------|
| Oo / Opo / Oo nga | Hindi / Hindi po |
| Sige / Sige po | Ayaw / Ayoko |
| Tama / Tama po | Mali / Mali po |

---

## 4. Agricultural Terms (Filipino)

### Livestock
| English | Tagalog |
|---------|---------|
| Cattle/Cow | baka, mga baka |
| Calf | guya, batang baka |
| Heifer | dumalagang baka, dalaga |
| Carabao/Buffalo | kalabaw |
| Goat | kambing |
| Sheep | tupa |

### Gender
| English | Tagalog |
|---------|---------|
| Male | lalaki, toro (bull) |
| Female | babae, baka (cow) |

### Activities
| English | Tagalog/Taglish |
|---------|-----------------|
| Feeding | pagpapakain, nag-feed |
| Milking | paggatas, nag-milk, nag-gatas |
| Weighing | pagtimbang, nag-weigh |
| Vaccination | pagbabakuna, nag-vaccinate |
| AI (breeding) | nag-AI |
| Calving | nanganak, nag-calve |

### Units
| English | Tagalog |
|---------|---------|
| Liters | litro |
| Kilograms | kilo |
| Bales | bigkis |
| Bags/Sacks | sako, supot |
| Buckets | balde |
| Barrels/Drums | drum, bariles |

### Feed Types
| English | Tagalog |
|---------|---------|
| Rice Bran | darak |
| Rice Straw | dayami |
| Corn | mais |
| Cassava | kamoteng kahoy |
| Molasses | pulot |

---

## 5. Implementation Notes

### Preprocessing Order
1. Strip noise particles (po, opo, eh, ah, ay)
2. Detect approximation markers (mga, halos, parang, siguro, yata)
3. Detect emphasis markers (talaga, mismo)
4. Detect correction markers (pala, este, ay pala)
5. Detect addition markers (din, rin, pa, pati, kasama)
6. Extract data from cleaned text
7. Apply confidence based on markers

### Confidence Scoring

| Confidence | Conditions |
|------------|------------|
| **High** | Contains "talaga", "mismo", or no uncertainty markers |
| **Medium** | Default, no special markers |
| **Low** | Contains "mga", "halos", "yata", "pala", "siguro", "parang" |

### Warning Generation

When particles are detected, add appropriate warnings:

```typescript
// Approximation detected
if (isApproximate && value) {
  warnings.push(`Value is approximate ("mga/halos"). Actual: ~${value}`);
}

// Correction detected
if (hasCorrection) {
  warnings.push('Correction detected ("pala"). Please verify the values.');
}

// Addition detected
if (hasAddition) {
  warnings.push('Addition detected ("din/rin"). Multiple items may be referenced.');
}
```

---

## 6. Files Reference

| File | Purpose |
|------|---------|
| `supabase/functions/_shared/stt-prompts.ts` | SSOT for STT prompts and glossaries |
| `src/lib/voiceFormExtractors.ts` | Extraction logic with Tagalog preprocessing |
| `TAGLISH_LANGUAGE_GUIDE.md` | This documentation |

---

## 7. Testing Examples

| Voice Input | Expected Behavior |
|-------------|-------------------|
| "Mga 40 liters po" | Extracts 40L, adds "approximate" warning, strips "po" |
| "50 kilos talaga" | Extracts 50kg, high confidence |
| "Ay pala, kahapon yung feeding" | Extracts yesterday's date, adds correction warning |
| "10 liters lang po" | Extracts exactly 10L, strips "po" |
| "Nag-feed din ng kambing" | Detects "din" for addition, animal=goat |
| "Halos 30 kilos ng napier" | Extracts ~30kg napier, low confidence |

---

*Last updated: January 2026*
