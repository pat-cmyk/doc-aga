

# STT Infrastructure Assessment & Optimization Plan

## Executive Summary

This assessment analyzes the current Speech-to-Text (STT) infrastructure, identifying strengths, weaknesses, and viable alternatives to improve accuracy—particularly for the Taglish (Tagalog-English) use case common among Filipino farmers.

---

## Current Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                       VOICE INPUT COMPONENTS                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐   ┌─────────────────┐   ┌──────────────────────┐  │
│  │ VoiceInputButton│   │  VoiceInterface │   │   VoiceFormInput     │  │
│  │ (Simple append) │   │ (Doc Aga chat)  │   │ (Structured extract) │  │
│  └────────┬────────┘   └────────┬────────┘   └──────────┬───────────┘  │
│           │                     │                       │               │
│           └─────────────────────┼───────────────────────┘               │
│                                 ▼                                       │
│                    ┌────────────────────────┐                           │
│                    │   voice-to-text        │                           │
│                    │   Edge Function        │                           │
│                    │   (Gemini 3 Pro)       │                           │
│                    └────────────┬───────────┘                           │
│                                 ▼                                       │
│           ┌─────────────────────┼─────────────────────┐                 │
│           ▼                     ▼                     ▼                 │
│  ┌────────────────┐   ┌────────────────┐   ┌─────────────────────┐     │
│  │process-animal- │   │process-farmhand│   │  voiceFormExtractors│     │
│  │voice (register)│   │-activity       │   │  (client-side)      │     │
│  └────────────────┘   └────────────────┘   └─────────────────────┘     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Inventory

| Component | Purpose | Location |
|-----------|---------|----------|
| **VoiceInputButton** | Simple voice-to-text append to text fields | `src/components/ui/voice-input-button.tsx` |
| **VoiceInterface** | Doc Aga voice chat interface | `src/components/VoiceInterface.tsx` |
| **VoiceFormInput** | Structured data extraction with offline queue | `src/components/ui/VoiceFormInput.tsx` |
| **voice-to-text** | Core STT edge function (Gemini 3 Pro) | `supabase/functions/voice-to-text/` |
| **process-animal-voice** | Animal registration extraction | `supabase/functions/process-animal-voice/` |
| **process-farmhand-activity** | Farm activity parsing | `supabase/functions/process-farmhand-activity/` |
| **voiceFormExtractors** | Client-side data extraction (SSOT) | `src/lib/voiceFormExtractors.ts` |
| **text-to-speech** | ElevenLabs TTS for Doc Aga | `supabase/functions/text-to-speech/` |
| **VoiceTrainingSession** | User voice sample collection | `src/components/voice-training/` |

---

## Current Performance Metrics (Last 30 Days)

| Metric | Value | Assessment |
|--------|-------|------------|
| **Total Transcriptions** | 53 | Low volume (good for testing) |
| **Success Rate** | 92.5% (49/53) | Good |
| **Error Rate** | 7.5% (4/53) | Acceptable |
| **Avg Latency** | 20,241 ms (~20s) | POOR - needs improvement |
| **Avg Audio Size** | 157 KB | Normal |
| **Avg Transcription Length** | 364 chars | Normal |
| **User Corrections** | 0 | No feedback data collected |

**Error Breakdown:**
- 402 Payment Required: 3 (75%) - credits exhausted
- JSON Parse Error: 1 (25%) - edge case

---

## SSOT Analysis

### Current SSOT Compliance

| Area | Status | Notes |
|------|--------|-------|
| **Transcription Logic** | ✅ Single function | `voice-to-text` edge function is sole transcription endpoint |
| **Extraction Logic** | ⚠️ Partial | `voiceFormExtractors.ts` is SSOT for client-side, but server-side functions duplicate patterns |
| **Analytics** | ✅ Centralized | `stt_analytics` table with `get_stt_analytics` RPC |
| **Corrections** | ✅ Centralized | `transcription_corrections` table with `submit-correction` function |
| **Prompts/Context** | ❌ Duplicated | Agricultural glossary repeated in multiple edge functions |

### SSOT Violations to Address

1. **Duplicate Prompt Engineering**: The `farmTermsPrompt` glossary exists in `voice-to-text` but extraction-specific prompts are duplicated in `process-animal-voice` and `process-farmhand-activity`.

2. **Extraction Logic Split**: 
   - Client-side: `voiceFormExtractors.ts` handles milk/feed/text extraction
   - Server-side: `process-farmhand-activity` handles 5 activity types
   - Animal registration: `process-animal-voice` is separate

