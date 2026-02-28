

# UI Fix: Make Scroll Containers Visually Obvious

## Problem
The `ScrollArea` containers have no visible boundary, so feedback cards appear to just "disappear" at the bottom edge. There's no visual cue that the list is scrollable or where its boundary is.

## Solution
Add a visible container with a border, rounded corners, and a bottom fade gradient to both scroll areas. This makes it immediately clear there's a bounded list with more content below.

### Changes

#### 1. `src/components/government/FeedbackPriorityQueue.tsx`
- Wrap the `ScrollArea` in a `div` with `border rounded-lg` styling to create a visible box
- Add a fade-out gradient overlay at the bottom edge using a `pointer-events-none` absolute-positioned div with a `bg-gradient-to-t from-background to-transparent` effect
- This signals "there's more below" without blocking interaction

**Before:**
```tsx
<ScrollArea className="h-[500px] pr-4">
```

**After:**
```tsx
<div className="relative border rounded-lg">
  <ScrollArea className="h-[500px] p-4">
    ...
  </ScrollArea>
  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none rounded-b-lg" />
</div>
```

#### 2. `src/components/government/FeedbackClusterView.tsx`
- Same pattern: wrap `ScrollArea` in a bordered container with bottom fade gradient

### Why This Works
- **Border + rounded corners**: Creates a clear visual boundary (the "box")
- **Bottom gradient fade**: Universal UX signal that content continues below
- **`pointer-events-none`**: Gradient doesn't block clicking or scrolling
- Consistent with card-based UI patterns already in the app
- No new dependencies or components needed

