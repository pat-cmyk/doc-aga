
# Offline Audio Caching - Implementation Plan

## Overview

This feature extends the unified voice system to automatically cache audio recordings when offline, then transcribe them when connectivity is restored. The current flow sends audio directly to the `voice-to-text` edge function; when offline, this fails silently. This plan integrates with the existing offline queue infrastructure to provide seamless offline voice recording.

---

## Current Architecture Analysis

### What Already Exists

| Component | Purpose | Status |
|-----------|---------|--------|
| `src/lib/offlineQueue.ts` | IndexedDB-based queue with 50-item limit | Has `audioBlob` field, supports `voice_form_input` type |
| `src/lib/audioCompression.ts` | Compresses audio to <500KB for IndexedDB | Ready to use |
| `src/lib/syncService.ts` | Processes queue items when online | Handles `voice_form_input` type |
| `src/lib/voiceFormQueueProcessor.ts` | Transcribes queued audio and runs extractors | Ready to use |
| `src/hooks/useOnlineStatus.ts` | Real-time online/offline detection | Ready to use |
| `src/hooks/useVoiceRecording.ts` | Unified voice recording hook | Needs offline-aware integration |
| `src/components/ui/VoiceRecordButton.tsx` | Unified UI component | Needs offline mode UI |
| Service Worker (`sw.ts`) | Background sync queue | Already has voice queue messaging |

### Current Gap

When offline, the `useVoiceRecording` hook calls `supabase.functions.invoke('voice-to-text')` which fails. There's no fallback to queue the audio for later transcription.

---

## Implementation Plan

### Phase 1: Create Audio Queue Storage

**New File: `src/lib/offlineAudioQueue.ts`**

Dedicated IndexedDB store for audio blobs (separate from sync queue to handle larger files):

```text
Interface:
- queueAudio(audioBlob, metadata): string  // Returns queue ID
- getPendingAudio(): AudioQueueItem[]
- markTranscribed(id, transcript): void
- removeAudio(id): void
- getQueueCount(): number
- getStorageUsage(): Promise<{used: number, limit: number}>

AudioQueueItem:
- id: string
- audioBlob: Blob (compressed)
- createdAt: number
- status: 'pending' | 'transcribing' | 'transcribed' | 'failed'
- transcript?: string
- retries: number
- metadata: {
    source: 'doc-aga' | 'milk-form' | 'feed-form' | 'health-form' | 'general'
    extractorType?: ExtractorType
    extractorContext?: any
    farmId?: string
  }
```

### Phase 2: Modify useVoiceRecording Hook

**File: `src/hooks/useVoiceRecording.ts`**

Add offline-aware processing:

```typescript
// New state
offlineQueued: boolean;

// Modified processBatchAudio():
if (!navigator.onLine) {
  // Compress and queue audio
  const compressed = await compressAudio(blob);
  const queueId = await queueOfflineAudio(compressed, {
    source: 'general',
  });
  
  // Update state to show queued
  dispatch({ type: 'OFFLINE_QUEUED', queueId });
  
  // Show toast with pending indicator
  toast.info('Recording saved. Will transcribe when online.', {
    icon: <WifiOff />,
  });
  return;
}

// Online: proceed with normal transcription
```

### Phase 3: Add Offline State to State Machine

**File: `src/lib/voiceStateMachine.ts`**

New states and transitions:

```typescript
type VoiceState = 
  | 'idle'
  | 'requesting_mic'
  | 'connecting'
  | 'recording'
  | 'stopping'
  | 'processing'
  | 'offline_queued'  // NEW: Audio saved, waiting for connectivity
  | 'preview'
  | 'error';

// New action
| { type: 'OFFLINE_QUEUED'; queueId: string }
```

### Phase 4: Update VoiceRecordButton UI

**File: `src/components/ui/VoiceRecordButton.tsx`**

Add offline-mode visual feedback:

```typescript
// Show offline indicator when recording while offline
{!isOnline && (
  <WifiOff className="h-3 w-3 text-yellow-500 absolute -top-1 -right-1" />
)}

// Show pending queue badge
{pendingAudioCount > 0 && (
  <Badge variant="secondary" className="absolute -bottom-2">
    {pendingAudioCount} pending
  </Badge>
)}

// State-specific messages
case 'offline_queued':
  return 'Saved offline';
```

### Phase 5: Create Offline Audio Sync Processor

**New File: `src/lib/offlineAudioSyncProcessor.ts`**

Handles transcription when connectivity is restored:

```typescript
export async function syncOfflineAudio(): Promise<void> {
  const pending = await getPendingAudio();
  
  for (const item of pending) {
    try {
      // 1. Transcribe
      const transcript = await transcribe(item.audioBlob);
      
      // 2. If form-specific, run extractor
      if (item.metadata.extractorType) {
        const extracted = runExtractor(transcript, item.metadata.extractorType);
        // Emit to listening forms
        emitVoiceFormResult({ ... });
      }
      
      // 3. Mark complete
      await markTranscribed(item.id, transcript);
      
      // 4. Notify user
      toast.success(`Transcribed: "${transcript.slice(0, 40)}..."`);
      
    } catch (error) {
      // Increment retries, mark failed after 3 attempts
    }
  }
}
```

