

# Merge AI Records + Heat Detection into Unified Breeding Timeline

## Overview

Replace the current two-tab layout (AI Records | Heat Detection) with a single unified breeding timeline that shows all reproductive events in chronological order, plus a complete set of lifecycle action buttons so farmers can trigger any milestone with one tap.

## Current Problems

1. **Fragmented view**: AI records and heat records are in separate tabs -- farmers must switch between them to understand the breeding story
2. **BreedingTimeline component exists but is unused** in the animal profile -- it already merges data from `breeding_events`, `heat_records`, and `ai_records` into a unified timeline
3. **Missing lifecycle actions**: The current buttons only cover 4 of 8 possible milestones. Missing: Record Heat, Schedule AI, Confirm Pregnancy, Pregnancy Failed

## Design

The AI/Breeding tab will show:

```text
+--------------------------------------------------+
| Breeding Timeline          [+ Record Heat] [+ Schedule AI] |
|                                                    |
| -- February 2026 --                               |
|  o  Heat Detected          Feb 15                 |
|  o  AI Performed           Feb 16                 |
|  o  Non-Return             Mar 5                  |
|                                                    |
| -- January 2026 --                                |
|  o  VWP Ended              Jan 10                 |
|                                                    |
+--------------------------------------------------+
| Lifecycle Actions                                  |
| [Record Heat] [Schedule AI] [Record Calving]      |
| [Suspected Pregnant] [Confirm Pregnancy]           |
| [Pregnancy Failed] [Heat Returned] [VWP Complete] |
+--------------------------------------------------+
```

## Implementation Steps

### Step 1: Enhance BreedingTimeline to include full legacy data

File: `src/components/breeding/BreedingTimeline.tsx`

Currently, the legacy query only fetches heat and AI records when `breeding_events` is empty. Change it to **always** merge all three sources (breeding_events + heat_records + ai_records), deduplicating by related record IDs. This ensures the timeline is complete even during the transition period where some events only exist in legacy tables.

Also enhance the legacy AI record conversion to include scheduled (not yet performed) AI records, and add richer metadata display (technician, semen code, intensity, detection method).

Add action buttons in the card header: "Record Heat" and "Schedule AI" for quick access.

### Step 2: Rewrite AIRecords.tsx to use unified layout

File: `src/components/AIRecords.tsx`

- Remove the two-tab layout (AI Records | Heat Detection)
- Replace with: BreedingTimeline component (the merged timeline)
- Below it: Lifecycle Actions card with ALL 8 milestone buttons
- Keep the EditAIRecordDialog for editing existing AI records (triggered from timeline items)

### Step 3: Add missing lifecycle action buttons

File: `src/components/breeding/BreedingEventActions.tsx`

Add three new action button components:
- **RecordHeatButton**: Wraps the existing `RecordHeatDialog` in a consistent button style
- **ScheduleAIButton**: Wraps the existing `ScheduleAIDialog` in a consistent button style  
- **ConfirmPregnancyButton**: Standalone pregnancy confirmation (without requiring an AI record context -- inserts a `pregnancy_confirmed` breeding event directly)
- **PregnancyFailedButton**: Records a `pregnancy_failed` event using the same generic dialog pattern

### Step 4: Export new components

File: `src/components/breeding/index.ts`

Add exports for the new action button components.

## Files Modified

| File | Change |
|------|--------|
| `src/components/breeding/BreedingTimeline.tsx` | Always merge all 3 data sources, add richer display, action buttons in header |
| `src/components/AIRecords.tsx` | Replace two-tab layout with BreedingTimeline + full lifecycle actions card |
| `src/components/breeding/BreedingEventActions.tsx` | Add RecordHeatButton, ScheduleAIButton, ConfirmPregnancyButton, PregnancyFailedButton |
| `src/components/breeding/index.ts` | Export new components |

## SSOT Compliance

- No new data sources -- reuses existing `breeding_events`, `heat_records`, `ai_records` tables
- All action buttons use `insertBreedingEvent()` which feeds the DB trigger state machine
- Legacy dialogs (ScheduleAIDialog, RecordHeatDialog, ConfirmPregnancyDialog) are reused, not duplicated
- BreedingTimeline uses TanStack Query with proper cache keys, consistent with offline-first pattern
- No new tables, RPCs, or triggers needed

## Lifecycle Actions Completeness Audit

| Milestone | Event Type | Current | After |
|-----------|-----------|---------|-------|
| Record Heat | `heat_detected` | Hidden in Heat tab | Lifecycle button |
| Schedule AI | `ai_scheduled` | Hidden in AI header | Lifecycle button |
| Mark AI Performed | `ai_performed` | Inline on AI card | Inline on timeline (kept) |
| Suspected Pregnant | `non_return` | Lifecycle button | Lifecycle button |
| Confirm Pregnancy | `pregnancy_confirmed` | Inline on AI card | Lifecycle button + inline |
| Pregnancy Failed | `pregnancy_failed` | Not available | Lifecycle button (new) |
| Record Calving | `calving` | Lifecycle button | Lifecycle button |
| Heat Returned | `heat_return` | Lifecycle button | Lifecycle button |
| VWP Complete | `vwp_ended` | Lifecycle button | Lifecycle button |

