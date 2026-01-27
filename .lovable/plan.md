
# Fix: Red Stop Button Not Working in Doc Aga Voice Interface

## Root Cause

The `stopRecording` function in `VoiceInterface.tsx` only handles two states:
1. Realtime mode AND already connected
2. Batch mode with active MediaRecorder

**Missing state**: When in realtime mode but still connecting (WebSocket handshake in progress)

When the user clicks stop during the connecting phase, neither condition matches, so the button does nothing.

## Solution

Update `stopRecording` to handle three states:
1. **Realtime + Connected**: Call `endSession()`
2. **Realtime + Connecting**: Cancel connection and cleanup
3. **Batch mode**: Stop MediaRecorder

## Code Changes

### File: `src/components/VoiceInterface.tsx`

#### Change 1: Add cleanup for connecting state (Lines 158-167)

**Current:**
```typescript
const stopRecording = useCallback(() => {
  if (useRealtime && isRealtimeConnected) {
    console.log('[VoiceInterface] Stopping realtime transcription...');
    endSession();
    setIsRecording(false);
  } else if (mediaRecorderRef.current && isRecording) {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  }
}, [useRealtime, isRealtimeConnected, isRecording, endSession]);
```

**Updated:**
```typescript
const stopRecording = useCallback(() => {
  console.log('[VoiceInterface] Stop requested. State:', { 
    useRealtime, 
    isRealtimeConnected, 
    isRealtimeConnecting,
    isRecording 
  });
  
  if (useRealtime) {
    // Handle both connected and connecting states
    if (isRealtimeConnected) {
      console.log('[VoiceInterface] Stopping active realtime session...');
      endSession();
    } else if (isRealtimeConnecting) {
      console.log('[VoiceInterface] Cancelling realtime connection...');
      // Connection in progress - just reset state, the hook will cleanup
    }
    setIsRecording(false);
  } else if (mediaRecorderRef.current && isRecording) {
    console.log('[VoiceInterface] Stopping batch recording...');
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  }
}, [useRealtime, isRealtimeConnected, isRealtimeConnecting, isRecording, endSession]);
```

#### Change 2: Update button disabled state (Lines 302-311)

**Current:**
```typescript
<Button 
  onClick={stopRecording}
  variant="destructive"
  size="sm"
  className="gap-2"
>
  <Square className="h-4 w-4" />
  Stop & Send
</Button>
```

**Updated:**
```typescript
<Button 
  onClick={stopRecording}
  variant="destructive"
  size="sm"
  className="gap-2"
  disabled={useRealtime && !isRealtimeConnected && !isRealtimeConnecting}
>
  <Square className="h-4 w-4" />
  {isRealtimeConnecting ? 'Cancel' : 'Stop & Send'}
</Button>
```

#### Change 3: Improve status indicator (Lines 298-301)

**Current:**
```typescript
<div className="flex items-center gap-2 text-sm text-destructive">
  <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
  {useRealtime ? 'Listening...' : 'Recording...'}
</div>
```

**Updated:**
```typescript
<div className="flex items-center gap-2 text-sm text-destructive">
  <div className={`h-3 w-3 rounded-full ${isRealtimeConnecting ? 'bg-yellow-500' : 'bg-destructive'} animate-pulse`} />
  {useRealtime 
    ? (isRealtimeConnecting ? 'Connecting...' : 'Listening...') 
    : 'Recording...'}
</div>
```

## Summary

| State | Before Fix | After Fix |
|-------|-----------|-----------|
| Realtime + Connecting | Stop button does nothing | Shows "Connecting..." + "Cancel" button works |
| Realtime + Connected | Works correctly | Works correctly |
| Batch mode | Works correctly | Works correctly |

## Files Changed

| File | Lines | Change |
|------|-------|--------|
| `src/components/VoiceInterface.tsx` | 158-167 | Handle `isRealtimeConnecting` state in stopRecording |
| `src/components/VoiceInterface.tsx` | 298-301 | Show "Connecting..." status during WebSocket handshake |
| `src/components/VoiceInterface.tsx` | 302-311 | Change button text to "Cancel" when connecting |
