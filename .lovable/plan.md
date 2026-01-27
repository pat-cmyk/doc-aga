
# TTS Queue Management for Doc Aga - Implementation Plan

## Overview

This feature adds a robust audio playback queue system to Doc Aga, ensuring multiple TTS responses play sequentially without overlap. It provides users with controls to skip the current audio, pause/resume playback, and see the queue status.

---

## Current Architecture Analysis

### What We Have

| Component | Purpose | Current Status |
|-----------|---------|----------------|
| `DocAga.tsx` | Main Doc Aga chat component | Stores single `playingAudio: HTMLAudioElement` |
| `DocAgaConsultation.tsx` | Farmhand version of Doc Aga | Same single audio state |
| `text-to-speech` edge function | ElevenLabs TTS via Supabase | Returns base64 audio |
| `audioFeedback.ts` | Web Audio API synth sounds | No queue logic |

### Current Problem

```typescript
// Current implementation (DocAga.tsx lines 366-378):
if (isVoiceInput) {
  if (playingAudio) {
    playingAudio.pause();           // Just stops current audio
    playingAudio.currentTime = 0;
  }
  const audio = new Audio(audioUrl);
  audio.addEventListener('ended', () => setPlayingAudio(null));
  setPlayingAudio(audio);
  audio.play();
}
```

**Issues:**
- New audio interrupts current playback
- No queue for multiple responses
- Only "Stop" button - no pause/skip
- No visibility into pending audio

---

## Implementation Plan

### Phase 1: Create TTS Audio Queue Manager

**New File: `src/lib/ttsAudioQueue.ts`**

A dedicated class to manage sequential audio playback:

```text
Class: TTSAudioQueue
- queue: AudioQueueItem[]
- currentAudio: HTMLAudioElement | null
- isPaused: boolean
- volume: number (0-1)

Methods:
- enqueue(audioUrl: string, meta?: { messageId: string }): void
- play(): void           // Start queue if paused/stopped
- pause(): void          // Pause current audio
- resume(): void         // Resume from pause
- skip(): void           // Skip current, play next
- stop(): void           // Stop and clear queue
- setVolume(v: number): void
- getQueueLength(): number
- isPlaying(): boolean
- isPaused(): boolean

Events (via callbacks):
- onStart(item): void
- onEnd(item): void
- onQueueEmpty(): void
- onError(error): void
```

**Key Implementation Details:**

- Uses `HTMLAudioElement` for compatibility
- Automatic `onended` listener to advance queue
- Handles audio loading errors gracefully
- Cleans up blob URLs after playback

### Phase 2: Create React Hook for Queue

**New File: `src/hooks/useTTSQueue.ts`**

A React hook wrapping the queue manager with state:

```typescript
interface UseTTSQueueReturn {
  // Actions
  enqueue: (audioUrl: string, meta?: { messageId: string }) => void;
  play: () => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  stop: () => void;
  setVolume: (v: number) => void;
  
  // State
  isPlaying: boolean;
  isPaused: boolean;
  queueLength: number;
  currentMessageId: string | null;
  volume: number;
}

function useTTSQueue(options?: {
  autoPlay?: boolean;  // Default: true
  onQueueEmpty?: () => void;
}): UseTTSQueueReturn;
```

### Phase 3: Create Audio Controls Component

**New File: `src/components/ui/TTSAudioControls.tsx`**

A compact control bar for audio playback:

```text
Visual Layout:
┌────────────────────────────────────────────────┐
│  ⏸/▶  │  ⏭ Skip  │  ⏹ Stop  │  🔊 ▁▂▃  │  (2)  │
└────────────────────────────────────────────────┘
         Pause/Play   Skip Next   Stop All  Volume  Queue Count
```

**Props:**
```typescript
interface TTSAudioControlsProps {
  isPlaying: boolean;
  isPaused: boolean;
  queueLength: number;
  volume: number;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onStop: () => void;
  onVolumeChange: (v: number) => void;
  className?: string;
}
```