### Phase 6: Integrate with App Lifecycle

**File: `src/App.tsx` or `src/hooks/useOfflineAudioSync.ts`**

Auto-trigger sync when coming online:

```typescript
export function useOfflineAudioSync() {
  const isOnline = useOnlineStatus();
  const wasOfflineRef = useRef(false);
  
  useEffect(() => {
    if (isOnline && wasOfflineRef.current) {
      // Just came online - sync queued audio
      syncOfflineAudio();
    }
    wasOfflineRef.current = !isOnline;
  }, [isOnline]);
  
  // Also listen for SW sync trigger
  useEffect(() => {
    initServiceWorkerBridge(() => {
      syncOfflineAudio();
    });
  }, []);
}
```

### Phase 7: Add UI Indicators

**Files to Modify:**
- `src/components/NetworkStatusBanner.tsx` - Show pending audio count
- `src/components/UnifiedActionsFab.tsx` - Add badge for pending voice recordings

```typescript
// NetworkStatusBanner enhancement
const pendingAudioCount = usePendingAudioCount();

{!isOnline && pendingAudioCount > 0 && (
  <div className="text-sm text-muted-foreground">
    {pendingAudioCount} voice recording{pendingAudioCount > 1 ? 's' : ''} will 
    transcribe when online
  </div>
)}
```

---

## Technical Details

### Storage Limits

```typescript
const MAX_AUDIO_QUEUE_SIZE = 10;  // Max 10 recordings queued
const MAX_AUDIO_SIZE_MB = 5;      // Reject if compressed audio > 5MB
const AUDIO_RETENTION_HOURS = 48; // Auto-delete after 48 hours
```

### Compression Strategy

```text
1. Record as webm/opus (browser native)
2. On queue: compress to mono WAV at 22kHz (uses audioCompression.ts)
3. Target: <500KB per recording
4. Typical 30-second recording: ~300-400KB after compression
```

### Queue Deduplication

```typescript
// Prevent duplicate processing
const queueId = crypto.randomUUID();
const clientGeneratedId = `offline_audio_${Date.now()}_${queueId}`;
```

### Error Recovery

```text
1. First failure: Retry immediately
2. Second failure: Wait 30 seconds
3. Third failure: Mark as failed, show in queue review UI
4. User can manually retry failed items from CacheSettingsDialog
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/offlineAudioQueue.ts` | IndexedDB store for audio blobs |
| `src/lib/offlineAudioSyncProcessor.ts` | Transcription sync logic |
| `src/hooks/useOfflineAudioSync.ts` | Auto-sync when coming online |
| `src/hooks/usePendingAudioCount.ts` | Real-time pending audio count |

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/voiceStateMachine.ts` | Add `offline_queued` state |
| `src/hooks/useVoiceRecording.ts` | Add offline fallback logic |
| `src/components/ui/VoiceRecordButton.tsx` | Add offline UI indicators |
| `src/components/ui/VoiceRecordWithExtraction.tsx` | Pass source context for queue |
| `src/components/NetworkStatusBanner.tsx` | Show pending audio count |
| `src/App.tsx` | Initialize offline audio sync |

---

## User Experience Flow

### Recording While Offline

```text
1. User taps mic button
2. Recording starts (same as online)
3. User taps stop
4. [OFFLINE] Audio compressed and queued
5. Toast: "Recording saved. Will transcribe when online." (with offline icon)
6. UI shows pending indicator (yellow dot)
```

### Coming Back Online

```text
1. App detects connectivity restored
2. Automatic sync triggered
3. Each queued recording transcribed
4. For form-specific recordings: extracted data emitted to open dialogs
5. Toast per recording: "Transcribed: [preview text]"
6. Pending indicator clears
```

### Queue Review (Optional Enhancement)

```text
In CacheSettingsDialog > Queue tab:
- List of pending/failed audio recordings
- Preview (play audio)
- Manual retry
- Delete
```

---

## Testing Checklist

After implementation:
- [ ] Record while online → instant transcription (no change)
- [ ] Record while offline → audio queued, toast shown
- [ ] Go offline mid-recording → completes recording, queues audio
- [ ] Come online with pending audio → auto-transcribes
- [ ] Form-specific recording offline → re-emits data when transcribed
- [ ] Multiple offline recordings → all process in order
- [ ] Storage limit reached → oldest removed, warning shown
- [ ] Failed transcription → retries, eventually marked failed
- [ ] Manual retry from queue → reprocesses
- [ ] Delete from queue → removes audio blob

---

## Expected Outcomes

| Scenario | Before | After |
|----------|--------|-------|
| Record offline | Silent failure | Audio queued, syncs later |
| Network drops mid-record | Lost recording | Completes and queues |
| Multiple offline recordings | Each fails | All queue and sync |
| Form voice input offline | Can't use voice | Records, extracts when online |
| Storage visibility | None | Pending count shown |
