
# Comprehensive Voice System Audit & Unified Architecture Plan

## Executive Summary

After a thorough audit, I've identified that the current voice system is **fragmented across 7+ different implementations** with inconsistent patterns for recording, transcription, extraction, and playback. This has led to recurring bugs like the unresponsive stop button and the issue where the wrong STT provider is used.

This plan proposes a **unified voice service architecture** that centralizes all voice functionality into a single, testable, and maintainable system.

---

## Current State Audit Findings

### 1. Fragmented Voice Input Components

| Component | Location | STT Provider | Recording Method | Issues |
|-----------|----------|--------------|------------------|--------|
| `VoiceInterface.tsx` | DocAga chat | ElevenLabs Scribe (realtime) OR Gemini (batch) | MediaRecorder + `useRealtimeTranscription` | Stop button fails during connecting state; dual-path complexity |
| `VoiceFormInput.tsx` | Milk/Feed/Health dialogs | Gemini only (voice-to-text) | MediaRecorder | No realtime option; no live feedback |
| `VoiceQuickAdd.tsx` | Animal registration | Gemini only (voice-to-text) | MediaRecorder | Separate implementation; no shared logic |
| `GovernmentConnectTab.tsx` | Farmer feedback | Gemini only (voice-to-text) | MediaRecorder | Yet another separate implementation |

### 2. State Management Issues

**VoiceInterface.tsx** has **5 different state variables** for recording state:
- `isRecording` (local state)
- `isRealtimeConnected` (from hook)
- `isRealtimeConnecting` (from hook)
- `isProcessing` (local state)
- MediaRecorder internal state

**Problem**: These states can become out of sync, causing the stop button to fail.

### 3. Dual-Path Transcription Flow

```text
Current Flow (VoiceInterface):

[User Speaks]
    │
    ├──► useRealtime=true ──► useRealtimeTranscription hook
    │                              │
    │                              ├──► elevenlabs-scribe-token (Edge Function)
    │                              │
    │                              └──► ElevenLabs Scribe WebSocket
    │
    └──► useRealtime=false ──► MediaRecorder + base64
                                    │
                                    └──► voice-to-text (Edge Function) ──► Gemini 3 Pro
```

**Problem**: Two completely different code paths with different error handling, making bugs hard to track.

### 4. Inconsistent Form Extraction

| Extractor | Used By | Auto-Submit | Verification Preview |
|-----------|---------|-------------|----------------------|
| `extractMilkData()` | RecordBulkMilkDialog | Yes (2.5s delay) | Toast only |
| `extractFeedData()` | RecordBulkFeedDialog | No | None |
| `extractTextData()` | Health records | No | None |
| Custom (animal) | VoiceQuickAdd | No | Full preview card |

### 5. TTS (Text-to-Speech) Integration

- Only used in DocAga and DocAgaConsultation
- Calls `text-to-speech` edge function → ElevenLabs API
- Returns base64 audio, played via HTML Audio element
- No shared audio playback utility

---

## Root Causes of Recurring Issues

### Issue 1: Stop Button Not Working
**Root Cause**: `stopRecording()` only handles `isRealtimeConnected=true`, but user can click stop during `isRealtimeConnecting=true` (already partially fixed, but state machine is still fragile).

### Issue 2: Wrong STT Provider Used
**Root Cause**: `useRealtime` prop was not passed to VoiceInterface in DocAga, defaulting to batch mode (Gemini).

### Issue 3: Hallucination in Transcription
**Root Cause**: Gemini's transcription prompt was too suggestive, leading to content invention when audio was unclear.

### Issue 4: Inconsistent Recording UX Across App
**Root Cause**: Multiple implementations with different recording logic, state management, and feedback.

---

## Proposed Unified Architecture

### Core Principle: Single Responsibility Components

```text
Proposed Architecture:

┌─────────────────────────────────────────────────────────────────┐
│                     Unified Voice Service                        │
│                  (src/lib/voiceService.ts)                       │
├─────────────────────────────────────────────────────────────────┤
│  • Single state machine for recording lifecycle                  │
│  • Provider abstraction (ElevenLabs Scribe, Gemini fallback)    │
│  • Automatic fallback chain                                      │
│  • Centralized error handling                                    │
│  • Analytics logging                                             │
└───────────────────────┬─────────────────────────────────────────┘
                        │
         ┌──────────────┴──────────────┐
         ▼                             ▼
┌─────────────────────┐     ┌─────────────────────┐
│  useVoiceRecording  │     │   useVoiceSynth     │
│       (Hook)        │     │      (Hook)         │
├─────────────────────┤     ├─────────────────────┤
│ • Recording state   │     │ • Play TTS audio    │
│ • Transcription     │     │ • Queue management  │
│ • Auto-submit       │     │ • Voice selection   │
│ • Preview toast     │     │ • Playback state    │
└─────────┬───────────┘     └─────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│              VoiceRecordButton (Single UI Component)             │
├─────────────────────────────────────────────────────────────────┤
│  Props:                                                          │
│  • mode: 'realtime' | 'batch'                                    │
│  • extractorType: 'milk' | 'feed' | 'text' | 'animal' | 'custom'│
│  • onTranscription: (text: string) => void                       │
│  • onDataExtracted?: (data: T) => void                          │
│  • autoSubmit?: { enabled: boolean, delay: number, onSubmit }   │
│  • showPreview?: boolean                                         │
│  • size: 'sm' | 'md' | 'lg'                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 1: Unified Recording State Machine

Create a finite state machine to eliminate state inconsistencies:

**File**: `src/lib/voiceStateMachine.ts`

```typescript
// States: idle → requesting_mic → connecting → recording → stopping → processing → preview → idle
// Transitions are explicit and validated

