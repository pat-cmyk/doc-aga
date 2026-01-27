
# Fix TTS Queue Infinite Re-render Loop

## Problem

The `useTTSQueue` hook has an infinite re-render loop caused by unstable callback function references in its `useEffect` dependencies.

**Console Evidence**: Repeated `[TTSQueue] Stop - clearing queue` logs (50+ times in 30 seconds)

**Root Cause** (lines 44-74 in `useTTSQueue.ts`):
```typescript
useEffect(() => {
  const queue = new TTSAudioQueue({...}, autoPlay);
  queueRef.current = queue;
  return () => {
    queue.destroy();  // Logs "Stop - clearing queue"
  };
}, [autoPlay, onQueueEmpty, onStart, onEnd, onError]); // BUG: callbacks change every render
```

In `DocAga.tsx`, the callbacks are inline functions:
```typescript
const ttsQueue = useTTSQueue({
  autoPlay: true,
  onError: (error) => { // NEW function reference every render
    console.error('[DocAga] TTS Queue error:', error);
  },
});
```

## Solution

Use the **callback ref pattern** to stabilize the useEffect dependencies while still allowing callback updates.

---

## Implementation

### File: `src/hooks/useTTSQueue.ts`

**Changes:**
1. Add a `callbacksRef` to store the latest callbacks
2. Use a separate effect to keep the ref updated (no cleanup, no dependencies)
3. Modify the main effect to only depend on `autoPlay`
4. Proxy callbacks through the ref so they always call the latest version

**Before (buggy):**
```typescript
useEffect(() => {
  const queue = new TTSAudioQueue({
    onStart: (item) => { onStart?.(item); },
    onEnd: (item) => { onEnd?.(item); },
    onQueueEmpty: () => { onQueueEmpty?.(); },
    onError: (error) => { onError?.(error); },
    // ...
  }, autoPlay);
  // ...
}, [autoPlay, onQueueEmpty, onStart, onEnd, onError]);
```

**After (fixed):**
```typescript
// Store callbacks in ref to avoid effect re-runs
const callbacksRef = useRef({ onQueueEmpty, onStart, onEnd, onError });

// Keep ref updated with latest callbacks (no deps = runs every render)
useEffect(() => {
  callbacksRef.current = { onQueueEmpty, onStart, onEnd, onError };
});

// Initialize queue once (only depends on autoPlay)
useEffect(() => {
  const queue = new TTSAudioQueue({
    onStart: (item) => {
      setCurrentMessageId(item.messageId || null);
      callbacksRef.current.onStart?.(item);
    },
    onEnd: (item) => {
      callbacksRef.current.onEnd?.(item);
    },
    onQueueEmpty: () => {
      setCurrentMessageId(null);
      callbacksRef.current.onQueueEmpty?.();
    },
    onError: (error) => {
      callbacksRef.current.onError?.(error);
    },
    onStateChange: (state) => {
      setIsPlaying(state.isPlaying);
      setIsPaused(state.isPaused);
      setQueueLength(state.queueLength);
    },
  }, autoPlay);

  queueRef.current = queue;

  return () => {
    queue.destroy();
    queueRef.current = null;
  };
}, [autoPlay]); // Only autoPlay as dependency
```

---

## Secondary Fix: Reset Voice Input State

### File: `src/components/DocAga.tsx`

Add reset for `isVoiceInput` in the finally block to ensure button returns to normal state:

**Location**: Line 401-403 (finally block of `handleSendMessage`)

```typescript
} finally {
  setLoading(false);
  setIsVoiceInput(false); // Add this line
}
```

---

## Technical Explanation

### Why the Ref Pattern Works

| Pattern | Behavior |
|---------|----------|
| Callbacks in deps | New function = new reference = effect re-runs = destroy + recreate queue |
| Callbacks in ref | New function updates ref value, effect doesn't see the change, queue persists |

The ref acts as a "stable pointer" to the latest callbacks. The effect only runs when `autoPlay` changes, but when callbacks fire, they read the current value from the ref.

### Why This Fixes the STT Issue

The infinite loop was causing:
1. Rapid state changes during recording
2. Potential WebSocket disruption to ElevenLabs Scribe
3. Voice state machine getting stuck due to timing conflicts

Stopping the loop restores stable component lifecycle, allowing STT and button states to work normally.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useTTSQueue.ts` | Add callbacksRef pattern, remove callbacks from useEffect deps |
| `src/components/DocAga.tsx` | Add `setIsVoiceInput(false)` in finally block |
| `src/components/farmhand/DocAgaConsultation.tsx` | Same isVoiceInput reset (if applicable) |

---

## Expected Results

After implementation:
- No more repeated "Stop - clearing queue" logs
- STT transcription returns clean text (not garbled)
- "Speak to Doc Aga" button becomes clickable after response
- TTS queue operates normally with sequential playback
- Voice state machine properly resets to idle

---

## Testing Checklist

- [ ] Console shows single queue initialization (not repeated)
- [ ] Voice button returns to ready state after AI response
- [ ] Transcribed Filipino/Taglish text displays correctly
- [ ] Multiple voice interactions work sequentially
- [ ] TTS audio plays without interruption
- [ ] Pause/Skip/Stop controls function properly
