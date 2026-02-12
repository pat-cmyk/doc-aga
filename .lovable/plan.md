

# Add Click-to-Drill-Down on Breeding Hub Stat Cards

## What Changes

When you click any status box (e.g., "In Heat", "Pregnant"), a popover/sheet appears showing the list of animals in that status. Clicking an animal navigates to their profile page.

## Approach

Use a Dialog (modal) that opens on stat card click, filters the `animals` array by the clicked status, and renders a clickable list. This follows the existing "smart navigation" pattern already used in the Dashboard's "Today At A Glance" section.

## File Changes

### 1. `src/components/breeding/BreedingHub.tsx`

- Add state: `selectedStatus` (string | null) to track which box was clicked
- Pass `onClick` handlers to each `BreedingHubStatCard` that set `selectedStatus`
- Render a new `BreedingStatusAnimalList` dialog when `selectedStatus` is set
- Filter `animals` array by `fertility_status === selectedStatus` (special case for "Preg Check" which uses `bred_waiting` + days-since-AI logic)

### 2. `src/components/breeding/BreedingStatusAnimalList.tsx` (NEW)

A simple Dialog component that:
- Receives: `open`, `onClose`, `statusLabel`, `statusIcon`, `animals[]`, `onSelectAnimal(id)`
- Renders: A list of animals with name/ear_tag, each clickable
- On click: calls `navigate(/animal/{id})` and closes the dialog
- Empty state: "No animals in this status"

### 3. Status-to-filter mapping

| Card Label | Filter Logic |
|---|---|
| Open | `fertility_status === 'open_cycling'` |
| In Heat | `fertility_status === 'in_heat'` |
| Waiting | `fertility_status === 'bred_waiting'` |
| Preg Check | `fertility_status === 'bred_waiting'` + 28-45 days post-AI |
| Suspected | `fertility_status === 'suspected_pregnant'` |
| Pregnant | `fertility_status === 'confirmed_pregnant'` |
| Fresh | `fertility_status === 'fresh_postpartum'` |
| Not Ready | `fertility_status === 'not_eligible'` |

"Preg Check" is a computed sub-status. To filter for it, we'll reuse the same AI records lookup already in `useBreedingHub` and expose a `pregCheckDueAnimalIds` set from the hook data.

## Technical Detail

The `useBreedingHub` hook already computes `actionsToday` which includes `preg_check_due` actions with animal IDs. We can derive the preg-check animal list from `actionsToday.filter(a => a.type === 'preg_check_due')` rather than re-querying.

For all other statuses, it's a simple `animals.filter(a => a.fertility_status === status)`.

## Files Summary

| File | Action |
|---|---|
| `src/components/breeding/BreedingStatusAnimalList.tsx` | Create - dialog with animal list |
| `src/components/breeding/BreedingHub.tsx` | Edit - add onClick handlers + render dialog |
| `src/components/breeding/index.ts` | Edit - export new component |

