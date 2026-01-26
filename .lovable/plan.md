
# Phase 3: Integration & Accuracy Improvements

## Overview

Phase 3 focuses on integrating the realtime transcription infrastructure (created in Phase 2) into the existing components, refactoring edge functions to use shared prompts (SSOT), and implementing accuracy improvements including the fallback chain and correction UI integration.

---

## 1. Refactor Edge Functions to Use Shared Prompts (SSOT)

### 1.1 Update `voice-to-text` Edge Function

**File:** `supabase/functions/voice-to-text/index.ts`

**Current Issue:** Contains a 150+ line `farmTermsPrompt` that duplicates content now in `_shared/stt-prompts.ts`.

**Changes:**
```typescript
// REMOVE: Lines 39-150 (farmTermsPrompt definition)
// ADD: Import from shared library
import { TRANSCRIPTION_SYSTEM_PROMPT } from "../_shared/stt-prompts.ts";

// UPDATE: Line 300 to use imported prompt
{ 
  role: 'system', 
  content: TRANSCRIPTION_SYSTEM_PROMPT  // Was: farmTermsPrompt
}
```

**Also add fallback logic for ElevenLabs failure:**
```typescript
// Add fallback chain: Try ElevenLabs first for lower latency
// On failure, use Gemini (current implementation)
// Analytics: Track which provider was used
```

### 1.2 Update `process-animal-voice` Edge Function

**File:** `supabase/functions/process-animal-voice/index.ts`

**Current Issue:** Contains duplicate `systemPrompt` (lines 21-52) and keyword arrays (lines 55-74) that are now in shared library.

**Changes:**
```typescript
// REMOVE: Lines 21-91 (systemPrompt + keyword arrays + isLikelyAnimalRegistration function)
// ADD: Import from shared library
import { 
  ANIMAL_EXTRACTION_PROMPT,
  REGISTRATION_KEYWORDS,
  NON_REGISTRATION_KEYWORDS,
  isLikelyAnimalRegistration 
} from "../_shared/stt-prompts.ts";

// UPDATE: Line 147 to use imported prompt
{ role: 'system', content: ANIMAL_EXTRACTION_PROMPT }
```

### 1.3 Update `process-farmhand-activity` Edge Function

**File:** `supabase/functions/process-farmhand-activity/index.ts`

**Current Issue:** Contains inline activity extraction prompt (likely around lines 500+). Need to use shared `getActivityExtractionPrompt` function.

**Changes:**
```typescript
// ADD at top of file:
import { getActivityExtractionPrompt } from "../_shared/stt-prompts.ts";

// UPDATE the AI call to use:
const systemPrompt = getActivityExtractionPrompt(animalInfo, animalId);
```

---

## 2. Update VoiceInterface with Realtime Transcription Option

### 2.1 Modify VoiceInterface Component

**File:** `src/components/VoiceInterface.tsx`

**Add realtime mode option with fallback:**

```typescript
interface VoiceInterfaceProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  showLabel?: boolean;
  useRealtime?: boolean;  // NEW: Enable realtime transcription
}
```

**Implementation approach:**
1. When `useRealtime=true`, use `useRealtimeTranscription` hook
2. Show partial transcripts during recording (live feedback)
3. On disconnect, pass full transcript to `onTranscription`
4. If realtime fails (token error, rate limit), fall back to batch transcription

**New UI elements:**
- Live transcript display during recording
- Visual indicator for realtime vs batch mode
- "Edit" button to open TranscriptionCorrectionDialog

```typescript
// Realtime mode UI
{isRecording && useRealtime && partialTranscript && (
  <div className="text-sm text-muted-foreground italic animate-pulse">
    "{partialTranscript}..."
  </div>
)}
```

---

## 3. Update VoiceFormInput with Realtime Option

### 3.1 Modify VoiceFormInput Component

**File:** `src/components/ui/VoiceFormInput.tsx`

**Add optional realtime transcription:**

```typescript
export interface VoiceFormInputProps<T = Record<string, any>> {
  // ... existing props
  
  /** Enable realtime transcription for lower latency */
  useRealtime?: boolean;
  
  /** Show transcription for user verification */
  showTranscription?: boolean;
  
  /** Enable correction UI */
  enableCorrection?: boolean;
}
```

**Implementation:**
1. When `useRealtime=true`, use `useRealtimeTranscription` instead of batch
2. Show live partial transcript as user speaks
3. When recording stops, run extractor on full transcript
4. If `enableCorrection=true`, show "Edit" button to correct transcription

**Fallback chain:**
```typescript
const transcribeAudio = async (blob: Blob) => {
  // 1. Try realtime if enabled and connected
  if (useRealtime && realtimeTranscription.isConnected) {
    return realtimeTranscription.fullTranscript;
  }
  
  // 2. Fallback to batch transcription
  return await batchTranscribe(blob);
};
```

---

## 4. Add Keyterm Prompting for Improved Accuracy

### 4.1 Update Token Generation with Keyterms

**File:** `supabase/functions/elevenlabs-scribe-token/index.ts`

**Add keyterm support:**
```typescript
// Accept keyterms from client
const { keyterms } = await req.json();

// Pass to token generation if ElevenLabs supports it
// (Check ElevenLabs API for keyterm/boosting feature)
```

### 4.2 Pass Farm-Specific Terms to STT

