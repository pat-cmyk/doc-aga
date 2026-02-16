

# Add "Source Farm" Field to Animal Acquisition

## What This Does

Adds a new open text field called **"Source Farm"** (Pinagmulan na Farm) that appears for **both** "Purchased" and "Grant" acquisition types. This lets farmers record the name of the farm where the animal originally came from.

## Technical Plan

### 1. Database Migration
Add a new nullable column `source_farm` (text) to the `animals` table.

```sql
ALTER TABLE public.animals ADD COLUMN source_farm text;
```

### 2. SSOT Data Flow

```text
animals.source_farm (DB column)
       |
       v
AnimalFormData / useAnimalForm.ts (Add form state)
useEditAnimalForm.ts (Edit form state)
EditAcquisitionWeightDialog.tsx (Edit acquisition dialog state)
       |
       v
AnimalForm.tsx (Add form UI - new Input field)
EditAnimalDialog sections (Edit form UI)
EditAcquisitionWeightDialog.tsx (Quick-edit dialog UI)
       |
       v
AnimalProfile.tsx (Display - optional, shows source farm in details)
```

### 3. Files to Modify (7 files)

| File | Change |
|------|--------|
| **`src/components/animal-form/hooks/useAnimalForm.ts`** | Add `source_farm: string` to `AnimalFormData` interface, initialize to `""`, include in `animalData` payload (only for new entrants when acquisition_type is purchased or grant) |
| **`src/components/AnimalForm.tsx`** | Add `source_farm` to initial state and `resetForm()`. Add a new `Input` field inside the acquisition section (line ~829), shown when acquisition_type is either "purchased" or "grant" |
| **`src/components/animal-details/hooks/useEditAnimalForm.ts`** | Add `source_farm` to `EditAnimalFormData` interface, `AnimalData` interface, initial state, `loadAnimalData`, and `saveChanges` |
| **`src/components/animal-details/EditAcquisitionWeightDialog.tsx`** | Add `source_farm` to `currentValues` interface, local state, and save logic. Add Input field in the form |
| **`src/components/animal-details/hooks/useAnimalDetails.ts`** | Add `source_farm` to the `Animal` interface (data already fetched via `select("*")`) |
| **`src/components/animal-form/VoiceQuickAdd.tsx`** | Add `source_farm` to the voice-parsed data interface (optional, nullable) |
| **`docs/data-relationships-map.md`** | Document the new column in the animals table schema |

### 4. UI Placement

The new field appears **inside** the acquisition section, just below the Purchase Price (for purchased) or Grant Source (for grant) fields:

- Label: **"Source Farm / Pinagmulan na Farm"** (using BilingualLabel)
- Input placeholder: `"Enter farm name / Ilagay ang pangalan ng farm"`
- Optional field (not required)
- Visible for both `purchased` and `grant` acquisition types

### 5. Form Parity (Add = Edit)

Both the Add Animal form (`AnimalForm.tsx`) and Edit Animal form (`useEditAnimalForm.ts` + `EditAcquisitionWeightDialog.tsx`) will have the same field, same label, and same behavior -- maintaining SSOT form parity as required by architecture standards.

