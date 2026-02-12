
# Add Tooltip Definitions to Breeding Hub Stat Cards

## What Changes

Each of the 8 status boxes (Open, In Heat, Waiting, Preg Check, Suspected, Pregnant, Fresh, Not Ready) will show a tooltip on hover explaining what that status means.

The definitions already exist in `src/types/fertility.ts` -- for example, "In Heat" = "Optimal breeding window active", "Open" = "Eligible, awaiting heat detection", etc.

## How It Works

- Wrap each stat card button in a Tooltip (same pattern used elsewhere in the app with `DefinitionBadge`)
- Hovering over any card will show a short English + Tagalog description

## Technical Details

### 1. Edit `src/components/breeding/BreedingHubStatCard.tsx`

- Add a `description` prop (and optional `descriptionTagalog` prop) to the component
- Wrap the existing button with a `Tooltip` from the existing Radix tooltip components
- Display the description text in the tooltip content

### 2. Edit `src/components/breeding/BreedingHub.tsx`

- Pass `description` (and `descriptionTagalog`) to each `BreedingHubStatCard` using values from `FERTILITY_STATUS_CONFIG`
- For the "Preg Check" card (which isn't a fertility status), add a manual description: "28-35 days post-AI, needs pregnancy verification"

## Files Summary

| File | Action |
|------|--------|
| `src/components/breeding/BreedingHubStatCard.tsx` | Edit - add tooltip with description prop |
| `src/components/breeding/BreedingHub.tsx` | Edit - pass description strings to each card |
