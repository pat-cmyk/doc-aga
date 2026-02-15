

# Fix: Admin Tables Horizontal Scrollbar (Root Cause Found)

## The Real Problem

The fix chain so far has been:
1. Added `overflow-x-auto` wrapper divs (redundant - Table already has one)
2. Added `overflow-hidden` to Cards (good, but not enough)
3. Added `min-w-[1200px]` to tables (correct, forces minimum width)

But it STILL doesn't work because the **parent layout is not width-constrained**. Here's the chain:

```text
container div (no overflow constraint)
  -> Tabs (no overflow constraint)
    -> TabsContent (no overflow constraint)
      -> Card (overflow-hidden, BUT grows to fit content because parent is unconstrained)
        -> CardContent
          -> Table wrapper div (w-full overflow-auto -- matches Card width, so no scroll)
            -> table (min-w-[1200px] -- fits because Card grew to accommodate it)
```

The Card expands to 1200px because nothing above it stops it from growing. Then `overflow-hidden` clips at 1200px, and the inner scroll wrapper is also 1200px -- so the table fits and no scrollbar appears. On mobile, the Card overflows the viewport, and the page itself scrolls or content gets clipped by the viewport edge.

## The Fix

Add `overflow-hidden` to the container div in `AdminLayout.tsx` so that the entire content area is constrained to the viewport width. This forces the Card to stay within bounds, which then forces the Table's internal `overflow-auto` wrapper to actually produce a horizontal scrollbar.

## Files to Change

### 1. `src/components/admin/AdminLayout.tsx` (line 103)
Change:
```text
<div className="container mx-auto px-4 py-6">
```
To:
```text
<div className="container mx-auto px-4 py-6 overflow-hidden">
```

This single change constrains the entire content area. The chain then becomes:

```text
container div (overflow-hidden -- constrained to viewport)
  -> Tabs (constrained by parent)
    -> TabsContent (constrained by parent)
      -> Card (overflow-hidden -- constrained to container width)
        -> CardContent
          -> Table wrapper div (w-full = container width, overflow-auto -- SCROLLBAR APPEARS)
            -> table (min-w-[1200px] -- overflows wrapper, triggers scroll)
```

### No other file changes needed.
All the previous changes (overflow-hidden on Cards, min-w on Tables) are correct and stay in place. Only the missing top-level constraint was the blocker.

