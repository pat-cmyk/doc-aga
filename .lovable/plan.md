
# Fix: Filter Animals by Farm Entry Date in Bulk Recording Dialogs

## Problem Summary

When recording bulk activities (feed, milk, health, BCS) for a past date, animals are incorrectly included if their `farm_entry_date` is **after** the selected recording date. The system only checks `birth_date` (which can be much earlier), allowing records to be created for animals that weren't physically on the farm yet.

**Example from your data:**
| Animal | birth_date | farm_entry_date | Feeding Date | Problem |
|--------|------------|-----------------|--------------|---------|
| Olens Main | 2025-01-28 | 2026-01-28 | 2026-01-08 | Fed 20 days BEFORE entering farm |

## Root Cause

1. `useFarmAnimals` hook fetches all active animals without date filtering
2. Bulk dialogs use `getSelectedAnimals()` which doesn't consider the selected record date
3. Single-animal dialogs correctly use `validateRecordDate()`, but bulk dialogs don't

## Solution

Create a date-aware animal filtering function and apply it in all bulk recording dialogs. When a user selects a backdated record date, only animals that were on the farm on that date should be available for selection.

### Technical Approach

**Option A (Selected):** Filter at the component level after selection
- Add a filtering step in each bulk dialog that removes animals not yet on farm
- More visible logic, easier to debug
- Maintains existing hook structure

**Option B:** Create a date-aware variant of the hook
- Would require refactoring multiple hooks
- More invasive change

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/recordValidation.ts` | Add `filterAnimalsByFarmDate()` utility function |
| `src/components/feed-recording/RecordBulkFeedDialog.tsx` | Filter animals based on `recordDate` |
| `src/components/milk-recording/RecordBulkMilkDialog.tsx` | Filter animals based on `recordDate` |
| `src/components/health-recording/RecordBulkHealthDialog.tsx` | Filter animals based on `recordDate` |
| `src/components/body-condition/RecordBulkBCSDialog.tsx` | Filter animals based on `recordDate` |
| `src/hooks/useFarmAnimals.ts` | Add `farm_entry_date` and `birth_date` to the query |

## Implementation Details

### 1. Add Filtering Utility (`src/lib/recordValidation.ts`)

```typescript
export interface AnimalWithDates {
  id: string;
  farm_entry_date?: string | null;
  birth_date?: string | null;
  [key: string]: any; // Allow other animal properties
}

/**
 * Filters animals to only include those that were on the farm
 * on the specified date.
 * 
 * Logic:
 * - If farm_entry_date exists: animal must have entered on or before recordDate
 * - If no farm_entry_date (farm-born): use birth_date, must be on or before recordDate
 * - If neither date exists: include animal (defensive - shouldn't happen)
 */
export function filterAnimalsByFarmDate<T extends AnimalWithDates>(
  animals: T[],
  recordDate: Date
): T[] {
  const recordDateOnly = new Date(recordDate);
  recordDateOnly.setHours(0, 0, 0, 0);

  return animals.filter(animal => {
    // Determine the earliest date this animal was on the farm
    const effectiveDate = animal.farm_entry_date || animal.birth_date;
    
    if (!effectiveDate) {
      // No date info - include by default (edge case)
      return true;
    }

    const animalDate = new Date(effectiveDate);
    animalDate.setHours(0, 0, 0, 0);

    // Animal must have been on farm on or before the record date
    return animalDate <= recordDateOnly;
  });
}
```

### 2. Update `useFarmAnimals` Hook

Add `farm_entry_date` and `birth_date` to the select query so filtering can work:

```typescript
const { data, error } = await supabase
  .from('animals')
  .select('id, name, ear_tag, livestock_type, current_weight_kg, entry_weight_kg, entry_weight_unknown, birth_weight_kg, farm_entry_date, birth_date')
  .eq('farm_id', farmId)
  .is('exit_date', null)
  .eq('is_deleted', false)
  .order('name');
```

### 3. Update Bulk Feed Dialog

```typescript
// After selecting animals, filter by record date
const dateFilteredAnimals = useMemo(() => {
  return filterAnimalsByFarmDate(displayAnimals, recordDate);
}, [displayAnimals, recordDate]);

// Use filtered list for dropdown options
const dropdownOptions = useMemo(
  () => getAnimalDropdownOptions(dateFilteredAnimals),
  [dateFilteredAnimals]
);

// Use filtered list for selection
const selectedAnimals = useMemo(
  () => getSelectedAnimals(dateFilteredAnimals, selectedOption),
  [dateFilteredAnimals, selectedOption]
);
```

### 4. Apply Same Pattern to Other Bulk Dialogs

- `RecordBulkMilkDialog.tsx`
- `RecordBulkHealthDialog.tsx`
- `RecordBulkBCSDialog.tsx`

### 5. Reset Selection When Filtered List Changes

When the record date changes and an animal is filtered out, the selection should reset:

```typescript
// Reset selection if current selection is no longer valid
useEffect(() => {
  if (selectedOption && selectedOption !== 'all' && !selectedOption.startsWith('species:')) {
    // Individual animal selected - check if still in filtered list
    const stillExists = dateFilteredAnimals.some(a => a.id === selectedOption);
    if (!stillExists) {
      setSelectedOption("");
    }
  }
}, [dateFilteredAnimals, selectedOption]);
```

## User Experience Improvements

1. **Dynamic Animal Count**: When backdating, the "All Animals (X)" count will reflect only animals present on that date
2. **Clear Feedback**: If an animal disappears from the list when changing date, this indicates they weren't on farm yet
3. **Consistent Behavior**: Bulk dialogs will match single-animal dialog validation

## Testing Checklist

After implementation:
1. Open Bulk Feed Dialog
2. Select a past date (e.g., 2 weeks ago)
3. Verify animals with `farm_entry_date` after that date are NOT shown
4. Verify farm-born animals (no `farm_entry_date`) use `birth_date` instead
5. Verify "All Animals" count updates when changing dates
6. Test same flow in Bulk Milk, Bulk Health, and Bulk BCS dialogs
7. Confirm existing single-animal dialogs still work correctly
