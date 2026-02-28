

# Fix: Constrain Farmer Voice Lists with Fixed-Height Scroll Areas

## Problem
The Priority Queue and Clustered Concerns sections in the Farmer Voice tab render unbounded lists that extend the page indefinitely as feedback volume grows, breaking the UI layout.

## Solution
Wrap both list sections in fixed-height `ScrollArea` containers -- the same pattern already used in 23+ components across the app (e.g., `MySubmissions`, `BreedingHub`, `AnimalHealthHeatmap`).

## Standard Height
The project uses `h-[500px]` for primary list containers (e.g., approval submissions tabs). This fits approximately 4 feedback cards, which aligns with the "golden standard" the user mentioned. Both sections will use this height.

## Changes

### 1. `src/components/government/FeedbackPriorityQueue.tsx`
- Import `ScrollArea` from `@/components/ui/scroll-area`
- Wrap the feedback list container (the `div.space-y-3` at line 212) inside a `ScrollArea className="h-[500px] pr-4"`
- The filter bar (Card at line 132) stays outside the scroll area so it remains sticky/visible

### 2. `src/components/government/FeedbackClusterView.tsx`
- Import `ScrollArea` from `@/components/ui/scroll-area`
- Wrap the cluster list inside `CardContent` with a `ScrollArea className="h-[500px] pr-4"`
- The card header stays outside the scroll area

### Technical Notes
- Reuses the existing `ScrollArea` component (`@radix-ui/react-scroll-area`) already used throughout the app
- No new dependencies, no logic changes, no computation changes
- Empty states remain inside the scroll area (consistent with existing patterns like `NotificationDropdown`)
- The filter bar in Priority Queue remains fixed above the scrollable list
