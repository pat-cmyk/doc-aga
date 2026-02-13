
# Add "Full Day" Session Option to Milk Recording

## Overview

Add a third session option -- "Full Day" -- to milk recording, signifying that the recorded amount covers the entire day (not just a morning or evening session). This requires changes across the database constraint, backend RPCs, edge functions, and multiple UI components.

## Impact Analysis

The `session` field flows through this chain:

```text
DB constraint (CHECK) --> RPC (approve_pending_activity) --> Edge Functions (seed-demo-data, process-farmhand-activity, doc-aga, stt-prompts) --> Hooks (useDailyActivityCompliance, useMissingActivityAlerts) --> UI Components (RecordSingleMilkDialog, RecordBulkMilkDialog, EditMilkRecordDialog, MilkingRecords, ActivityConfirmation) --> Type definitions (offlineQueue, voiceFormExtractors)
```

## Changes

### 1. Database Migration

Update the CHECK constraint on `milking_records.session` to accept 'Full Day':

```sql
ALTER TABLE milking_records DROP CONSTRAINT IF EXISTS milking_records_session_check;
ALTER TABLE milking_records ADD CONSTRAINT milking_records_session_check 
  CHECK (session IN ('AM', 'PM', 'Full Day'));
```

### 2. RPC: `approve_pending_activity`

Update the session normalization logic (~line 42-48) to recognize "Full Day" variants:

```sql
_session := CASE 
  WHEN _raw_session IN ('am', 'morning', 'umaga') THEN 'AM'
  WHEN _raw_session IN ('pm', 'afternoon', 'evening', 'hapon', 'gabi') THEN 'PM'
  WHEN _raw_session IN ('full day', 'fullday', 'whole day', 'buong araw', 'all day') THEN 'Full Day'
  WHEN _raw_session = '' THEN 
    CASE WHEN EXTRACT(HOUR FROM _record_datetime) < 12 THEN 'AM' ELSE 'PM' END
  ELSE 'AM'
END;
```

### 3. UI Components (Radio buttons to Select dropdown)

Convert AM/PM radio groups to a Select dropdown with three options in these files:

| File | Current UI |
|------|-----------|
| `src/components/milk-recording/RecordSingleMilkDialog.tsx` | RadioGroup AM/PM |
| `src/components/milk-recording/RecordBulkMilkDialog.tsx` | RadioGroup AM/PM |
| `src/components/milk-recording/EditMilkRecordDialog.tsx` | RadioGroup AM/PM |

Each will use a `<Select>` component with options:
- Morning (AM) -- with Sun icon
- Evening (PM) -- with Moon icon
- Full Day -- with Clock icon

### 4. Type Definitions

Update the session type union from `'AM' | 'PM'` to `'AM' | 'PM' | 'Full Day'` in:

| File | Location |
|------|----------|
| `src/components/milk-recording/EditMilkRecordDialog.tsx` | `MilkRecord.session` interface |
| `src/components/milk-recording/RecordSingleMilkDialog.tsx` | `useState` type |
| `src/components/milk-recording/RecordBulkMilkDialog.tsx` | `useState` type |
| `src/components/MilkingRecords.tsx` | `MilkingRecord.session` interface |
| `src/components/milk-recording/DeleteMilkRecordFromProfileDialog.tsx` | `MilkRecord.session` |
| `src/lib/offlineQueue.ts` | `session` field (2 places) |
| `src/lib/voiceFormExtractors.ts` | `ExtractedMilkData.session` |
| `src/hooks/useDailyActivityCompliance.ts` | `missingSessions` type |
| `src/hooks/useMissingActivityAlerts.ts` | `session` type |

### 5. Daily Activity Compliance Logic

In `useDailyActivityCompliance.ts`: A "Full Day" record should count as covering BOTH AM and PM sessions for that animal. Update the compliance check so that animals with a "Full Day" record are not flagged as missing either session:

```typescript
const fullDayAnimalIds = new Set(
  milkingRecords.filter(r => r.session === 'Full Day').map(r => r.animal_id)
);
// When checking missing sessions, skip animals that have a Full Day record
if (!fullDayAnimalIds.has(animal.id)) {
  if (!amMilkingAnimalIds.has(animal.id)) missingSessions.push('AM');
  if (!pmMilkingAnimalIds.has(animal.id) && isAfternoon) missingSessions.push('PM');
}
```

### 6. Edge Functions

| Function | Change |
|----------|--------|
| `supabase/functions/seed-demo-data/index.ts` | No change needed (keeps seeding AM/PM which is fine) |
| `supabase/functions/process-farmhand-activity/index.ts` | Update auto-session logic to keep defaulting AM/PM (farmhand voice flow); no breaking change needed |
| `supabase/functions/doc-aga/index.ts` | Update `update_milking_record` tool description to mention "Full Day" option |
| `supabase/functions/_shared/stt-prompts.ts` | Add 'full day', 'buong araw', 'whole day' to session detection keywords |

### 7. Farmhand Activity Confirmation

In `src/components/farmhand/ActivityConfirmation.tsx`: The auto-detected session (hour-based AM/PM) stays as the default. No change needed since farmhands can't select "Full Day" from voice -- only manual recording supports it.

### 8. Display in MilkingRecords

In `src/components/MilkingRecords.tsx`: The session badge already renders the session text. "Full Day" will display naturally. May add a distinct badge color (e.g., blue) to differentiate from AM (amber) and PM (indigo).

## Files Summary

| File | Action |
|------|--------|
| Database migration | Add 'Full Day' to CHECK constraint |
| RPC `approve_pending_activity` | Recognize 'Full Day' variants |
| `src/components/milk-recording/RecordSingleMilkDialog.tsx` | Select dropdown + type update |
| `src/components/milk-recording/RecordBulkMilkDialog.tsx` | Select dropdown + type update |
| `src/components/milk-recording/EditMilkRecordDialog.tsx` | Select dropdown + type update |
| `src/components/MilkingRecords.tsx` | Type update + badge color |
| `src/components/milk-recording/DeleteMilkRecordFromProfileDialog.tsx` | Type update |
| `src/lib/offlineQueue.ts` | Type update |
| `src/lib/voiceFormExtractors.ts` | Type update |
| `src/hooks/useDailyActivityCompliance.ts` | Type + compliance logic |
| `src/hooks/useMissingActivityAlerts.ts` | Type update |
| `supabase/functions/_shared/stt-prompts.ts` | Add keywords |
| `supabase/functions/doc-aga/index.ts` | Update tool description |
| `docs/data-relationships-map.md` | Document new session value |