**File:** `src/components/ui/VoiceFormInput.tsx`

```typescript
// Generate keyterms from context
const keyterms = useMemo(() => {
  const terms: string[] = [];
  
  // Add animal names from context
  if (extractorContext?.animals) {
    terms.push(...extractorContext.animals.map(a => a.name).filter(Boolean));
    terms.push(...extractorContext.animals.map(a => a.ear_tag).filter(Boolean));
  }
  
  // Add feed types from context
  if (extractorContext?.feedInventory) {
    terms.push(...extractorContext.feedInventory.map(f => f.feed_type));
  }
  
  return terms;
}, [extractorContext]);
```

---

## 5. Integrate Correction UI

### 5.1 Add Correction Button to VoiceFormInput

**File:** `src/components/ui/VoiceFormInput.tsx`

After successful transcription, show an "Edit" button:

```typescript
{lastTranscription && enableCorrection && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => setCorrectionDialogOpen(true)}
    className="ml-2"
  >
    <Edit className="h-3 w-3 mr-1" />
    Edit
  </Button>
)}

<TranscriptionCorrectionDialog
  open={correctionDialogOpen}
  onOpenChange={setCorrectionDialogOpen}
  originalText={lastTranscription}
  context={extractorType}
  onCorrectionSubmitted={() => {
    // Optionally re-run extractor with corrected text
  }}
/>
```

### 5.2 Add Correction Option to VoiceInterface

**File:** `src/components/VoiceInterface.tsx`

Add similar correction UI for Doc Aga voice input.

---

## 6. Implement Fallback Chain

### 6.1 Create Unified STT Service

**New File:** `src/lib/sttService.ts`

Centralize STT logic with fallback:

```typescript
export interface STTResult {
  text: string;
  provider: 'elevenlabs' | 'gemini' | 'queued';
  latencyMs: number;
}

export async function transcribeAudio(
  audioBlob: Blob,
  options: {
    preferRealtime?: boolean;
    keyterms?: string[];
    onPartialTranscript?: (text: string) => void;
  } = {}
): Promise<STTResult> {
  const startTime = Date.now();
  
  // 1. Try ElevenLabs Scribe (if available)
  if (options.preferRealtime) {
    try {
      const text = await transcribeWithElevenLabs(audioBlob, options.keyterms);
      return {
        text,
        provider: 'elevenlabs',
        latencyMs: Date.now() - startTime
      };
    } catch (error) {
      console.warn('[STT] ElevenLabs failed, falling back to Gemini:', error);
    }
  }
  
  // 2. Fallback to Gemini via voice-to-text edge function
  try {
    const text = await transcribeWithGemini(audioBlob);
    return {
      text,
      provider: 'gemini',
      latencyMs: Date.now() - startTime
    };
  } catch (error) {
    // 3. Queue for later if both fail
    throw new Error('All transcription providers failed');
  }
}
```

---

## 7. Files Summary

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/voice-to-text/index.ts` | MODIFY | Import shared prompts, remove duplicate farmTermsPrompt |
| `supabase/functions/process-animal-voice/index.ts` | MODIFY | Import shared prompts and helper functions |
| `supabase/functions/process-farmhand-activity/index.ts` | MODIFY | Use `getActivityExtractionPrompt` from shared library |
| `src/components/VoiceInterface.tsx` | MODIFY | Add realtime mode, live transcript display, correction button |
| `src/components/ui/VoiceFormInput.tsx` | MODIFY | Add realtime mode, keyterm support, correction UI |
| `src/lib/sttService.ts` | CREATE | Unified STT service with fallback chain |
| `src/hooks/useRealtimeTranscription.ts` | MODIFY | Add keyterm support to token request |
| `supabase/functions/elevenlabs-scribe-token/index.ts` | MODIFY | Accept and forward keyterms |

---

## 8. Technical Considerations

### 8.1 Import Path for Shared Functions

Deno edge functions use relative imports. The shared prompts file at `supabase/functions/_shared/stt-prompts.ts` should be imported as:

```typescript
import { TRANSCRIPTION_SYSTEM_PROMPT } from "../_shared/stt-prompts.ts";
```

### 8.2 Offline Behavior

- Realtime transcription requires active internet connection
- When offline, `VoiceFormInput` continues to use existing queue mechanism
- Queued items use batch Gemini transcription when processed

### 8.3 Analytics Tracking

- Track which provider was used (ElevenLabs vs Gemini vs fallback)
- Measure latency difference between providers
- Track correction rates per provider

---

## 9. Expected Outcomes

| Metric | Before | After |
|--------|--------|-------|
| SSOT Compliance | Partial (duplicate prompts) | Full (shared library) |
| Latency (realtime) | N/A (batch only) | <500ms |
| Latency (batch) | ~20s | ~20s (unchanged) |
| Correction UI | Exists but not integrated | Integrated in voice inputs |
| Fallback | None | ElevenLabs → Gemini → Queue |

---

## 10. Implementation Order

1. **Edge Functions (SSOT)** - Refactor to use shared prompts
2. **sttService.ts** - Create unified service with fallback
3. **VoiceFormInput** - Add realtime + correction integration  
4. **VoiceInterface** - Add realtime + correction integration
5. **Keyterm Support** - Enhance token generation
6. **Testing** - Verify fallback chain works correctly