type VoiceState = 
  | 'idle'
  | 'requesting_mic'      // Waiting for microphone permission
  | 'connecting'          // Connecting to realtime provider (WebSocket handshake)
  | 'recording'           // Actively recording/streaming
  | 'stopping'            // User pressed stop, waiting for cleanup
  | 'processing'          // Transcription in progress (batch mode)
  | 'preview'             // Showing transcription for verification
  | 'error';              // Error state with retry option

interface VoiceStateMachine {
  state: VoiceState;
  partialTranscript: string;
  finalTranscript: string;
  error: Error | null;
  
  // Actions
  requestMicrophone(): void;
  cancelMicrophone(): void;
  startRecording(): void;
  stopRecording(): void;
  confirmTranscription(): void;
  retryRecording(): void;
  reset(): void;
}
```

### Phase 2: Unified Voice Recording Hook

**File**: `src/hooks/useVoiceRecording.ts`

```typescript
interface UseVoiceRecordingOptions {
  // Provider selection
  preferRealtime?: boolean;  // Default: true (uses ElevenLabs Scribe)
  
  // Callbacks
  onTranscription?: (text: string) => void;
  onPartialTranscript?: (text: string) => void;
  onError?: (error: Error) => void;
  
  // Extraction (optional)
  extractorType?: ExtractorType;
  extractorContext?: ExtractorContext;
  onDataExtracted?: (data: any) => void;
  
  // Auto-submit
  autoSubmit?: {
    enabled: boolean;
    delayMs: number;
    isFormComplete: (data: any) => boolean;
    onSubmit: () => void;
  };
  
  // Preview/verification
  showPreview?: boolean;
  previewDurationMs?: number;
}

interface UseVoiceRecordingReturn {
  // State
  state: VoiceState;
  partialTranscript: string;
  finalTranscript: string;
  extractedData: any | null;
  error: Error | null;
  
  // Actions
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  confirmTranscription: () => void;
  retryRecording: () => void;
  
  // Helpers
  isRecording: boolean;  // state === 'recording' || state === 'connecting'
  isProcessing: boolean; // state === 'processing' || state === 'stopping'
  canStop: boolean;      // state in ['connecting', 'recording']
}
```

### Phase 3: Single Voice Record Button Component

**File**: `src/components/ui/VoiceRecordButton.tsx`

Replace `VoiceInterface`, `VoiceFormInput`, and `VoiceQuickAdd` with a single component:

```typescript
interface VoiceRecordButtonProps<T = any> {
  // Core
  onTranscription?: (text: string) => void;
  onDataExtracted?: (data: T) => void;
  
  // Mode
  mode?: 'realtime' | 'batch';  // Default: 'realtime'
  
  // Extraction
  extractorType?: ExtractorType;
  extractorContext?: ExtractorContext;
  
  // Auto-submit
  autoSubmit?: boolean;
  autoSubmitDelay?: number;
  isFormComplete?: (data: T) => boolean;
  onAutoSubmit?: () => void;
  
  // UI
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'outline';
  showLabel?: boolean;
  showLiveTranscript?: boolean;
  showPreview?: boolean;
  
