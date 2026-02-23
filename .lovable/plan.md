
# Wire Barn/Paddock Options into All Recording Dropdowns

## Problem

The `getAnimalDropdownOptions` function in both `useFarmAnimals.ts` and `useLactatingAnimals.ts` already accepts an optional `barns` parameter and generates `barn:{id}` quick-select options. However, none of the 5 dialog components that call this function actually pass barns -- so the barn options never appear in the dropdown.

## Solution

Each dialog that uses `getAnimalDropdownOptions` needs to:
1. Import and call `useBarns(farmId)` to fetch the farm's barns
2. Pass the barns array as the second argument to `getAnimalDropdownOptions`

This is a straightforward wiring fix -- no new components, no schema changes, no new logic.

## Files to Change

| File | Change |
|------|--------|
| `src/components/feed-recording/RecordBulkFeedDialog.tsx` | Import `useBarns`, fetch barns, pass to `getAnimalDropdownOptions(dateFilteredAnimals, barns)` |
| `src/components/milk-recording/RecordBulkMilkDialog.tsx` | Same pattern |
| `src/components/health-recording/RecordBulkHealthDialog.tsx` | Same pattern |
| `src/components/body-condition/RecordBulkBCSDialog.tsx` | Same pattern |
| `src/components/approval/EditSubmissionDialog.tsx` | Same pattern (uses `animals` directly, not `dateFilteredAnimals`) |

## Expected Result

The Quick Select section in every recording dialog will show:

```
Quick Select:
  All Animals (10)
  All Cattle (8)
  All Goat (2)
  Barn A (6)          <-- NEW
  Paddock 2 (4)       <-- NEW

Individual Animals:
  Bessie (350 kg)
  ...
```

Selecting a barn option filters to only animals with `current_barn_id` matching that barn -- this logic already exists in `getSelectedAnimals`.

## Technical Details

Each file gets the same 3-line addition:

1. Add import: `import { useBarns } from "@/hooks/useBarns";`
2. Add hook call: `const { data: barns = [] } = useBarns(farmId);`
3. Pass barns: change `getAnimalDropdownOptions(animals)` to `getAnimalDropdownOptions(animals, barns)`

The `useMemo` dependency arrays for `dropdownOptions` will also need `barns` added so options update when barns load.
