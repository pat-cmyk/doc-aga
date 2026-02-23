

# Health Voice Extractor Enhancement and Offline Voice Capture

## Problem

Two related gaps in the health recording workflow:

1. **Health extractor category mismatch**: The voice extractor uses category IDs (`illness`, `injury`, `preventive`, `reproductive`) that don't match the UI category IDs (`vaccination`, `deworming`, `treatment`, `checkup`, `injury`, `other`). Voice input never correctly auto-selects a category.

2. **All health voice inputs disabled offline**: Every `VoiceInputButton` in health dialogs has `disabled={!isOnline}`, blocking voice input in the field -- the exact scenario where farmers need it most. The `offlineAudioQueue` infrastructure already exists but isn't wired into these buttons.

## Changes

### 1. Fix Health Extractor Category IDs (`src/lib/voiceFormExtractors.ts`)

Remap `HEALTH_CATEGORY_KEYWORDS` to use the actual UI category IDs from `healthCategories.ts`:

| Old ID | New ID | Keywords |
|--------|--------|----------|
| `illness` | `treatment` | sick, lagnat, fever, mastitis, pneumonia, etc. |
| `preventive` | `vaccination` | vaccine, bakuna |
| (new) | `deworming` | deworm, deworming, purga, pagpurga, albendazole, ivermectin |
| (new) | `checkup` | checkup, check-up, routine, pagsusuri |
| `injury` | `injury` | (stays the same) |
| `reproductive` | `other` | pregnant, buntis, calving, etc. (no dedicated UI category) |

Also remap `COMMON_DIAGNOSES` keys to match the UI categories, and add the diagnoses/treatments from `QUICK_DIAGNOSES` and `QUICK_TREATMENTS` so the extractor can match them by name.

### 2. Enhance Health Extractor Taglish Support (`src/lib/voiceFormExtractors.ts`)

Add Taglish diagnosis patterns:
- "may mastitis si Bessie" -- parse `has [diagnosis]` with Tagalog `may/meron` prefix
- "binigyan ng antibiotic" / "tinurok ng penicillin" -- Tagalog treatment verbs
- "nilagnat" / "nagtatae" -- Tagalog verb forms for common illnesses

Add more treatment keyword coverage matching `QUICK_TREATMENTS`:
- `vaccine administered`, `booster`, `oral dewormer`, `injectable dewormer`, `wound cleaned`, `anti-inflammatory`, `IV fluids`, `bandage`

### 3. Enable Offline Voice for Health VoiceInputButtons

**Approach**: Modify `VoiceInputButton` to support offline audio queuing. When offline, instead of calling the edge function, it stores the audio blob in `offlineAudioQueue` and shows a "Queued" toast. When connectivity returns, the existing `useOfflineAudioSync` hook processes it.

Changes to `src/components/ui/voice-input-button.tsx`:
- Remove the `disabled={!isOnline}` requirement from the component (callers will stop passing it)
- Add offline detection: if `!navigator.onLine` after recording, queue audio via `queueOfflineAudio()` instead of calling `supabase.functions.invoke('voice-to-text')`
- Show "Na-queue ang audio -- ita-transcribe kapag online na" toast
- Accept optional `source` and `extractorType` props for proper queue metadata

Changes to all 4 health dialog files (remove `disabled={!isOnline}` from VoiceInputButton instances):
- `RecordSingleHealthDialog.tsx` -- 5 instances
- `RecordBulkHealthDialog.tsx` -- 5 instances
- `AddHealthRecordDialog.tsx` -- 3 instances
- `AddPreventiveHealthDialog.tsx` -- 1 instance

### 4. Documentation

Update `changelog.md` with these changes.

---

## Technical Details

### VoiceInputButton Offline Flow

```text
User taps mic -> Record audio -> User taps stop
  |
  +-- Online? -> Call voice-to-text edge function -> onTranscription(text)
  |
  +-- Offline? -> compressAudio(blob) -> queueOfflineAudio(blob, metadata)
                  -> Toast "Audio queued, will transcribe when online"
                  -> useOfflineAudioSync (existing) processes on reconnect
```

The `AudioQueueMetadata.source` will be set to `'health-form'` and `extractorType` to `'health'` so the sync processor knows how to handle the result.

**Important**: The offline-queued audio won't immediately fill the form field (transcription happens later). The toast makes this clear to the farmer. This is acceptable because:
- The farmer can still type or use quick-pick buttons while offline
- The transcription will be available when they return online
- This is consistent with how the existing `VoiceRecordButton` already handles offline audio in feed/milk forms

### Files Modified

| File | Change |
|------|--------|
| `src/lib/voiceFormExtractors.ts` | Fix category IDs, add Taglish patterns, expand treatment keywords |
| `src/components/ui/voice-input-button.tsx` | Add offline audio queuing support |
| `src/components/health-recording/RecordSingleHealthDialog.tsx` | Remove `disabled={!isOnline}` from 5 VoiceInputButtons |
| `src/components/health-recording/RecordBulkHealthDialog.tsx` | Remove `disabled={!isOnline}` from 5 VoiceInputButtons |
| `src/components/health-records/AddHealthRecordDialog.tsx` | Remove `disabled={!isOnline}` from 3 VoiceInputButtons |
| `src/components/preventive-health/AddPreventiveHealthDialog.tsx` | Remove `disabled={!isOnline}` from 1 VoiceInputButton |
| `changelog.md` | Document changes |

