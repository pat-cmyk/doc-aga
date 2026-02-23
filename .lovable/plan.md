

# Fix: Barn/Paddock Selection Resets Immediately

## Root Cause

All 4 recording dialogs have a `useEffect` that resets the animal selection when the date changes. The guard condition only exempts `'all'` and `'species:'` prefixes -- it does NOT exempt the `'barn:'` prefix. So when you select "Goat House (2)", the effect immediately runs, sees `"barn:6f1a..."` doesn't match any animal ID, and clears the selection back to empty.

## Fix

Add `!selectedOption.startsWith('barn:')` to the guard in all 4 files:

**Before:**
```
if (selectedOption && selectedOption !== 'all' && !selectedOption.startsWith('species:')) {
```

**After:**
```
if (selectedOption && selectedOption !== 'all' && !selectedOption.startsWith('species:') && !selectedOption.startsWith('barn:')) {
```

## Files to Change

| File | Line | Change |
|------|------|--------|
| `src/components/feed-recording/RecordBulkFeedDialog.tsx` | ~145 | Add barn prefix guard |
| `src/components/milk-recording/RecordBulkMilkDialog.tsx` | ~127 | Add barn prefix guard |
| `src/components/health-recording/RecordBulkHealthDialog.tsx` | ~105 | Add barn prefix guard |
| `src/components/body-condition/RecordBulkBCSDialog.tsx` | ~149 | Add barn prefix guard |

One-line fix per file, no other changes needed. The `getSelectedAnimals` function already handles the `barn:` prefix correctly -- the selection was just being cleared before it could take effect.
