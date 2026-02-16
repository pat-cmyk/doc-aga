

# Add "Source Farm" Field to Edit Animal Dialog + DRM Update

## What This Does

Adds the **"Source Farm / Pinagmulan na Farm"** text field to the "Edit All Details" dialog (`EditAnimalDialog.tsx`) for SSOT form parity with the Add Animal form and the quick-edit Acquisition dialog. Also documents the `source_farm` column in the DRM.

## Current State

- The `source_farm` field already exists in the database, the `useEditAnimalForm` hook (state, initialization, and submit logic), and in both the Add Animal form and the quick-edit `EditAcquisitionWeightDialog`.
- **Gap**: The "Edit All Details" dialog (`EditAnimalDialog.tsx`) renders the acquisition section (lines 559-652) but does NOT include the `source_farm` input field.
- **Gap**: The DRM does not document the `source_farm` column.

## Changes (2 files)

### 1. `src/components/animal-details/EditAnimalDialog.tsx`

Add a `source_farm` Input field inside the acquisition section (after the Purchase Price field for "purchased" and after the Grant Source fields for "grant"), visible for both acquisition types. Placement: just before the closing `</div>` of the acquisition `bg-muted/30` container (line 649).

```tsx
{/* Source Farm - shown for both purchased and grant */}
<div className="space-y-2">
  <BilingualLabel english="Source Farm" filipino="Pinagmulan na Farm" htmlFor="edit-source-farm" />
  <Input
    id="edit-source-farm"
    value={formData.source_farm}
    onChange={(e) => setFormData(prev => ({ ...prev, source_farm: e.target.value }))}
    placeholder="Enter farm name / Ilagay ang pangalan ng farm"
  />
</div>
```

This mirrors the exact same label, placeholder, and binding used in `AnimalForm.tsx` (line 835) and `EditAcquisitionWeightDialog.tsx`.

### 2. `docs/data-relationships-map.md`

Add `source_farm` to the `animals` table schema (after `grant_source_other`, around line 186):

```
| `source_farm` | text | YES | --- | Name of farm where animal was sourced (purchased/grant) |
```

Update the "Last updated" date and add a changelog entry.

## SSOT Data Flow (Complete)

```
animals.source_farm (DB column)
       |
       v
useAnimalForm.ts (Add form hook) -- DONE
useEditAnimalForm.ts (Edit form hook) -- DONE
       |
       v
AnimalForm.tsx (Add form UI) -- DONE
EditAnimalDialog.tsx (Edit All Details UI) -- THIS CHANGE
EditAcquisitionWeightDialog.tsx (Quick-edit dialog UI) -- DONE
       |
       v
DRM documentation -- THIS CHANGE
```

## No Database or Hook Changes Needed

The column exists, and the hook already reads/writes `source_farm`. This is purely a UI + documentation update.
