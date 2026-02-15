

# Audit: Add vs Edit Animal Form Parity + SSOT Documentation

## Audit Summary

I compared the three animal forms side-by-side: **Add Animal** (`AnimalForm.tsx`), **Edit Animal** (`EditAnimalDialog.tsx`), and **Admin Animal** (`AdminAnimalDialog.tsx`). Below are the parity gaps, shared-component opportunities, and documentation updates needed.

---

## Parity Gaps Found

### 1. Add Form: Breed dropdown missing "No Data / Walang Data" option
- **Edit form** has it (line 250). **Add form** (line 848) does NOT.
- Fix: Add `<SelectItem value="no_data">No Data / Walang Data</SelectItem>` to Add form breed Select.

### 2. Add Form: AI Bull Breed shown only for offspring, not new entrants
- **Add form** (line 1057): `ai_bull_breed` Select is wrapped in `{formData.animal_type === "offspring" && ...}`, so new entrants who selected AI father cannot record the bull breed.
- **Edit form** (line 483): Shows `ai_bull_breed` always when `is_father_ai` is true. Correct.
- Fix: Remove the `offspring`-only guard on the AI Bull Breed field in Add form. Show it whenever `is_father_ai` is true.

### 3. Add Form: AI Bull Breed uses raw breed list without "No Data" option
- **Edit form** has "No Data / Walang Data" in the AI Bull Breed Select.
- **Add form** does not.
- Fix: Add the "No Data" option to the Add form's AI Bull Breed Select.

### 4. Add Form: Mix Breed sub-selects missing "No Data" option
- **Edit form** breed1/breed2 Selects do NOT have "No Data" either (lines 273, 290).
- **Add form** breed1/breed2 also lack it (lines 869, 887).
- Fix: Both forms should NOT have "No Data" here since both breeds are required when Mix Breed is selected. No change needed -- validation enforces this correctly.

### 5. Edit Form: AI Bull Breed "no_data" value not mapped to empty string
- **Edit form** (line 485): `onValueChange` sets `ai_bull_breed` directly without mapping `"no_data"` to `""`.
- Fix: Add the same mapping: `value === "no_data" ? "" : value`.

### 6. Admin Form: Missing AI bull fields entirely
- `AdminAnimalDialog.tsx` has no AI bull support (brand, reference, breed).
- This is acceptable since admin adds are simplified. No change needed for now.

### 7. Add Form: Father dropdown AI option label inconsistency
- **Add form** (line 1027): `"Artificial Insemination / AI"`
- **Edit form** (line 453): `"AI / Artificial Insemination"` with emoji
- Fix: Standardize to the Edit form's version with emoji in both.

### 8. Edit Form: `useEditAnimalForm` does not load existing AI records
- Line 210: `is_father_ai` is hardcoded to `false` with comment "Will need to detect from AI records if needed".
- This means editing an animal that was created via AI will show father as "None" instead of "AI".
- Fix: Query `ai_records` table for the animal on form load and pre-populate AI fields.

---

## Shared Component Reuse Opportunities (DRY/SSOT)

Both forms already share:
- `GenderSelector` component
- `LactatingToggle` component
- `BilingualLabel` component
- `WeightHintBadge` component
- `LIVESTOCK_BREEDS` / `getBreedsByLivestockType` constants
- `calculateMilkingStageFromDays` function

No new shared components needed -- the existing reuse is good.

---

## Implementation Plan

### Task 1: Fix Add Form parity gaps
**File: `src/components/AnimalForm.tsx`**
- Add "No Data / Walang Data" option to breed Select (line ~848)
- Remove `offspring`-only guard from AI Bull Breed (line 1057), show for all animal types when AI is selected
- Add "No Data" option to AI Bull Breed Select
- Standardize AI option label to match Edit form: `"AI / Artificial Insemination"` with emoji

### Task 2: Fix Edit Form AI breed mapping
**File: `src/components/animal-details/EditAnimalDialog.tsx`**
- Map `"no_data"` to `""` in AI Bull Breed `onValueChange` handler (line 485)

### Task 3: Load existing AI records in Edit form
**File: `src/components/animal-details/hooks/useEditAnimalForm.ts`**
- In the `useEffect` that initializes form data (line 190), add a query to `ai_records` table for the animal
- If an AI record exists, set `is_father_ai: true` and populate `ai_bull_brand`, `ai_bull_reference`, `ai_bull_breed` from the record's `notes` and `semen_code` fields

### Task 4: Update existing test
**File: `src/components/AnimalForm.test.tsx`**
- Add test case: "should show AI bull breed field for new entrant with AI father"
- Add test case: "breed dropdown should include No Data option"

### Task 5: Update DRM with Change History entry + SSOT Architecture section
**File: `docs/data-relationships-map.md`**
- Add **Entry 10: Add/Edit Animal Form SSOT Parity Alignment** documenting:
  - Fields aligned (breed no-data, AI bull breed visibility, AI label standardization)
  - AI record loading on edit
  - Component reuse inventory (GenderSelector, LactatingToggle, BilingualLabel, etc.)

**New File: `docs/ssot-architecture.md`**
- Create a standalone SSOT Architecture reference containing Section 5 from the knowledge prompt:
  - Dataset Dependency & Continuity Standards
  - Component Reuse (DRY) rules
  - Key SSOT Data Flows table (Milk Revenue, Animal Weight, OVR, Feed, Parent Eligibility)
  - Governance Documents list (DRM, ARCHITECTURE.md, changelog)
  - Role-Based Access SSOT

---

## Files to Change

| File | Changes |
|------|---------|
| `src/components/AnimalForm.tsx` | Add "No Data" to breed Select; show AI Bull Breed for all types; add "No Data" to AI breed; standardize AI label |
| `src/components/animal-details/EditAnimalDialog.tsx` | Fix AI breed "no_data" mapping |
| `src/components/animal-details/hooks/useEditAnimalForm.ts` | Load AI records on init; populate AI fields |
| `src/components/AnimalForm.test.tsx` | Add 2 test cases for parity |
| `docs/data-relationships-map.md` | Add Entry 10 changelog |
| `docs/ssot-architecture.md` | New file: SSOT Architecture reference |

