
# Voice System Architecture - Migration Complete ✅

## Overview

The voice system has been unified into a single, maintainable architecture that eliminates state desync bugs and provides consistent UX across all voice-enabled features.

## Completed Infrastructure

### Core Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/voiceStateMachine.ts` | Finite state machine for recording lifecycle | ✅ Complete |
| `src/hooks/useVoiceRecording.ts` | Unified recording hook with provider fallback | ✅ Complete |
| `src/components/ui/VoiceRecordButton.tsx` | Single UI component for all voice input | ✅ Complete |
| `src/components/ui/VoiceRecordWithExtraction.tsx` | Wrapper adding data extraction + auto-submit | ✅ Complete |

### State Machine

```text
States: idle → requesting_mic → connecting → recording → stopping → processing → preview → idle

Key guarantees:
- Stop button works in ALL states (connecting, recording)
- Single source of truth for recording state
- Automatic cleanup on unmount
- Error recovery with retry
```

### Provider Fallback Chain

1. **ElevenLabs Scribe** (realtime) - Primary provider for low-latency transcription
2. **Gemini** (batch) - Fallback when ElevenLabs fails

## Migrated Components

| Component | Before | After | Status |
|-----------|--------|-------|--------|
| `DocAga.tsx` | Custom `VoiceInterface` | `VoiceRecordButton` | ✅ Complete |
| `DocAgaConsultation.tsx` | Custom `VoiceInterface` | `VoiceRecordButton` | ✅ Complete |
| `RecordBulkMilkDialog.tsx` | `VoiceFormInput` | `VoiceRecordWithExtraction` | ✅ Complete |
| `RecordSingleMilkDialog.tsx` | `VoiceFormInput` | `VoiceRecordWithExtraction` | ✅ Complete |
| `RecordBulkFeedDialog.tsx` | `VoiceFormInput` | `VoiceRecordWithExtraction` | ✅ Complete |
| `RecordSingleFeedDialog.tsx` | `VoiceFormInput` | `VoiceRecordWithExtraction` | ✅ Complete |
| `RecordBulkBCSDialog.tsx` | `VoiceFormInput` | `VoiceRecordButton` (text dictation) | ✅ Complete |
| `AddHealthRecordDialog.tsx` | `VoiceFormInput` (x3) | `VoiceRecordButton` (x3) | ✅ Complete |
| `GovernmentConnectTab.tsx` | Custom MediaRecorder | `VoiceRecordButton` | ✅ Complete |
| `VoiceQuickAdd.tsx` | Custom state machine | `useVoiceRecording` hook | ✅ Complete |

## Deleted Files

| File | Reason |
|------|--------|
| `src/components/VoiceInterface.tsx` | Replaced by `VoiceRecordButton` |
| `src/components/ui/VoiceFormInput.tsx` | Replaced by `VoiceRecordWithExtraction` |

## Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│                    useVoiceRecording Hook                        │
│                 (src/hooks/useVoiceRecording.ts)                 │
├─────────────────────────────────────────────────────────────────┤
│  • State machine (voiceStateMachine.ts)                          │
│  • Provider selection (ElevenLabs → Gemini fallback)            │
│  • Error handling with retry                                     │
│  • Cleanup on unmount                                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
         ┌──────────────────┴──────────────────┐
         ▼                                     ▼
┌─────────────────────┐             ┌──────────────────────────┐
│  VoiceRecordButton  │             │ VoiceRecordWithExtraction │
│     (Simple UI)     │             │    (Extraction + Submit)  │
├─────────────────────┤             ├──────────────────────────┤
│ • Recording states  │             │ • Wraps VoiceRecordButton │
│ • Live transcript   │             │ • Runs extractors         │
│ • Preview toast     │             │ • Auto-submit countdown   │
│ • Error display     │             │ • Validation warnings     │
└─────────────────────┘             └──────────────────────────┘
        │                                      │
        ▼                                      ▼
┌────────────────────────────────────────────────────────────────┐
│                        Used By                                  │
├────────────────────────────────────────────────────────────────┤
│ • DocAga chat           • Milk recording dialogs               │
│ • DocAga consultation   • Feed recording dialogs               │
│ • Health records        • BCS recording                        │
│ • Government feedback   • Animal registration (VoiceQuickAdd)  │
└────────────────────────────────────────────────────────────────┘
```

## Testing Checklist

- [x] Milk dialog: Voice extraction works, auto-submit triggers
- [x] Feed dialog: Bulk and single both work
- [x] BCS dialog: Notes dictation works
- [x] Health dialog: All 3 fields can be dictated
- [x] Government feedback: Full recording flow
- [x] DocAga: Realtime transcription works
- [x] DocAga Consultation: Same as DocAga
- [ ] Offline mode: Recording queued correctly (verify in field)
- [x] Stop button: Works in all states
- [x] Cancel button: Aborts cleanly

## Usage Examples

### Simple Transcription (DocAga, Health)

```tsx
<VoiceRecordButton
  preferRealtime={true}
  showLabel
  showLiveTranscript
  onTranscription={(text) => handleUserMessage(text)}
/>
```

### Form Extraction with Auto-Submit (Milk, Feed)

```tsx
<VoiceRecordWithExtraction
  extractorType="milk"
  extractorContext={{ animals: milkingAnimals }}
  onDataExtracted={handleVoiceDataExtracted}
  autoSubmit={{
    enabled: displayAnimals.length > 0,
    onSubmit: handleSubmit,
    isComplete: (data) => !!data.totalLiters,
  }}
  size="sm"
/>
```

### Custom Preview UI (VoiceQuickAdd)

```tsx
const { state, startRecording, stopRecording, reset } = useVoiceRecording({
  preferRealtime: false,
  onTranscription: processTranscription,
  onError: handleError,
});

// Custom UI based on state...
```

## Future Improvements

- Add TTS queue management for response playback
- Add voice activity detection visualization
- Add offline audio caching for later transcription
- Add analytics for voice feature usage
