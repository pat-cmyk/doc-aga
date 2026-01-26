

# Enable ElevenLabs Scribe v2 & Fix Gemini Hallucination

## Overview

This plan implements two critical changes:
1. **Enable ElevenLabs Scribe v2** as the primary STT by adding `useRealtime={true}` to VoiceInterface components
2. **Fix Gemini hallucination** by updating the `TRANSCRIPTION_SYSTEM_PROMPT` to be stricter and prevent content invention

---

## Changes

### 1. Enable Realtime STT in DocAga.tsx

**File:** `src/components/DocAga.tsx`  
**Lines:** 579-587

**Current:**
```typescript
<VoiceInterface 
  onTranscription={(text) => {
    setIsVoiceInput(true);
    handleSendMessage(text);
  }} 
  disabled={isUploadingImage || loading}
  compact={false}
  className="border-t-0"
/>
```

**Updated:**
```typescript
<VoiceInterface 
  onTranscription={(text) => {
    setIsVoiceInput(true);
    handleSendMessage(text);
  }} 
  disabled={isUploadingImage || loading}
  compact={false}
  className="border-t-0"
  useRealtime={true}
  enableCorrection={true}
/>
```

---

### 2. Enable Realtime STT in DocAgaConsultation.tsx

**File:** `src/components/farmhand/DocAgaConsultation.tsx`  
**Lines:** 346-352

**Current:**
```typescript
<VoiceInterface
  onTranscription={(text) => {
    setIsVoiceInput(true);
    handleSendMessage(text);
  }} 
  disabled={isUploadingImage || loading}
/>
```

**Updated:**
```typescript
<VoiceInterface
  onTranscription={(text) => {
    setIsVoiceInput(true);
    handleSendMessage(text);
  }} 
  disabled={isUploadingImage || loading}
  useRealtime={true}
  enableCorrection={true}
/>
```

---

### 3. Fix Gemini Hallucination in STT Prompts

**File:** `supabase/functions/_shared/stt-prompts.ts`  
**Lines:** 164-183

**Current:**
```typescript
export const TRANSCRIPTION_SYSTEM_PROMPT = `
You are an expert audio transcription assistant specialized in Filipino agricultural and veterinary contexts. Your task is to accurately transcribe audio from Filipino farmers who frequently use Taglish (Tagalog-English code-switching).

=== TRANSCRIPTION GUIDELINES ===
1. Transcribe EXACTLY what is spoken - preserve Taglish naturally
2. Use correct spelling for technical terms (veterinary, dairy, farming)
3. Numbers should be transcribed as digits (e.g., "10 liters" not "ten liters")
4. Preserve Filipino particles like "po", "opo", "naman", "kasi", "yung"
5. Keep English words that are naturally mixed in (common in Filipino farm speech)

${NUMBER_DISAMBIGUATION_RULES}

${AGRICULTURAL_GLOSSARY}

${TAGLISH_PATTERNS}

Output ONLY the transcription text, nothing else.
`.trim();
```

**Updated:**
```typescript
export const TRANSCRIPTION_SYSTEM_PROMPT = `
You are an audio transcription assistant. Your ONLY task is to transcribe the exact words spoken in the audio.

=== CRITICAL RULES - READ CAREFULLY ===
1. Transcribe ONLY the actual spoken words - NEVER invent or add content
2. If audio is unclear, silent, or too short, respond with EXACTLY: [UNCLEAR_AUDIO]
3. If you cannot understand a specific word, use [INAUDIBLE] as a placeholder
4. NEVER generate plausible-sounding content to fill gaps - this is STRICTLY FORBIDDEN
5. Accuracy is more important than completeness - gaps are better than fabrications
6. DO NOT assume what the speaker "probably meant" - transcribe only what you hear

=== OUTPUT FORMAT ===
- Clear audio: Output transcription text only
- Partially unclear: Include [INAUDIBLE] markers where words are unclear
- Completely unclear/silent: Respond with only: [UNCLEAR_AUDIO]

=== FORMATTING RULES ===
1. Numbers: Use digits (23, not twenty-three)
2. Preserve Filipino particles: po, opo, naman, kasi, yung
3. Keep Taglish code-switching natural (mixing Filipino and English)

=== CONTEXT FOR SPELLING ONLY (NOT for content generation) ===
The speaker may use terms like:
- Measurements: litro/liters, kilo/kg, bales, bags
- Time: umaga=morning, hapon=afternoon, gabi=evening
- Dates: January, kahapon=yesterday, ngayon=today

IMPORTANT: Use this context ONLY for proper spelling. 
DO NOT use it to invent content that was not spoken.

${NUMBER_DISAMBIGUATION_RULES}

Output ONLY what you hear. Nothing more.
`.trim();
```

---

## Summary of Changes

| File | Line(s) | Change |
|------|---------|--------|
| `src/components/DocAga.tsx` | 579-587 | Add `useRealtime={true}` and `enableCorrection={true}` |
| `src/components/farmhand/DocAgaConsultation.tsx` | 346-352 | Add `useRealtime={true}` and `enableCorrection={true}` |
| `supabase/functions/_shared/stt-prompts.ts` | 164-183 | Replace prompt with stricter anti-hallucination version |

---

## Expected Behavior After Changes

### ElevenLabs Scribe v2 Enabled
- Doc Aga voice input will use ElevenLabs Scribe v2 (realtime) as primary STT
- Users will see live partial transcripts as they speak
- Latency reduced from ~20 seconds to <500ms
- "Edit" button available for transcription corrections

### Gemini Fallback Protected
- When ElevenLabs is unavailable, Gemini fallback will use stricter prompt
- Model will output `[UNCLEAR_AUDIO]` instead of inventing content
- No more fictional farm reports from short/unclear audio
- Clear error messages guide users to re-record

