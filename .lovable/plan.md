
# Switch Doc Aga to Batch Mode (Offline-First)

## Overview

This change switches Doc Aga's voice input from realtime streaming (ElevenLabs Scribe) to batch mode (Gemini). This provides true "record first" behavior that works offline and eliminates the "Connecting..." state.

---

## Current vs. New Flow

| Step | Realtime Mode (Current) | Batch Mode (New) |
|------|-------------------------|------------------|
| 1 | Click → Request Mic | Click → Request Mic |
| 2 | **"Connecting..."** (WebSocket handshake) | - |
| 3 | Live streaming audio | Local recording |
| 4 | Real-time partial transcripts | No live feedback |
| 5 | Stop → Already processed | **Stop → Send to Gemini** |
| 6 | - | "Processing..." |
| 7 | Show transcription | Show transcription |

**Key Benefit**: No network required during recording. Audio is captured locally, then sent after stop button is clicked.

---

## Implementation

### File 1: `src/components/DocAga.tsx`

**Change**: Line 583

```typescript
// Before
preferRealtime={true}

// After
preferRealtime={false}
```

**Full Context** (lines 577-591):
```typescript
<VoiceRecordButton 
  onTranscription={(text) => {
    setIsVoiceInput(true);
    handleSendMessage(text);
  }} 
  disabled={isUploadingImage || loading}
  preferRealtime={false}  // Changed from true
  showLabel={true}
  showLiveTranscript={false}  // Also change - no live transcripts in batch mode
  showPreview={false}
  size="md"
  variant="secondary"
  idleLabel="Speak to Doc Aga"
  recordingLabel="Stop & Send"
/>
```

---

### File 2: `src/components/farmhand/DocAgaConsultation.tsx`

**Change**: Lines 346-349

```typescript
// Before
<VoiceRecordButton
  preferRealtime={true}
  showLabel
  showLiveTranscript

// After
<VoiceRecordButton
  preferRealtime={false}
  showLabel
  showLiveTranscript={false}  // No live transcripts in batch mode
```

---

## How Batch Mode Works (Existing Code)

The `useVoiceRecording` hook already supports batch mode - we're just enabling it:

```typescript
// In startRecording() - line 176-198:
if (preferRealtime) {
  // ... WebSocket path (skipped when false)
} else {
  // Use batch mode directly - NO connecting state
  streamRef.current = stream;
  await startBatchRecording();  // Goes straight to recording
}
```

The `startBatchRecording()` function:
1. Sets provider to 'gemini'
2. Creates MediaRecorder (local, no network)
3. Dispatches `RECORDING_START` immediately (no "connecting")
4. On stop: sends blob to `voice-to-text` edge function

---

## State Flow Comparison

### Realtime Mode (Current)
```text
idle → requesting_mic → connecting → recording → stopping → preview → idle
                           ↑
                      "Connecting..." shown here
```

### Batch Mode (New)
```text
idle → requesting_mic → recording → stopping → processing → preview → idle
           ↑                                       ↑
      Instant start                         "Processing..." shown here
```

---

## Offline Behavior

With batch mode, the existing offline queue kicks in automatically:

```typescript
// In processBatchAudio() - line 283-308:
if (!navigator.onLine) {
  // Queue audio for later transcription
  const queueId = await queueOfflineAudio(blob, metadata);
  dispatch({ type: 'OFFLINE_QUEUED', queueId });
  toast.info('Recording saved offline');
  return;
}
```

When the user is back online, the `useOfflineAudioSync` hook processes queued recordings automatically.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/DocAga.tsx` | Set `preferRealtime={false}`, `showLiveTranscript={false}` |
| `src/components/farmhand/DocAgaConsultation.tsx` | Set `preferRealtime={false}`, `showLiveTranscript={false}` |

---

## Trade-offs

| Feature | Realtime | Batch |
|---------|----------|-------|
| Live partial transcripts | Yes | No |
| Offline recording | Yes | Yes |
| Offline transcription | No | **Queued** |
| Network during recording | Required | Not required |
| Latency to start | ~500ms-2s | Instant |
| Processing time | During recording | After stop |

---

## Expected User Experience

1. **Farmer clicks "Speak to Doc Aga"**
2. **Recording starts immediately** (red pulsing indicator)
3. Farmer speaks their question
4. **Farmer clicks "Stop & Send"**
5. **"Processing..."** shown briefly (1-2 seconds)
6. Transcription appears and Doc Aga responds

If offline:
- Recording still works
- "Saved offline" message shown
- Queued for processing when connectivity returns

---

## Testing Checklist

After implementation:
- [ ] No "Connecting..." state shown
- [ ] Recording starts immediately on button click
- [ ] "Processing..." shows after stop button
- [ ] Transcription appears correctly
- [ ] Offline recording queues properly
- [ ] Doc Aga responds to transcribed text
- [ ] TTS audio plays response