  // State
  disabled?: boolean;
  className?: string;
}
```

### Phase 4: Implementation Roadmap

#### Step 1: Create Core Infrastructure (1 session)
- Create `src/lib/voiceStateMachine.ts` with explicit state transitions
- Create `src/hooks/useVoiceRecording.ts` that wraps `useRealtimeTranscription` and batch mode
- Add comprehensive logging for debugging

#### Step 2: Create Unified Component (1 session)
- Create `src/components/ui/VoiceRecordButton.tsx`
- Implement all UI states (idle, connecting, recording, processing, preview, error)
- Add transcription preview with confirm/cancel
- Add auto-submit countdown UI

#### Step 3: Migrate Existing Components (2-3 sessions)
- Replace `VoiceInterface` in DocAga with `VoiceRecordButton`
- Replace `VoiceFormInput` in milk/feed/health dialogs
- Replace `VoiceQuickAdd` in animal registration
- Replace custom voice logic in GovernmentConnectTab

#### Step 4: Add Missing Features (1 session)
- Transcription verification toast before data extraction
- Audio playback for success/error feedback
- Offline queue integration for all voice inputs

#### Step 5: Testing & Documentation (1 session)
- Add integration tests for state machine
- Add E2E tests for voice recording flow
- Update ARCHITECTURE.md with voice system documentation

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `src/lib/voiceStateMachine.ts` | Finite state machine for recording lifecycle |
| `src/hooks/useVoiceRecording.ts` | Unified recording hook |
| `src/components/ui/VoiceRecordButton.tsx` | Single UI component for all voice input |
| `src/__tests__/voice/voiceStateMachine.test.ts` | State machine tests |

### Files to Modify
| File | Change |
|------|--------|
| `src/components/DocAga.tsx` | Replace VoiceInterface with VoiceRecordButton |
| `src/components/farmhand/DocAgaConsultation.tsx` | Replace VoiceInterface with VoiceRecordButton |
| `src/components/milk-recording/RecordBulkMilkDialog.tsx` | Replace VoiceFormInput with VoiceRecordButton |
| `src/components/feed-recording/RecordBulkFeedDialog.tsx` | Replace VoiceFormInput with VoiceRecordButton |
| `src/components/feed-recording/RecordSingleFeedDialog.tsx` | Replace VoiceFormInput with VoiceRecordButton |
| `src/components/health-records/AddHealthRecordDialog.tsx` | Replace VoiceFormInput with VoiceRecordButton |
| `src/components/body-condition/RecordBulkBCSDialog.tsx` | Replace VoiceFormInput with VoiceRecordButton |
| `src/components/farmer/GovernmentConnectTab.tsx` | Replace custom voice logic with VoiceRecordButton |

### Files to Deprecate (delete after migration)
| File | Reason |
|------|--------|
| `src/components/VoiceInterface.tsx` | Replaced by VoiceRecordButton |
| `src/components/ui/VoiceFormInput.tsx` | Replaced by VoiceRecordButton |
| `src/components/animal-form/VoiceQuickAdd.tsx` | Replaced by VoiceRecordButton |

---

## Technical Details

### State Machine Transitions

```text
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ┌─────────┐  requestMic  ┌───────────────┐  granted  ┌───────────┐ │
│  │  idle   │────────────►│ requesting_mic │──────────►│connecting │ │
│  └─────────┘              └───────────────┘           └─────┬─────┘ │
│       ▲                         │ denied                    │       │
│       │                         ▼                           │       │
│       │                   ┌─────────┐                       │       │
│       │◄──────reset───────│  error  │◄────────error─────────┤       │
│       │                   └─────────┘                       │       │
│       │                         ▲                           ▼       │
│       │                         │ error              ┌───────────┐  │
│       │                         └────────────────────│ recording │  │
│       │                                              └─────┬─────┘  │
│       │                                                    │        │
│       │                                              stop  │        │
│       │                                                    ▼        │
│       │                   ┌───────────┐             ┌───────────┐   │
│       │◄────confirm───────│  preview  │◄────done────│ stopping  │   │
│       │                   └───────────┘             └───────────┘   │
│       │                         │                                   │
│       └─────────retry───────────┘                                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Provider Fallback Chain

```typescript
async function transcribe(audioBlob: Blob): Promise<string> {
  // 1. Try ElevenLabs Scribe (realtime mode)
  if (preferRealtime && canUseRealtimeSTT()) {
    try {
      return await transcribeWithElevenLabsScribe();
    } catch (error) {
      console.warn('[Voice] ElevenLabs failed, falling back:', error);
    }
  }
  
  // 2. Fallback to Gemini (batch mode)
  try {
    return await transcribeWithGemini(audioBlob);
  } catch (error) {
    console.error('[Voice] All providers failed:', error);
    throw new Error('Transcription unavailable. Please try again.');
  }
}
```

### Transcription Preview Flow

```typescript
// Show preview toast with countdown
toast.info(`Heard: "${transcription}"`, {
  duration: 3000,
  action: {
    label: 'Cancel',
    onClick: () => {
      cancelAutoSubmit();
      toast.info('Cancelled. Tap mic to try again.');
    },
  },
});

// After delay, extract data and auto-submit
setTimeout(() => {
  const extracted = runExtractor(transcription, extractorType, context);
  onDataExtracted(extracted);
  
  if (autoSubmit.enabled && autoSubmit.isFormComplete(extracted)) {
    playSound('success');
    autoSubmit.onSubmit();
  }
}, previewDurationMs);
```

---

## Expected Outcomes

| Issue | Current | After Implementation |
|-------|---------|---------------------|
| Stop button unresponsive | Fails during connecting | Works in all states (state machine) |
| Wrong STT provider | Defaults to Gemini | Always uses ElevenLabs Scribe first |
| Hallucinated transcriptions | Gemini invents content | Strict prompt + preview verification |
| Inconsistent UX | 4+ different implementations | Single unified component |
| Hard to debug | Multiple code paths | Single state machine with logging |
| No transcription preview | Auto-submits without verification | Preview toast with cancel option |

---

## Implementation Priority

**Immediate (this session):**
1. Create `voiceStateMachine.ts` and `useVoiceRecording.ts`
2. Create `VoiceRecordButton.tsx` with all states
3. Migrate DocAga to use new component

**Next session:**
4. Migrate milk/feed/health dialogs
5. Migrate animal registration
6. Delete deprecated files

**Future:**
7. Add comprehensive tests
8. Add TTS queue management
9. Document in ARCHITECTURE.md
