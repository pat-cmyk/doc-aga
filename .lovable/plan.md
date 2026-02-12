

# Add Animal Search to Breeding Hub

## What It Does

Adds a search bar to the Breeding Hub (Operations > Breeding tab) that lets you search for any female animal by name or ear tag. When you select a result, a pop-out dialog shows that animal's breeding records (AI records, heat history, fertility status, lifecycle actions) with a "Go to Animal Profile" link at the bottom.

## File Changes

### 1. `src/components/breeding/BreedingAnimalSearchDialog.tsx` (NEW)

A new component with two parts:
- **Search input with results dropdown**: Filters the `animals` array from `useBreedingHub` by name or ear tag as the user types. Shows matching results in a dropdown list.
- **Breeding Record Pop-out**: When an animal is selected, opens a Dialog showing:
  - Animal name, ear tag, livestock type, and fertility status badge
  - Latest AI record details (scheduled/performed date, semen code, pregnancy status, expected delivery)
  - Latest heat detection info (last heat date)
  - Lifecycle action summary (parity, services this cycle, VWP end date)
  - A "View Full Profile" button at the bottom that navigates to `/?tab=animals&animalId={id}`

### 2. `src/components/breeding/BreedingHub.tsx` (EDIT)

- Import the new `BreedingAnimalSearchDialog` component
- Add a Search button (with Search icon) next to the existing "Record Heat" and "Schedule AI" buttons in the header
- Pass `animals` and `farmId` to the search component

### 3. `src/components/breeding/index.ts` (EDIT)

- Export the new `BreedingAnimalSearchDialog` component

## Technical Details

### Search Behavior

- Uses the `animals` array already loaded by `useBreedingHub` (no extra queries for the search itself)
- Filters client-side using case-insensitive matching on `name` and `ear_tag`
- Shows up to 10 results in a scrollable list
- Debounced or instant filter (array is small enough for instant)

### Pop-out Dialog Content

When an animal is selected from search results, a second Dialog opens with:

```
+------------------------------------------+
| [Name]  [Ear Tag]  [Fertility Badge]     |
+------------------------------------------+
| Latest AI Record                         |
|   Scheduled: 2026-01-15                  |
|   Performed: 2026-01-16                  |
|   Semen Code: ABC123                     |
|   Status: Performed / Pregnant           |
|   Expected Delivery: 2026-10-20          |
+------------------------------------------+
| Breeding Info                            |
|   Last Heat: 2026-01-10                  |
|   Parity: 3                              |
|   Services This Cycle: 2                 |
+------------------------------------------+
| [    Go to Animal Profile    ]           |
+------------------------------------------+
```

The AI records for the selected animal are fetched on-demand (single query) when the pop-out opens.

### Data Flow

```
BreedingHub
  -> animals[] (from useBreedingHub)
  -> BreedingAnimalSearchDialog
     -> Search input filters animals[]
     -> On select: fetch ai_records + heat_records for that animal
     -> Display in Dialog
     -> "View Full Profile" -> navigate('/?tab=animals&animalId=...')
```

## Files Summary

| File | Action |
|------|--------|
| `src/components/breeding/BreedingAnimalSearchDialog.tsx` | Create - search + pop-out breeding record viewer |
| `src/components/breeding/BreedingHub.tsx` | Edit - add search button to header |
| `src/components/breeding/index.ts` | Edit - export new component |

