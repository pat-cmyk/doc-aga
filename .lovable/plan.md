

# SSOT Audit: Fix All Critical Conflicts

## Findings Summary

| # | Severity | Issue | Files Affected |
|---|----------|-------|----------------|
| 1 | **Critical** | Duplicate `calculateMilkingStageFromDays` -- two incompatible versions | 4 files |
| 2 | **Critical** | Missing `exit_date IS NULL` filter on 6 animal queries | 6 files |
| 3 | **Medium** | Dead `mother_unknown`/`father_unknown` state in form hooks | 4 files |
| 4 | **Low** | Stale JSDoc in `livestockBreeds.ts` referencing removed "Not Sure" | 1 file |
| 5 | **Low** | "Walang Data" label in `ReproClock.tsx` instead of "Hindi Alam" | 1 file |

---

## Fix 1: Unify `calculateMilkingStageFromDays` (Critical)

**Problem:** Two versions exist with different signatures and behavior:

- `LactatingToggle.tsx` version: `(days: number) => string` -- simple, 3-stage (no Dry Period)
- `animalStages.ts` version: `(startDate, estimatedDays) => string | null` -- robust, 4-stage (includes Dry Period)

The LactatingToggle version is imported by `useAnimalForm.ts`, `AnimalForm.tsx`, and `useEditAnimalForm.ts`. The animalStages version is imported by `RecordBulkMilkDialog.tsx`.

**Fix:**
- Remove `calculateMilkingStageFromDays` from `LactatingToggle.tsx` (keep it as display-only UI)
- Make `animalStages.ts` the single source of truth
- Update all 3 importers (`useAnimalForm.ts`, `AnimalForm.tsx`, `useEditAnimalForm.ts`) to import from `animalStages.ts`
- In the form hooks, call the unified version with `(null, daysInMilk)` to use the estimatedDays path
- The LactatingToggle component's internal stage preview will call the unified version too

**Files changed:**
- `src/components/animal-form/LactatingToggle.tsx` -- remove exported function, import from `animalStages.ts`
- `src/components/AnimalForm.tsx` -- change import path
- `src/components/animal-form/hooks/useAnimalForm.ts` -- change import path + call signature
- `src/components/animal-details/hooks/useEditAnimalForm.ts` -- change import path + call signature

---

## Fix 2: Add Missing `exit_date IS NULL` Filters (Critical)

Per the active-animal-filtering standard, ALL animal-list queries must enforce `is_deleted = false AND exit_date IS NULL`.

**Missing locations found:**

| File | Line | Query Purpose |
|------|------|---------------|
| `src/pages/Dashboard.tsx` | ~330 | Feed forecast animal query |
| `src/components/AnimalDetails.tsx` | ~389 | Offspring list query |
| `src/lib/dataCache.ts` | ~761 | Livestock type aggregation |
| `src/components/QueueStatus.tsx` | ~44 | Animal list for queue display |
| `src/hooks/useBreedingAnalytics.ts` | ~109 | Breeding analytics animal query |
| `src/hooks/useFarmerFeedback.ts` | ~82 | Animal count for feedback |
| `src/components/CacheDebugPanel.tsx` | ~131 | Debug livestock type query |
| `src/components/farmhand/VoiceRecordButton.tsx` | ~413 | Fetch selected animals by ID |

**Fix:** Add `.is('exit_date', null)` to each query. One line per file.

**Note on special cases:**
- `VoiceRecordButton.tsx` line 413: This fetches by specific IDs (`.in('id', selection)`), so an exited animal would only appear if explicitly selected -- low risk, but adding the filter maintains consistency.
- `AnimalDetails.tsx` offspring query: For offspring listing, exited offspring are still valid historical data. However, the offspring count is used for stage calculation (`offspringCount`), so we should NOT filter exit_date on the offspring query -- exited calves still count as offspring. **This one stays as-is.**

**Revised list (7 files, excluding AnimalDetails offspring):**

---

## Fix 3: Remove Dead `mother_unknown`/`father_unknown` State (Medium)

The UI checkboxes were removed in the previous plan, but the state fields remain in the form hooks and are still referenced in submit logic.

**Problem:** `mother_unknown` and `father_unknown` fields exist in:
- `useAnimalForm.ts` (interface + initial state + submit logic)
- `useEditAnimalForm.ts` (interface + initial state + submit logic + reset logic)
- `AnimalForm.tsx` (local state initialization + submit references)

They are also columns in the `animals` database table and shown in `AnimalDetails.tsx` display. Since the database columns exist and other animals may already have `mother_unknown = true`, we need to handle this carefully:

**Fix approach:**
- Keep the database columns (backward compatible, data integrity)
- Remove from form state interfaces and initial state in `useAnimalForm.ts` and `useEditAnimalForm.ts`
- In submit logic, set `mother_unknown: false` and `father_unknown: false` always (since the "No Data / Hindi Alam" dropdown option with value `"none"` now handles this)
- The `AnimalDetails.tsx` display logic that checks `animal?.mother_unknown` stays -- it correctly shows "No Data / Hindi Alam" for historical records
- Remove from `AnimalForm.tsx` local state

---

## Fix 4: Stale JSDoc in `livestockBreeds.ts` (Low)

Line 6 still says `"Not Sure" and "Mix Breed" options accommodate farmers...` but "Not Sure" was removed.

**Fix:** Update comment to only reference "Mix Breed".

Also line 121 JSDoc example shows `// ['Not Sure', 'Boer', ...]` -- update to `// ['Boer', 'Saanen', ...]`.

---

## Fix 5: "Walang Data" in `ReproClock.tsx` (Low)

Line 178: `Walang Data ng Siklo` should be `Hindi Alam ang Data ng Siklo` or simply `No Data / Hindi Alam` per standard.

**Fix:** Change to `No Data ng Siklo` (keeps it natural in Filipino context while using the standardized "No Data" prefix).

---

## Implementation Order

1. Fix 1 (Unify milking stage function) -- highest impact, touches form submission logic
2. Fix 2 (exit_date filters) -- data correctness
3. Fix 3 (Dead state cleanup) -- code hygiene
4. Fix 4 + 5 (Label/doc cleanup) -- low risk

## Governance

- Update `docs/data-relationships-map.md` with Entry 12 documenting all SSOT fixes
- Update `docs/ssot-architecture.md` Shared Components Inventory to remove `calculateMilkingStageFromDays` from LactatingToggle row
- Update `changelog.md`

