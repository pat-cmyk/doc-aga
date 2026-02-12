
# Merge "Waiting", "Preg Check", and "Suspected" into a Single Card

## What Changes

The three middle status boxes -- Waiting, Preg Check, and Suspected -- will be combined into one card labeled **"Bred"** (or similar). This reduces the grid from 8 cards to 6, simplifying the overview.

## How It Works

- The merged card shows a combined count: `bredWaiting + pregCheckDue + suspectedPregnant`
- Clicking it opens the drill-down list showing all animals from those three statuses, with a sub-label or badge indicating which sub-status each animal belongs to (Waiting / Preg Check / Suspected)
- The tooltip will explain: "Animals that have been bred and are awaiting pregnancy confirmation"
- The card will be highlighted if `pregCheckDue > 0` (actionable items)

## Visual Result

Before (8 cards):
`Open | In Heat | Waiting | Preg Check | Suspected | Pregnant | Fresh | Not Ready`

After (6 cards):
`Open | In Heat | Bred | Pregnant | Fresh | Not Ready`

## Technical Details

### 1. Edit `src/components/breeding/BreedingHub.tsx`

- Add a new combined filter key `bred_pipeline` to `STATUS_FILTER_MAP` that matches animals with `bred_waiting`, `suspected_pregnant` status, or those in `pregCheckAnimalIds`
- Add a corresponding entry in `STATUS_LABELS` with label "Bred" and a suitable icon
- Replace the three separate `BreedingHubStatCard` instances (Waiting, Preg Check, Suspected) with one card using count `stats.bredWaiting + stats.pregCheckDue + stats.suspectedPregnant`
- Update the grid from `lg:grid-cols-8` to `lg:grid-cols-6`

### 2. Edit `src/components/breeding/BreedingStatusAnimalList.tsx` (minor)

- No changes needed if the drill-down list already shows `fertility_status` per animal. If not, ensure each animal row shows its sub-status so users can distinguish Waiting vs Preg Check vs Suspected within the merged list.

## Files Summary

| File | Action |
|------|--------|
| `src/components/breeding/BreedingHub.tsx` | Edit - merge 3 cards into 1, update grid layout |
| `src/components/breeding/BreedingStatusAnimalList.tsx` | Review - ensure sub-status is visible in drill-down |
