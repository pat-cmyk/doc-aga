
# Voice Activity Detection Visualization - Implementation Plan

## Overview

Add real-time audio visualization to give users visual feedback that the microphone is picking up their voice during recording. The visualization will appear when recording and provide immediate feedback through animated bars or a level meter.

---

## Current Architecture

### What We Have

| Component | Purpose | Status |
|-----------|---------|--------|
| `useVoiceRecording` | Unified recording hook with state machine | Has access to MediaStream |
| `VoiceRecordButton` | UI component for voice input | Needs visualization slot |
| `voiceStateMachine` | FSM for recording lifecycle | Defines when to show visualization |
| `audioFeedback.ts` | AudioContext utility | Can be extended for analyser |

### Key Insight

The `useVoiceRecording` hook already captures the `MediaStream` from `getUserMedia()`. We need to:
1. Pass this stream to an AnalyserNode
2. Extract frequency/amplitude data in an animation loop
3. Render visualization during `recording` and `connecting` states

---

## Implementation Plan

### Phase 1: Create Audio Analyser Hook

**New File: `src/hooks/useAudioLevelMeter.ts`**

A dedicated hook that wraps the Web Audio API AnalyserNode:

```text
Interface:
- audioLevel: number (0-100, normalized amplitude)
- frequencyData: Uint8Array (for waveform/bars)
- isActive: boolean
- startAnalysis(stream: MediaStream): void
- stopAnalysis(): void
```

Implementation approach:
- Create AudioContext and AnalyserNode on demand
- Connect MediaStream via MediaStreamAudioSourceNode
- Use requestAnimationFrame for smooth 60fps updates
- Calculate RMS (root mean square) for overall level
- Cleanup properly on stop to prevent memory leaks

### Phase 2: Create Visualization Component

**New File: `src/components/ui/AudioLevelMeter.tsx`**

A reusable visualization component with two display modes:

```text
Props:
- audioLevel: number (0-100)
- frequencyData?: Uint8Array
- variant: 'bars' | 'waveform' | 'circle' | 'simple'
- size: 'sm' | 'md' | 'lg'
- className?: string
```

**Variant Descriptions:**

1. **`bars`** (default) - 5-7 vertical bars that animate based on audio level
   - Clean, minimal design
   - Works well at small sizes
   - Each bar responds to different frequency bands

2. **`waveform`** - Horizontal waveform visualization
   - Uses Canvas for smooth rendering
   - Shows full frequency spectrum
   - More visual but requires more space

3. **`circle`** - Pulsing ring around the mic button
   - Integrates directly with button design
   - Scale/opacity based on audio level
   - Minimal footprint

4. **`simple`** - Single progress bar style
   - Most compact option
   - Just shows overall level
   - Good for small UI contexts

### Phase 3: Integrate with useVoiceRecording

**File: `src/hooks/useVoiceRecording.ts`**

Expose the MediaStream for visualization:

```typescript
// Add to UseVoiceRecordingReturn interface:
mediaStream: MediaStream | null;

// Modify startBatchRecording to store stream reference
// The streamRef is already there, just expose it

// Return:
return {
  // ... existing
  mediaStream: streamRef.current,
};
```

### Phase 4: Add to VoiceRecordButton

**File: `src/components/ui/VoiceRecordButton.tsx`**

Add visualization display during recording:

```typescript
// New props:
showAudioLevel?: boolean;         // Default: true
audioLevelVariant?: 'bars' | 'circle' | 'simple';

// In component:
const { audioLevel, frequencyData, startAnalysis, stopAnalysis } = useAudioLevelMeter();

// Start analysis when recording begins
useEffect(() => {
  if (isRecording && mediaStream) {
    startAnalysis(mediaStream);
  } else {
    stopAnalysis();
  }
}, [isRecording, mediaStream]);

// Render visualization
{isRecording && showAudioLevel && (
  <AudioLevelMeter 
    audioLevel={audioLevel}
    variant={audioLevelVariant}
    size={size}
  />
)}
```

---

## Technical Details

### Web Audio API Pipeline

```text
MediaStream
    ↓
MediaStreamAudioSourceNode
    ↓
AnalyserNode (fftSize: 256, smoothingTimeConstant: 0.8)
    ↓
getByteTimeDomainData() / getByteFrequencyData()
    ↓
requestAnimationFrame loop
    ↓
Calculate RMS / frequency bands
    ↓
Update state (throttled to 30fps for performance)
```

### RMS Calculation for Level Meter