**Features:**
- Compact mobile-friendly design
- Volume slider (optional, can hide on mobile)
- Queue count badge
- Pulse animation when playing
- Disabled state when queue empty

### Phase 4: Integrate with DocAga Component

**File: `src/components/DocAga.tsx`**

Replace single audio state with queue:

```typescript
// Remove:
const [playingAudio, setPlayingAudio] = useState<HTMLAudioElement | null>(null);

// Add:
const ttsQueue = useTTSQueue({
  autoPlay: true, // Auto-play when voice input
  onQueueEmpty: () => console.log('TTS queue empty'),
});

// Modify audio generation (line 340-379):
if (!audioError && audioData?.audioContent) {
  const audioBlob = new Blob(...);
  const audioUrl = URL.createObjectURL(audioBlob);
  
  // Update message with audio URL
  setMessages(prev => {
    const newMessages = [...prev];
    const messageId = `msg-${Date.now()}`;
    newMessages[newMessages.length - 1] = {
      ...newMessages[newMessages.length - 1],
      audioUrl,
      messageId, // Track for highlighting
    };
    return newMessages;
  });
  
  // Enqueue for playback (voice input = auto-play)
  if (isVoiceInput) {
    ttsQueue.enqueue(audioUrl, { messageId });
  }
}

// Replace Stop button with TTSAudioControls:
{(ttsQueue.isPlaying || ttsQueue.isPaused || ttsQueue.queueLength > 0) && (
  <TTSAudioControls
    isPlaying={ttsQueue.isPlaying}
    isPaused={ttsQueue.isPaused}
    queueLength={ttsQueue.queueLength}
    volume={ttsQueue.volume}
    onPause={ttsQueue.pause}
    onResume={ttsQueue.resume}
    onSkip={ttsQueue.skip}
    onStop={ttsQueue.stop}
    onVolumeChange={ttsQueue.setVolume}
  />
)}
```

### Phase 5: Update DocAgaConsultation

**File: `src/components/farmhand/DocAgaConsultation.tsx`**

Apply the same integration pattern as DocAga.tsx.

---

## Technical Details

### Queue Item Structure

```typescript
interface AudioQueueItem {
  id: string;           // Unique identifier
  audioUrl: string;     // Blob URL or data URL
  messageId?: string;   // Links to chat message for highlighting
  createdAt: number;    // For ordering
  duration?: number;    // Estimated duration (optional)
}
```

### Playback State Machine

```text
      ┌─────────────┐
      │    IDLE     │ ◄── stop() / queue empty
      └──────┬──────┘
             │ enqueue() + autoPlay
             ▼
      ┌─────────────┐
      │   PLAYING   │ ◄── resume()
      └──────┬──────┘
        │    │ ended
        │    ▼
        │  [next in queue?]
        │    │ yes → loop to PLAYING
        │    │ no  → IDLE
        │
        │ pause()
        ▼
      ┌─────────────┐
      │   PAUSED    │
      └──────┬──────┘
             │ skip()
             ▼
      ┌─────────────┐
      │   PLAYING   │ (next item)
      └─────────────┘
```

### Memory Management

- Revoke blob URLs after playback completes
- Limit queue size to 10 items (oldest dropped if exceeded)
- Clean up on component unmount

### Error Handling

```typescript
audio.onerror = (e) => {
  console.error('[TTSQueue] Audio error:', e);
  // Remove failed item and try next
  advanceQueue();
  onError?.(new Error('Audio playback failed'));
};

audio.onloadedmetadata = () => {
  // Audio ready to play
  audio.play().catch(e => {
    // Browser autoplay policy blocked
    setPaused(true);
    toast.info('Tap play to hear the response');
  });
};
```

### Browser Autoplay Policy

Modern browsers block autoplay. Handle this gracefully:

```typescript
const playNext = async () => {
  if (queue.length === 0) return;
  
  currentAudio = new Audio(queue[0].audioUrl);
  
  try {
    await currentAudio.play();
    setIsPlaying(true);
  } catch (e) {
    // Autoplay blocked - show manual play button
    setIsPaused(true);
    console.warn('[TTSQueue] Autoplay blocked, waiting for user interaction');
  }
};
```

