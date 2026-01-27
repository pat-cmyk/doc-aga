
# Session 2: Complete Voice System Migration

## Overview

This session completes the unified voice architecture by migrating all remaining voice input components to use the new `VoiceRecordButton` and `useVoiceRecording` infrastructure. We'll also delete deprecated files.

## Current State

**Already Completed (Session 1):**
- `src/lib/voiceStateMachine.ts` - Finite state machine
- `src/hooks/useVoiceRecording.ts` - Unified recording hook
- `src/components/ui/VoiceRecordButton.tsx` - Unified UI component
- `DocAga.tsx` - Migrated to new component

**Still Using Old Pattern:**
| Component | Current Implementation | Voice Used For |
|-----------|----------------------|----------------|
| `RecordBulkMilkDialog.tsx` | `VoiceFormInput` | Milk volume extraction with auto-submit |
| `RecordBulkFeedDialog.tsx` | `VoiceFormInput` | Feed amount extraction |
| `RecordSingleFeedDialog.tsx` | `VoiceFormInput` | Single animal feed entry |
| `RecordBulkBCSDialog.tsx` | `VoiceFormInput` | Notes dictation |
| `AddHealthRecordDialog.tsx` | `VoiceFormInput` (x3) | Diagnosis, treatment, notes |
| `GovernmentConnectTab.tsx` | Custom MediaRecorder | Farmer feedback |
| `VoiceQuickAdd.tsx` | Custom MediaRecorder | Animal registration |
| `DocAgaConsultation.tsx` | Needs update to VoiceRecordButton |

---

## Implementation Plan

### Step 1: Create Data Extraction Wrapper

The current `VoiceFormInput` combines recording AND data extraction. The new `VoiceRecordButton` only handles recording. We need a thin wrapper that adds extraction capability.

**File:** `src/components/ui/VoiceRecordWithExtraction.tsx`

```text
This component wraps VoiceRecordButton and adds:
- Runs extractors on transcription (milk, feed, text, custom)
- Handles auto-submit logic for form completion
- Shows extraction preview feedback
- Maintains backward compatibility with VoiceFormInput props
```

### Step 2: Migrate Milk Recording Dialog

**File:** `src/components/milk-recording/RecordBulkMilkDialog.tsx`

**Changes:**
- Replace `VoiceFormInput` import with `VoiceRecordWithExtraction`
- Update props to match new interface
- Keep auto-submit functionality working

```typescript
// Before (line 33):
import { VoiceFormInput } from "@/components/ui/VoiceFormInput";

// After:
import { VoiceRecordWithExtraction } from "@/components/ui/VoiceRecordWithExtraction";

// Before (lines 408-420):
<VoiceFormInput
  extractorType="milk"
  extractorContext={animalContext}
  onDataExtracted={handleVoiceDataExtracted}
  ...
/>

// After:
<VoiceRecordWithExtraction
  extractorType="milk"
  extractorContext={animalContext}
  onDataExtracted={handleVoiceDataExtracted}
  autoSubmit={{
    enabled: displayAnimals.length > 0,
    onSubmit: handleSubmit,
    isComplete: isFormCompleteForAutoSubmit,
  }}
  size="sm"
/>
```

### Step 3: Migrate Feed Recording Dialogs

**Files:**
- `src/components/feed-recording/RecordBulkFeedDialog.tsx`
- `src/components/feed-recording/RecordSingleFeedDialog.tsx`

**Changes:** Same pattern as milk - replace `VoiceFormInput` with `VoiceRecordWithExtraction`

### Step 4: Migrate BCS Recording Dialog

**File:** `src/components/body-condition/RecordBulkBCSDialog.tsx`

**Changes:** Replace text extractor usage for notes dictation

### Step 5: Migrate Health Records Dialog

**File:** `src/components/health-records/AddHealthRecordDialog.tsx`

This dialog has 3 voice inputs for different fields. We'll use the simpler approach:

```typescript
// For each field (diagnosis, treatment, notes):
<VoiceRecordButton
  size="sm"
  variant="outline"
  onTranscription={(text) => 
    setFormData(prev => ({ 
      ...prev, 
      diagnosis: prev.diagnosis ? `${prev.diagnosis} ${text}` : text 
    }))
  }
/>
```

### Step 6: Migrate Government Feedback Tab

**File:** `src/components/farmer/GovernmentConnectTab.tsx`

Replace custom MediaRecorder implementation with VoiceRecordButton:

