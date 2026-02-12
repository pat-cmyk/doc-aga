

# Option D: Mount BreedingHub + Animal-Level Breeding Actions

## Overview

Two integration points:
1. **Operations tab** -- add "Breeding" as a 3rd sub-tab alongside Milk and Feed, rendering `BreedingHub`
2. **Animal AI/Breeding tab** -- add `RecordCalvingDialog` and `BreedingEventActions` buttons to `AIRecords.tsx`

---

## Changes

### File 1: `src/pages/Dashboard.tsx`

- Import `BreedingHub` from `@/components/breeding`
- Add a 3rd `TabsTrigger` for `"breeding"` in the Operations sub-tabs (after Feed Stock)
- Add corresponding `TabsContent` rendering `<BreedingHub farmId={farmId} />`
- Update the URL deep-linking logic to recognize `subtab=breeding`

### File 2: `src/components/AIRecords.tsx`

- Import `RecordCalvingDialog`, `MarkNonReturnButton`, `RecordHeatReturnButton`, `MarkVWPEndedButton` from `@/components/breeding`
- Add a new `livestockType` prop (passed through from AnimalDetails)
- Below the AI records list (inside the female layout), add a "Lifecycle Actions" section with:
  - `RecordCalvingDialog` button (always shown for females with farmId)
  - `MarkNonReturnButton` -- contextual action
  - `RecordHeatReturnButton` -- contextual action  
  - `MarkVWPEndedButton` -- contextual action
- These are rendered as a horizontal button row wrapped in a Card with title "Lifecycle Actions"

### File 3: `src/components/AnimalDetails.tsx`

- Pass `livestockType` prop to `AIRecords` (already has `animal.livestock_type` available)

### File 4: `docs/data-relationships-map.md`

- Add Entry 7 documenting the two new integration points

---

## Technical Details

### Operations Sub-tab Addition (Dashboard.tsx)

```text
TabsList:
  [Milk Inventory] [Feed Stock] [Breeding]   <-- NEW

TabsContent value="breeding":
  <BreedingHub farmId={farmId} />
```

Deep-link support: `/?tab=operations&subtab=breeding` will navigate directly to the Breeding Hub.

### Animal-Level Actions (AIRecords.tsx)

The lifecycle actions section will appear below the existing AI Records/Heat Detection tabs for female animals:

```text
+------------------------------------------+
| AI Records / Heat Detection    [tabs]    |
|   ... existing content ...               |
+------------------------------------------+
| Lifecycle Actions                        |
| [Record Calving] [Suspected Pregnant]    |
| [Heat Returned]  [VWP Complete]          |
+------------------------------------------+
```

All buttons pass `animalId`, `farmId`, `animalName`, `livestockType`, and `onSuccess={loadRecords}` so the view refreshes after any action.

### Props Flow

```text
AnimalDetails.tsx
  -> animal.livestock_type
  -> AIRecords (new prop: livestockType)
    -> RecordCalvingDialog (animalId, farmId, animalName, livestockType)
    -> MarkNonReturnButton (animalId, farmId, animalName)
    -> RecordHeatReturnButton (animalId, farmId, animalName)
    -> MarkVWPEndedButton (animalId, farmId, animalName)
```

## Files Modified

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Add Breeding sub-tab + deep-link support |
| `src/components/AIRecords.tsx` | Add lifecycle action buttons section |
| `src/components/AnimalDetails.tsx` | Pass `livestockType` to AIRecords |
| `docs/data-relationships-map.md` | Entry 7: UI integration points |
