
# Fix Doc Aga Voice Button State and Milk Production Query

## Problem Summary

Two issues are preventing proper Doc Aga functionality:

1. **Voice Button Stuck in "Preview" State**: After voice transcription completes and the message is sent, the VoiceRecordButton stays in `preview` state (showing a checkmark) instead of resetting to `idle`. This blocks follow-up voice recordings.

2. **Database Column Name Mismatch**: The `get_milk_production` tool queries a non-existent column `milking_session` when the actual column in `milking_records` is named `session`. This causes all milk production queries to fail.

---

## Root Causes

### Issue 1: Voice Button State

The state machine flow:
```
recording -> stopping -> processing -> preview (stuck here!)
```

After `onTranscription` is called in DocAgaConsultation.tsx, there's no call to reset the voice recording state. The VoiceRecordButton remains in `preview` state, showing a checkmark icon.

**Location**: `DocAgaConsultation.tsx` and `DocAga.tsx` - missing reset after transcription sent

### Issue 2: Wrong Column Name

**File**: `supabase/functions/doc-aga/tools.ts` line 1159

The query selects `milking_session` but the database column is `session`:
```typescript
// Current (WRONG):
.select(`liters, record_date, milking_session, animals!inner(...)`)

// Should be:
.select(`liters, record_date, session, animals!inner(...)`)
```

---

## Implementation Plan

### Step 1: Fix Column Name in getMilkProduction

**File**: `supabase/functions/doc-aga/tools.ts`

```typescript
// Line 1156-1161: Change query to use correct column name
let query = supabase
  .from('milking_records')
  .select(`
    liters,
    record_date,
    session,  // <-- Changed from 'milking_session'
    animals!inner(id, name, ear_tag, livestock_type, farm_id)
  `)
```

Also update the session aggregation (around line 1199):
```typescript
// Change from:
const session = r.milking_session || 'Not specified';
// To:
const session = r.session || 'Not specified';
```

### Step 2: Reset Voice State After Transcription in DocAgaConsultation

**File**: `src/components/farmhand/DocAgaConsultation.tsx`

The VoiceRecordButton's `onTranscription` callback should trigger a reset after the message is processed. We need to add a ref to the VoiceRecordButton or use a different approach.

**Option A** (simpler): Add `showPreview={false}` to skip the preview state entirely
**Option B** (preferred): Use autoSubmit pattern which auto-confirms after sending

Current VoiceRecordButton usage:
```tsx
<VoiceRecordButton
  preferRealtime={false}
  showLabel
  showLiveTranscript={false}
  disabled={isUploadingImage || loading}
  onTranscription={(text) => {
    setIsVoiceInput(true);
    handleSendMessage(text);
  }}
/>
```

Updated to auto-reset:
```tsx
<VoiceRecordButton
  preferRealtime={false}
  showLabel
  showLiveTranscript={false}
  showPreview={false}  // Skip preview state - go straight to idle after transcription
  disabled={isUploadingImage || loading}
  onTranscription={(text) => {
    setIsVoiceInput(true);
    handleSendMessage(text);
  }}
/>
```

### Step 3: Apply Same Fix to DocAga.tsx

**File**: `src/components/DocAga.tsx`

Find the VoiceRecordButton component and add `showPreview={false}`:

```tsx
<VoiceRecordButton
  // ... existing props
  showPreview={false}  // Add this to skip preview state
  onTranscription={(text) => {
    setIsVoiceInput(true);
    handleSendMessage(text);
  }}
/>
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/doc-aga/tools.ts` | Fix column name from `milking_session` to `session` in getMilkProduction query |
| `src/components/farmhand/DocAgaConsultation.tsx` | Add `showPreview={false}` to VoiceRecordButton |
| `src/components/DocAga.tsx` | Add `showPreview={false}` to VoiceRecordButton |

---

## Why showPreview={false} Works

Looking at VoiceRecordButton.tsx line 126-168:

```typescript
const handleTranscription = useCallback((text: string) => {
  // ...
  onTranscription?.(text);  // This calls our handler

  if (showPreview) {
    // Shows toast and can start auto-submit countdown
    // But state stays in 'preview'
  } else {
    // Goes straight to success toast
    toast.success(`Heard: "${previewText}"`);
    // State should reset since there's no preview to confirm
  }
}, [...]);
```

However, looking deeper at the state machine, the issue is that `PROCESSING_COMPLETE` always transitions to `preview` state regardless of `showPreview` prop. We need to also dispatch a RESET after transcription when showPreview is false.

### Alternative: Fix in useVoiceRecording Hook

We could add an option to auto-reset after transcription:

```typescript
// In useVoiceRecording options
autoReset?: boolean;  // If true, reset to idle after transcription

// In processBatchAudio callback, after onTranscription:
if (options.autoReset) {
  dispatch({ type: 'RESET' });
}
```

---

## Technical Details

### Current State Flow (Broken)
```
idle -> requesting_mic -> connecting/recording -> stopping -> processing -> preview (STUCK)
```

### Expected State Flow (Fixed)
```
idle -> requesting_mic -> connecting/recording -> stopping -> processing -> preview -> idle
                                                                            (auto-reset)
```

### Database Schema Verification
The `milking_records` table has these relevant columns:
- `session` (text) - AM/PM session indicator
- `liters` (numeric) - milk amount
- `record_date` (date) - when recorded

---

## Testing Checklist

After implementation:
- [ ] Voice button returns to mic icon after transcription sent
- [ ] Can make multiple consecutive voice recordings
- [ ] Milk production query returns actual data (not error)
- [ ] Session breakdown (AM/PM) shows correctly in response
- [ ] "Ilang litro ng gatas kahapon?" returns valid totals