---

## Strengths (PROS)

1. **Comprehensive Taglish Support**: Extensive prompt engineering with Filipino agricultural vocabulary, Taglish verb patterns, and bilingual date parsing.

2. **Multi-Modal Architecture**: Three voice input components optimized for different use cases (simple, chat, structured).

3. **Offline Resilience**: `VoiceFormInput` queues recordings to IndexedDB for later processing when offline.

4. **Analytics Infrastructure**: `stt_analytics` table tracks latency, success rates, model versions, and errors for monitoring.

5. **Correction Mechanism**: `transcription_corrections` table and `submit-correction` function enable user feedback loop.

6. **Fuzzy Matching**: `fuzzyMatch.ts` uses Levenshtein distance for animal name matching with 0.75 threshold.

7. **Validation Safeguards**: Number disambiguation prompts and realistic value thresholds (e.g., max 50L per animal).

8. **Voice Training Foundation**: `VoiceTrainingSession` collects user voice samples for future personalization.

---

## Weaknesses (CONS)

1. **High Latency (20+ seconds)**
   - Gemini 3 Pro multimodal processing is slow for real-time use
   - No streaming/realtime transcription
   - Users wait significantly between speaking and seeing results

2. **No Realtime Feedback**
   - Current architecture is batch-only (record → stop → wait → result)
   - No partial transcripts during speaking
   - Poor UX for longer recordings

3. **Single Model Dependency**
   - 100% reliance on Gemini 3 Pro via Lovable AI Gateway
   - No fallback if rate-limited or unavailable
   - No model comparison for accuracy validation

4. **Unused Voice Training Data**
   - Voice samples collected but not utilized
   - No personalized model fine-tuning
   - No speaker recognition

5. **Limited Correction Feedback Loop**
   - `transcription_corrections` table has 0 entries
   - No UI for users to correct transcriptions
   - Corrections not used to improve prompts

6. **SSOT Fragmentation**
   - Agricultural glossary duplicated across functions
   - Extraction logic split between client and server
   - No shared utility for prompt engineering

7. **No Audio Preprocessing**
   - No noise reduction before transcription
   - No audio quality validation
   - May impact accuracy in field conditions

---

## Alternative STT Options

### Option 1: ElevenLabs Scribe v2 (RECOMMENDED)

| Aspect | Details |
|--------|---------|
| **Accuracy** | Industry-leading (claimed 95%+ on benchmarks) |
| **Latency** | <150ms for realtime, ~2-3s for batch |
| **Languages** | 90+ including robust multilingual support |
| **Features** | Speaker diarization, audio event tagging, keyterm prompting |
| **Integration** | React SDK (`@elevenlabs/react`) with `useScribe` hook |
| **Cost** | Pay-per-minute pricing |
| **Existing Setup** | Already have `ELEVENLABS_API_KEY` configured |

**Implementation Path:**
- Token generation edge function (already have similar pattern)
- Replace batch transcription with Scribe v2
- Add realtime option using `useScribe` hook for interactive use cases

### Option 2: Deepgram Nova 3

| Aspect | Details |
|--------|---------|
| **Accuracy** | Very high, optimized for conversational audio |
| **Latency** | ~100ms streaming, fast batch |
| **Languages** | 50+ with accent handling |
| **Features** | Smart formatting, punctuation, entity detection |
| **Integration** | WebSocket SDK |
| **Cost** | Competitive per-minute pricing |

### Option 3: OpenAI Whisper v3 (via Lovable AI)

| Aspect | Details |
|--------|---------|
| **Accuracy** | High, good multilingual |
| **Latency** | 5-15s typical |
| **Languages** | 100+ including Filipino |
| **Features** | Timestamp generation, language detection |
| **Integration** | Already available via Lovable AI Gateway |
| **Cost** | Included in Lovable AI credits |

### Option 4: Hybrid Approach (BEST FOR ACCURACY)

**Combine multiple providers with fallback:**

