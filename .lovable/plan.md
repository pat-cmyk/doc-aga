

# Fix Farmer Voice Header Layout

## Problem
The `FarmerVoiceDashboard` component (containing the title, 4 stat cards, and Top Concerns bar chart) is placed inside a `flex items-center justify-between` wrapper alongside the "Tools" dropdown button. Since `FarmerVoiceDashboard` renders a full `space-y-6` layout with cards and a wide chart, the flex container squeezes it and the Tools button floats awkwardly to the right at the same vertical level as the Top Concerns card.

## Fix
Restructure the layout in `GovernmentDashboard.tsx` (lines ~1097-1130) so that:
1. The Tools dropdown is positioned in the **title row** of the dashboard (next to "Boses ng Magsasaka Dashboard"), not as a sibling to the entire component
2. The `FarmerVoiceDashboard` component gets full width

## Implementation

### File: `src/pages/GovernmentDashboard.tsx` (~lines 1097-1130)
- Remove the `flex items-center justify-between` wrapper around `FarmerVoiceDashboard` and the Tools button
- Instead, render `FarmerVoiceDashboard` at full width and pass the Tools dropdown as a `headerAction` prop (a ReactNode)

### File: `src/components/government/FarmerVoiceDashboard.tsx`
- Add an optional `headerAction?: React.ReactNode` prop
- Render it inline with the title row: "Boses ng Magsasaka Dashboard" on the left, the action slot on the right
- This keeps the Tools button contextually near the title without disrupting the card grid or Top Concerns layout

### Result
- Title row: "Boses ng Magsasaka Dashboard" (left) + Tools dropdown (right)
- Full-width stat cards grid (4 columns)
- Full-width Top Concerns bar chart

### Files Modified
| File | Change |
|------|--------|
| `src/pages/GovernmentDashboard.tsx` | Remove flex wrapper, pass Tools as `headerAction` prop |
| `src/components/government/FarmerVoiceDashboard.tsx` | Accept `headerAction` prop, render in title row |

