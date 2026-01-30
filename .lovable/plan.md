

# Plan: Add Proper Scrollbar Support for Manager Approval Queue

## Current Implementation Analysis

The `PendingActivitiesQueue` component at `src/components/approval/PendingActivitiesQueue.tsx` currently:
- Uses a vertical `ScrollArea` with fixed height (`h-[600px]`) for the list of pending activities
- Each activity card displays details that could potentially overflow horizontally on smaller screens
- The `ScrollArea` component only renders a vertical scrollbar by default

## Problem

When there's content that extends beyond the screen width (particularly on mobile devices or narrow viewports), there's no horizontal scrollbar to allow users to pan across the content. This can happen with:
- Long animal names or ear tags
- Tables in the `ActivityDetailsDialog` (feeding distributions)
- Auto-approve countdown text that wraps awkwardly

## Solution

We'll enhance the scrolling behavior in two ways:

### 1. Add Horizontal Scrollbar to PendingActivitiesQueue

Modify the `ScrollArea` in `PendingActivitiesQueue.tsx` to include both vertical and horizontal scrollbars. We'll also add a horizontal `ScrollBar` explicitly to ensure it appears when content overflows.

**Changes to `src/components/approval/PendingActivitiesQueue.tsx`:**
- Import `ScrollBar` alongside `ScrollArea` from the UI component
- Add a horizontal `ScrollBar` inside the `ScrollArea` component
- Ensure the inner content has proper minimum width constraints

### 2. Improve Card Content Responsiveness

Update the activity cards to handle overflow more gracefully:
- Ensure text truncation on long names with `truncate` class where appropriate
- Add `min-w-0` to flex containers to allow text truncation to work properly
- Use responsive text sizing for better mobile display

### 3. Make ScrollArea Height Responsive

Instead of a fixed `h-[600px]`, use a more responsive approach:
- Use `max-h-[600px]` on desktop
- Use `max-h-[70vh]` for better mobile adaptation
- Combine with `min-h-[300px]` to prevent the area from being too small

## Implementation Details

### File: `src/components/approval/PendingActivitiesQueue.tsx`

**Line 5 - Update import:**
```typescript
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
```

**Line 131 - Update ScrollArea wrapper:**
```typescript
<ScrollArea className="h-auto max-h-[70vh] md:max-h-[600px] min-h-[300px]">
  <div className="space-y-4 pr-4">
    {/* ... existing cards */}
  </div>
  <ScrollBar orientation="vertical" />
  <ScrollBar orientation="horizontal" />
</ScrollArea>
```

**Lines 140-164 - Improve card header responsiveness:**
- Add `min-w-0` to text containers
- Add `truncate` to activity type labels for very long text
- Wrap the metadata row to handle overflow

**Lines 167-178 - Improve submitter/time info section:**
- Make the flex container wrap on small screens with `flex-wrap`
- Add text truncation for long names

## Additional Improvements

### Card Layout on Mobile (Lines 191-225):
- Stack action buttons vertically on very small screens
- Use `flex-wrap gap-2` instead of fixed flex layout

## Testing Checklist
- Verify vertical scrolling works when there are many pending activities
- Verify horizontal scrolling appears when card content overflows (resize browser to narrow width)
- Test on mobile viewport (375px width) to ensure cards don't overflow the container
- Confirm action buttons remain accessible and tappable on mobile
- Test with long animal names and ear tags to verify truncation works

## Files to Modify
1. `src/components/approval/PendingActivitiesQueue.tsx` - Main changes for scroll support and responsive layout

