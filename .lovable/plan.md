

# Fix: "Record Heat" and "Schedule AI" Buttons Not Working in Breeding Hub

## Problem

The "Record Heat" and "Schedule AI" buttons in Operations > Breeding do nothing when clicked. This is because:

1. `Dashboard.tsx` renders `<BreedingHub farmId={farmId} />` without passing `onRecordHeat` or `onScheduleAI` callbacks
2. Both existing dialogs (`RecordHeatDialog` and `ScheduleAIDialog`) require an `animalId` upfront, so they can't be opened from a farm-level view without first selecting an animal

## Solution

Create two new farm-level dialog components that add an **animal picker step** before the existing forms, then wire them into `BreedingHub` directly (no need to pass callbacks from Dashboard).

## File Changes

### 1. `src/components/breeding/FarmRecordHeatDialog.tsx` (NEW)

A wrapper dialog with two steps:
- **Step 1 - Pick Animal:** Search/select from breeding-eligible female animals (reuses the `animals` array from `useBreedingHub`)
- **Step 2 - Record Heat:** Once selected, renders the existing heat recording form fields inline (date, detection method, intensity, standing heat, notes)

### 2. `src/components/breeding/FarmScheduleAIDialog.tsx` (NEW)

Same two-step pattern:
- **Step 1 - Pick Animal:** Search/select from breeding-eligible female animals
- **Step 2 - Schedule AI:** Renders the existing AI scheduling form fields (date, technician, semen code, notes)

### 3. `src/components/breeding/BreedingHub.tsx` (EDIT)

- Remove the `onRecordHeat`, `onScheduleAI`, `onConfirmPregnancy` props (they were never being passed)
- Import and render the two new farm-level dialogs, controlled by state (`heatDialogOpen`, `aiDialogOpen`)
- Wire the header buttons to open these dialogs
- Pass `animals` and `farmId` to the new dialogs

### 4. `src/components/breeding/index.ts` (EDIT)

- Export the two new dialog components

## Technical Details

### Animal Picker Step

Both dialogs will include a search input that filters the `animals` array by name or ear tag (same pattern as `BreedingAnimalSearchDialog`). Once an animal is selected, the dialog transitions to the form step.

```
+------------------------------------------+
| Record Heat / Schedule AI                |
+------------------------------------------+
| Step 1: Select Animal                    |
|   [Search by name or ear tag...]         |
|   - Bessie (ET-001) - Open              |
|   - Daisy (ET-003) - In Heat            |
+------------------------------------------+
|          ↓ on select ↓                   |
+------------------------------------------+
| Step 2: Fill Form                        |
|   Selected: Bessie (ET-001)  [Change]   |
|   [existing form fields...]              |
|   [Submit]                               |
+------------------------------------------+
```

### Data Flow

The new dialogs receive `animals` and `farmId` directly from `BreedingHub` -- no need to thread callbacks through Dashboard. On successful submission, they invalidate the breeding hub queries to refresh the data.

## Files Summary

| File | Action |
|------|--------|
| `src/components/breeding/FarmRecordHeatDialog.tsx` | Create - heat dialog with animal picker |
| `src/components/breeding/FarmScheduleAIDialog.tsx` | Create - AI scheduling dialog with animal picker |
| `src/components/breeding/BreedingHub.tsx` | Edit - replace callback props with self-contained dialogs |
| `src/components/breeding/index.ts` | Edit - export new components |