```typescript
// Before: Custom state management (isRecording, isProcessing, mediaRecorder, etc.)
// After:
<VoiceRecordButton
  size="lg"
  variant="default"
  onTranscription={setTranscription}
  showLabel
  showLiveTranscript
/>
```

### Step 7: Update VoiceQuickAdd for Animal Registration

**File:** `src/components/animal-form/VoiceQuickAdd.tsx`

This one is more complex - it has a preview state. Options:
1. Keep as-is (it works correctly with its own state machine)
2. Migrate to use `useVoiceRecording` hook directly

**Recommendation:** Migrate to use `useVoiceRecording` for consistency, but keep the custom preview UI.

### Step 8: Update DocAgaConsultation

**File:** `src/components/farmhand/DocAgaConsultation.tsx`

Replace old VoiceInterface with VoiceRecordButton (same as DocAga.tsx was updated).

### Step 9: Delete Deprecated Files

After all migrations are complete:

| File to Delete | Replaced By |
|----------------|-------------|
| `src/components/VoiceInterface.tsx` | `VoiceRecordButton` |
| `src/components/ui/VoiceFormInput.tsx` | `VoiceRecordWithExtraction` |

**Note:** Keep `VoiceQuickAdd.tsx` if we decide not to fully migrate it.

---

## Technical Details

### VoiceRecordWithExtraction Component

```typescript
interface VoiceRecordWithExtractionProps<T = any> {
  // Extraction
  extractorType: ExtractorType;
  extractorContext?: ExtractorContext;
  customExtractor?: (transcription: string, context?: ExtractorContext) => T;
  onDataExtracted: (data: T) => void;
  
  // Auto-submit
  autoSubmit?: {
    enabled: boolean;
    delayMs?: number;
    onSubmit: () => void;
    isComplete?: (data: T) => boolean;
  };
  
  // Passthrough to VoiceRecordButton
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'outline';
  disabled?: boolean;
  className?: string;
  
  // Offline handling
  offlineMode?: 'queue' | 'block';
}
```

### Migration Checklist Per Component

For each dialog:
1. Update import statement
2. Replace component usage
3. Verify auto-submit still works (if applicable)
4. Test recording start/stop/cancel
5. Test transcription extraction
6. Test offline behavior

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/ui/VoiceRecordWithExtraction.tsx` | Wrapper adding extraction to VoiceRecordButton |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/milk-recording/RecordBulkMilkDialog.tsx` | Migrate to VoiceRecordWithExtraction |
| `src/components/feed-recording/RecordBulkFeedDialog.tsx` | Migrate to VoiceRecordWithExtraction |
| `src/components/feed-recording/RecordSingleFeedDialog.tsx` | Migrate to VoiceRecordWithExtraction |
| `src/components/body-condition/RecordBulkBCSDialog.tsx` | Migrate to VoiceRecordWithExtraction |
| `src/components/health-records/AddHealthRecordDialog.tsx` | Migrate to VoiceRecordButton |
| `src/components/farmer/GovernmentConnectTab.tsx` | Migrate to VoiceRecordButton |
| `src/components/farmhand/DocAgaConsultation.tsx` | Migrate to VoiceRecordButton |

## Files to Delete

| File | Reason |
|------|--------|
| `src/components/VoiceInterface.tsx` | Replaced by VoiceRecordButton |
| `src/components/ui/VoiceFormInput.tsx` | Replaced by VoiceRecordWithExtraction |

---

## Expected Outcomes

| Issue | Before | After |
|-------|--------|-------|
| Stop button bugs | Multiple state variables can desync | Single FSM, guaranteed valid transitions |
| Provider confusion | Different components use different STT | All use same hook with fallback chain |
| Inconsistent UX | 5+ different voice UI patterns | Single unified component |
| Maintenance burden | 400+ lines duplicated across files | Shared infrastructure |

---

## Testing Checklist

After implementation:
- [ ] Milk dialog: Voice extraction works, auto-submit triggers
- [ ] Feed dialog: Bulk and single both work
- [ ] BCS dialog: Notes dictation works
- [ ] Health dialog: All 3 fields can be dictated
- [ ] Government feedback: Full recording flow
- [ ] DocAga: Realtime transcription works
- [ ] DocAga Consultation: Same as DocAga
- [ ] Offline mode: Recording queued correctly
- [ ] Stop button: Works in all states
- [ ] Cancel button: Aborts cleanly