---

## UI Design Specifications

### Audio Controls Bar

```text
Compact Mode (Mobile):
┌──────────────────────────────────┐
│  ⏸  │  ⏭  │  ⏹  │  (2 pending)  │
└──────────────────────────────────┘

Expanded Mode (Desktop):
┌─────────────────────────────────────────────────────┐
│  ⏸ Pause  │  ⏭ Skip  │  ⏹ Stop All  │  🔊━━━━○━  │
└─────────────────────────────────────────────────────┘
```

### Visual States

| State | Controls Shown | Badge |
|-------|----------------|-------|
| Idle (empty queue) | Hidden | - |
| Playing | Pause, Skip, Stop, Volume | Queue count if > 1 |
| Paused | Play, Skip, Stop, Volume | Queue count |
| Error | Retry, Skip, Stop | Error indicator |

### Colors

- Playing: Primary color pulse
- Paused: Muted/gray
- Queue badge: Secondary color
- Stop: Destructive red

### Accessibility

- All buttons have `aria-label`
- Announce queue changes to screen readers
- Keyboard navigation (Space = pause/play)

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/ttsAudioQueue.ts` | Core queue manager class |
| `src/hooks/useTTSQueue.ts` | React hook wrapper |
| `src/components/ui/TTSAudioControls.tsx` | Control bar UI component |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/DocAga.tsx` | Replace single audio with queue |
| `src/components/farmhand/DocAgaConsultation.tsx` | Same queue integration |

---

## User Experience Flow

### Voice Conversation with Queue

```text
1. User asks question via voice
2. Doc Aga streams text response
3. TTS generates audio → enqueued
4. Audio starts playing automatically
5. User asks follow-up (audio still playing)
6. New response streams, TTS generates → enqueued
7. First audio finishes → second starts
8. User can:
   - Pause to read text
   - Skip to next response
   - Stop all audio
   - Adjust volume
```

### Rapid-Fire Questions

```text
1. User asks 3 questions quickly (voice/text mix)
2. All 3 responses stream and generate TTS
3. Queue shows (3 pending)
4. Audio plays sequentially: 1 → 2 → 3
5. User can skip through or stop all
```

### Manual Playback

```text
1. User types question (no auto-play)
2. Response shows with audio player
3. User clicks play on message → enqueues that audio
4. Control bar appears
5. Audio plays
```

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| TTS fails for one message | Skip that item, play next |
| User closes Doc Aga mid-playback | Stop audio, cleanup |
| Offline when TTS requested | Skip TTS, show text only |
| Very long response (>5000 chars) | TTS truncated by edge function, still plays |
| Browser blocks autoplay | Show play button, toast hint |
| Rapid queue additions | Queue up to 10, oldest dropped |

---

## Testing Checklist

After implementation:
- [ ] Single message plays audio correctly
- [ ] Multiple messages queue and play in order
- [ ] Pause stops current audio
- [ ] Resume continues from pause point
- [ ] Skip advances to next queued item
- [ ] Stop clears queue and stops playback
- [ ] Volume slider adjusts audio level
- [ ] Queue count badge shows correct number
- [ ] Blob URLs are cleaned up after playback
- [ ] Error in one audio doesn't break queue
- [ ] Works on mobile browsers
- [ ] Works when voice input triggers auto-play
- [ ] Works when text input (manual play from message)
- [ ] Controls hide when queue is empty
- [ ] Autoplay policy handled gracefully

---

## Expected Outcomes

| Issue | Before | After |
|-------|--------|-------|
| Audio overlap | New audio interrupts current | Sequential playback |
| No queue visibility | Unknown if more audio pending | Badge shows count |
| Only stop button | Can't pause/resume | Full transport controls |
| No skip option | Must wait for audio to end | Skip to next |
| Audio interrupts reading | Must stop to read | Pause while reading |
| Volume control | Browser default only | In-app slider |
