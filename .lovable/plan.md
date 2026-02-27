

# Remove Duplicate "Record Heat" and "Schedule AI" Buttons from Breeding Timeline Header

## Problem

The "Record Heat" and "Schedule AI" buttons appear twice: once in the Breeding Timeline card header and again in the Lifecycle Actions card below it. This is redundant.

## Fix

Remove the `headerActions` prop from the `BreedingTimeline` component in `AIRecords.tsx` (lines 77-93). The timeline will render with just the title, and users will use the Lifecycle Actions card for all milestone triggers.

## File Changed

| File | Change |
|------|--------|
| `src/components/AIRecords.tsx` | Remove `headerActions` prop from `BreedingTimeline` (lines 77-93) |

Single-line change -- replace the current `BreedingTimeline` call with one that has no `headerActions`.