```text
┌──────────────────────────────────────────────────────────────────┐
│                    HYBRID STT ARCHITECTURE                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Audio Input                                                     │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              REALTIME USE CASES                          │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │  ElevenLabs Scribe v2 Realtime                  │    │    │
│  │  │  - Doc Aga voice chat                           │    │    │
│  │  │  - Interactive milk recording                   │    │    │
│  │  │  - <150ms latency                               │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              BATCH/OFFLINE USE CASES                     │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │  Gemini 3 Pro (current, with prompt tuning)     │    │    │
│  │  │  - Complex farm activity parsing                │    │    │
│  │  │  - Animal registration                          │    │    │
│  │  │  - Fallback for offline queue processing        │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Recommended Implementation Plan

### Phase 1: SSOT Consolidation (Foundation)

**1.1 Create Shared Prompt Library**

Create `supabase/functions/_shared/stt-prompts.ts`:
- Export `AGRICULTURAL_GLOSSARY` constant
- Export `TAGLISH_PATTERNS` constant  
- Export `NUMBER_DISAMBIGUATION_RULES` constant
- Import in all STT-related edge functions

**1.2 Consolidate Extraction Logic**

- Move all extraction logic to `voiceFormExtractors.ts` (client-side SSOT)
- Edge functions return raw transcription only
- Client handles structured extraction with full context

**1.3 Add Correction UI**

- Add "Edit transcription" option after voice input
- Submit corrections via `submit-correction` function
- Display correction count in admin dashboard

### Phase 2: Latency Optimization

**2.1 Integrate ElevenLabs Scribe v2 Realtime**

- Create `supabase/functions/elevenlabs-scribe-token/` for token generation
- Add `useScribe` hook wrapper component
- Use for Doc Aga voice chat (replace current VoiceInterface)

**2.2 Update VoiceFormInput for Realtime**

- Add optional `realtime` prop
- Stream partial transcripts for feedback
- Use VAD (Voice Activity Detection) for natural segmentation

### Phase 3: Accuracy Improvements

**3.1 Keyterm Prompting**

- Extract farm's animal names, feed types, and custom terms
- Pass as keyterms to Scribe v2 API
- Improves domain-specific accuracy

**3.2 Implement A/B Testing**

- Create `stt_ab_tests` table
- Route 10% of requests to alternative model
- Compare accuracy via correction rates

**3.3 Leverage Voice Training Data**

- Aggregate voice samples by user
- Generate user-specific pronunciation patterns
- Include in transcription context

### Phase 4: Resilience & Monitoring

**4.1 Fallback Chain**

```text
Primary: ElevenLabs Scribe v2
   │
   ├── On 429/503 → Gemini 3 Pro
   │
   └── On all failures → Queue for retry
```

**4.2 Enhanced Analytics**

- Track accuracy by user/farm
- Track latency percentiles (p50, p95, p99)
- Alert on degradation

---

## File Changes Summary

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/_shared/stt-prompts.ts` | CREATE | SSOT for agricultural glossary |
| `supabase/functions/elevenlabs-scribe-token/index.ts` | CREATE | Token generation for realtime STT |
| `src/hooks/useRealtimeTranscription.ts` | CREATE | Wrapper for ElevenLabs useScribe |
| `src/lib/voiceFormExtractors.ts` | MODIFY | Add all extraction logic (SSOT) |
| `supabase/functions/voice-to-text/index.ts` | MODIFY | Import shared prompts, add fallback |
| `supabase/functions/process-animal-voice/index.ts` | MODIFY | Use shared prompts |
| `supabase/functions/process-farmhand-activity/index.ts` | MODIFY | Use shared prompts |
| `src/components/VoiceInterface.tsx` | MODIFY | Option for realtime mode |
| `src/components/ui/VoiceFormInput.tsx` | MODIFY | Add realtime transcription option |
| `src/components/TranscriptionCorrection.tsx` | CREATE | UI for user corrections |

---

## Expected Outcomes

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| **Latency (realtime)** | 20,000ms | <500ms | 40x faster |
| **Latency (batch)** | 20,000ms | <5,000ms | 4x faster |
| **Accuracy** | ~92% | >97% | +5% |
| **User Corrections** | 0 | Active | Feedback loop |
| **SSOT Compliance** | Partial | Full | Maintainability |

---

## Dependencies

**New Package:**
```json
"@elevenlabs/react": "^latest"
```

**Existing (Already Configured):**
- `ELEVENLABS_API_KEY` - Available in secrets
- `LOVABLE_API_KEY` - Available for Gemini fallback

---

## Risk Mitigation

1. **ElevenLabs Costs**: Monitor usage closely; implement per-user quotas if needed
2. **Migration Complexity**: Phase rollout; keep Gemini as fallback
3. **Realtime Browser Support**: Graceful degradation to batch mode
4. **Offline Mode**: Queue realtime recordings for batch processing

