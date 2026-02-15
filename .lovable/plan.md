

# App-Wide Dropdown Text Alignment and Cleanup

## Overview

This plan standardizes all "no data / unknown" text across every dropdown and form field to a single consistent label: **"No Data / Hindi Alam"**, removes the redundant "Not Sure" breed option, and removes the "Unknown / Hindi Alam" checkboxes above dropdowns that already contain a no-data option in the dropdown itself.

---

## Current State (Inconsistencies Found)

| Current Text | Where Used | Count |
|---|---|---|
| "No Data / Walang Data" | Breed dropdowns, AI bull breed, entry weight checkbox | 5 instances |
| "Unknown / Hindi Alam" | Birth date checkbox, mother checkbox, father checkbox | 6 instances |
| "None / Wala" | Mother/Father parent dropdowns | 4 instances |
| "Not Sure" | First option in all 4 breed arrays (livestockBreeds.ts) | 4 instances |

---

## Target State

All dropdown "empty" options and checkbox labels will use a single SSOT label:

- **Dropdown default/empty option:** `"No Data / Hindi Alam"`
- **"Not Sure"** in breed lists: **Removed** (redundant -- the dropdown already has "No Data / Hindi Alam")
- **"None / Wala"** in parent dropdowns: Changed to `"No Data / Hindi Alam"`
- **Checkboxes for mother/father "Unknown":** **Removed** (the dropdown itself already has "No Data / Hindi Alam", so the checkbox is redundant and confusing, as shown in the user's screenshot)
- **Birth date "Unknown" checkbox:** **Kept** -- this is NOT a dropdown, it's a date input. The checkbox is the only way to indicate "no data" for a date field.
- **Entry weight "No Data" checkbox:** **Kept** -- same reason, it's a numeric input, not a dropdown.

---

## Changes by File

### 1. `src/lib/livestockBreeds.ts`
- Remove `"Not Sure"` from all 4 breed arrays (cattle, goat, sheep, carabao)
- Update JSDoc comments to remove "Not Sure" references

### 2. `src/components/AnimalForm.tsx`
- Line 685: Birth date checkbox -- Change `"Unknown / Hindi Alam"` to `"No Data / Hindi Alam"`
- Line 724: Entry weight checkbox -- Change `"No Data / Walang Data"` to `"No Data / Hindi Alam"`
- Line 849: Breed Select -- Change `"No Data / Walang Data"` to `"No Data / Hindi Alam"`
- Lines 949-966: **Remove** the mother "Unknown / Hindi Alam" checkbox entirely
- Line 978: Mother dropdown "None / Wala" -- Change to `"No Data / Hindi Alam"`
- Lines 991-1009: **Remove** the father "Unknown / Hindi Alam" checkbox entirely
- Line 1027: Father dropdown "None / Wala" -- Change to `"No Data / Hindi Alam"`
- Line 1068: AI Bull Breed Select -- Change `"No Data / Walang Data"` to `"No Data / Hindi Alam"`
- Remove `mother_unknown` and `father_unknown` checkbox state references and disabled logic on the Select components

### 3. `src/components/animal-details/EditAnimalDialog.tsx`
- Line 324: Birth date checkbox -- Change `"Unknown / Hindi Alam"` to `"No Data / Hindi Alam"`
- Line 529: Entry weight checkbox -- Change `"No Data / Walang Data"` to `"No Data / Hindi Alam"`
- Line 250: Breed Select -- Change `"No Data / Walang Data"` to `"No Data / Hindi Alam"`
- Lines 384-397: **Remove** the mother "Unknown / Hindi Alam" checkbox entirely
- Line 408: Mother dropdown "None / Wala" -- Change to `"No Data / Hindi Alam"`
- Lines 422-435: **Remove** the father "Unknown / Hindi Alam" checkbox entirely
- Line 452: Father dropdown "None / Wala" -- Change to `"No Data / Hindi Alam"`
- Line 491: AI Bull Breed Select -- Change `"No Data / Walang Data"` to `"No Data / Hindi Alam"`
- Remove `mother_unknown` and `father_unknown` disabled logic on the Select components

### 4. `src/lib/filipinoLabels.ts`
- Update `unknown` label from `{ english: "Unknown", filipino: "Hindi Alam" }` to `{ english: "No Data", filipino: "Hindi Alam" }`
- Update `noData` label from `{ english: "No Data", filipino: "Walang Data" }` to `{ english: "No Data", filipino: "Hindi Alam" }`

### 5. `src/components/AnimalForm.test.tsx`
- Update test assertion from `"No Data / Walang Data"` to `"No Data / Hindi Alam"`

### 6. `docs/data-relationships-map.md`
- Add Entry 11: "App-Wide Dropdown Text Standardization" documenting the unified label and removed checkboxes

---

## What is NOT Changed

- **Birth date checkbox** -- Kept (date input has no dropdown)
- **Entry weight checkbox** -- Kept (numeric input has no dropdown)
- **Gender selector** -- No change needed (buttons, not dropdown)
- **Acquisition type** -- No change needed (radio buttons, not dropdown)
- **Admin/Government/Team forms** -- Role selectors, data mode selectors, etc. are contextual choices (not "no data" scenarios), so they stay as-is
- **Non-form "Unknown" strings** -- Display-only text like `animal.name || "Unknown"` in list views are unrelated and stay as-is

---

## Technical Details

### SSOT Constant (Optional Future Enhancement)
A single constant could be created for the label, but given it's just a string used in JSX, inline usage is simpler and grep-able. The `filipinoLabels.ts` file serves as the reference.

### Form State Impact
Removing the `mother_unknown` and `father_unknown` checkboxes means those state fields become unused. The parent dropdowns will default to showing the "No Data / Hindi Alam" option (value `"none"`) when no parent is selected, which achieves the same result without the confusing dual-control pattern.