```typescript
function calculateRMS(dataArray: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    // Convert from 0-255 to -1 to 1
    const value = (dataArray[i] - 128) / 128;
    sum += value * value;
  }
  const rms = Math.sqrt(sum / dataArray.length);
  // Normalize to 0-100 with some amplification
  return Math.min(100, rms * 200);
}
```

### Frequency Bands for Bar Visualization

```typescript
const BAND_RANGES = [
  { start: 0, end: 4 },    // Sub-bass (20-60Hz)
  { start: 4, end: 8 },    // Bass (60-250Hz)
  { start: 8, end: 20 },   // Low-mid (250-500Hz)
  { start: 20, end: 40 },  // Mid (500-2kHz)
  { start: 40, end: 80 },  // High-mid (2-4kHz)
  { start: 80, end: 128 }, // Highs (4-20kHz)
];
```

### Performance Considerations

1. **Throttle updates** - Only update React state at 30fps, not 60fps
2. **Use refs for animation** - Avoid re-renders in animation loop
3. **Cleanup on unmount** - Disconnect AudioContext nodes properly
4. **Single AudioContext** - Reuse existing context from audioFeedback.ts

---

## UI Design Specifications

### Bar Visualization (Default)

```text
 ▃ ▅ █ ▅ ▂   ← 5 bars, varying heights based on audio level
```

- Height: 16px (sm), 24px (md), 32px (lg)
- Width: 40px (sm), 60px (md), 80px (lg)
- Bar width: 3-4px with 2px gap
- Colors: Primary color with opacity based on level
- Animation: Spring-like transitions (ease-out)

### Circle Variant

```text
    ╭───╮
   │ 🎤 │  ← Ring pulses with audio level
    ╰───╯
```

- Ring width scales from 2px to 6px
- Opacity: 0.3 (quiet) to 1.0 (loud)
- Color: Destructive red (matches recording state)

### Simple Variant

```text
 ├████████░░░░░░░░░░░│
```

- Single horizontal bar
- Width: Same as button
- Height: 4px
- Gradient from green to yellow to red based on level

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useAudioLevelMeter.ts` | Web Audio API analyser hook |
| `src/components/ui/AudioLevelMeter.tsx` | Visualization UI component |

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useVoiceRecording.ts` | Expose mediaStream in return value |
| `src/components/ui/VoiceRecordButton.tsx` | Add visualization, new props |
| `src/components/ui/VoiceRecordWithExtraction.tsx` | Pass through visualization props |

---

## User Experience Flow

### Recording with Visualization

```text
1. User taps mic button
2. Recording starts → visualization appears
3. Audio levels show bars bouncing in real-time
4. User sees immediate feedback that mic is working
5. Silence → bars stay low
6. Speech → bars animate actively
7. User stops → visualization fades, processing indicator shows
```

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| No audio detected | Bars stay flat (near zero) |
| Very loud audio | Bars cap at max height (no clipping visual) |
| Mic muted in OS | Bars stay flat, no special warning |
| Connecting state | Show subtle pulse animation |
| Offline recording | Same visualization (works locally) |

---

## Styling with Tailwind

### Bar Animation Classes

```css
/* Smooth height transitions */
.audio-bar {
  transition: height 50ms ease-out;
}

/* Optional glow effect when active */
.audio-bar-active {
  box-shadow: 0 0 8px rgba(var(--destructive), 0.5);
}
```

### Responsive Sizing

```typescript
const barConfig = {
  sm: { height: 16, barWidth: 3, gap: 2, count: 4 },
  md: { height: 24, barWidth: 4, gap: 2, count: 5 },
  lg: { height: 32, barWidth: 5, gap: 3, count: 6 },
};
```

---

## Testing Checklist

After implementation:
- [ ] Visualization appears when recording starts
- [ ] Bars animate in response to speech
- [ ] Bars stay low during silence
- [ ] Visualization stops when recording stops
- [ ] No memory leaks (AudioContext cleanup)
- [ ] Works in realtime mode (ElevenLabs)
- [ ] Works in batch mode (Gemini)
- [ ] Works during offline recording
- [ ] Circle variant integrates with button
- [ ] Performance stays smooth (no jank)
- [ ] VoiceQuickAdd shows visualization
- [ ] Form voice inputs show visualization

---

## Expected Outcomes

| Issue | Before | After |
|-------|--------|-------|
| No mic feedback | User unsure if mic is working | Immediate visual confirmation |
| Silent recording anxiety | "Is it picking up my voice?" | Real-time level display |
| Connecting state | Just shows "Connecting..." | Shows subtle animation |
| Professional feel | Basic recording UI | Polished, responsive visualization |
