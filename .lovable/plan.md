

# Clean Fix: Admin Table Horizontal Scrollbars (From Scratch)

## Root Cause (FINAL)

The entire overflow chain has been blocking table scrollbars across all previous attempts. Here is the full ancestor chain and the problem at each level:

```text
body          overflow-x: hidden  (index.css line 183) -- clips descendants
  #root       overflow-x: hidden  (App.css line 7)     -- clips descendants AGAIN
    .container  (no overflow set)
      Card      (no overflow set -- good after previous fixes)
        Table wrapper div  overflow-x: auto + scrollbar-visible  (table.tsx)
          <table style="min-width: 1200px">
```

The Table wrapper correctly has `overflow-x: auto` and `scrollbar-visible`. The `<table>` element correctly has `minWidth: 1200px` via inline style. But the scrollbar is invisible because `#root` (and `body`) both have `overflow-x: hidden`, which creates clipping contexts that prevent ANY descendant from rendering a visible scrollbar.

## The Fix: 2 Files Only

### 1. `src/App.css` -- Remove `overflow-x: hidden` from `#root`

The `#root` element should NOT clip overflow. It should allow nested scroll containers to work. Change:

```css
#root {
  width: 100%;
  min-width: 0;
  margin: 0 auto;
  padding: 0;
}

@media (min-width: 769px) {
  #root {
    max-width: 1280px;
  }
}
```

Key changes:
- Remove `overflow-x: hidden` (the blocker)
- Remove `max-width: 100vw` (redundant -- body already constrains width, and this can also interfere with nested scroll containers)

### 2. `src/index.css` -- Keep `body { overflow-x: hidden }` but confirm it does NOT clip nested scroll

`body { overflow-x: hidden }` prevents the page itself from scrolling horizontally (which is correct -- we don't want the whole page to slide left/right). Crucially, `overflow-x: hidden` on `body` does NOT clip nested scroll containers inside `#root` as long as `#root` itself does not also have `overflow-x: hidden`.

No changes needed to `index.css` -- the current body rule is correct.

### No changes to any admin component files

The previous fixes to table components are all correct:
- `table.tsx` wrapper div has `scrollbar-visible` (single scroll point) -- correct
- All admin tables pass `style={{ minWidth: '...' }}` to `<Table>` -- correct  
- All Cards have no overflow classes -- correct

## Why Previous Attempts Failed

Every previous fix correctly addressed the Table/Card level, but the `#root` ancestor with `overflow-x: hidden` was always clipping the scrollbar from above. This is the foundational constraint that was never removed.

## Responsive Behavior (all viewports)

| Viewport | Behavior |
|----------|----------|
| Desktop (1280px+) | Table fits naturally, no scrollbar needed (1200px table fits in ~1280px container) |
| Tablet (769-1279px) | Table may overflow slightly, scrollbar appears when needed |
| Mobile (< 769px) | Table overflows significantly, persistent visible scrollbar via `scrollbar-visible` CSS |

## Verification Plan

1. Navigate to `/admin?tab=operations` at 390x844 (mobile) viewport
2. Screenshot to confirm visible horizontal scrollbar below the Farm Oversight table
3. Navigate at 768px (tablet) viewport and screenshot
4. Navigate at 1280px (desktop) viewport to confirm table fits without scrollbar
5. If scrollbar still missing at mobile: STOP, report failure, inspect DOM to find the next ancestor clipping

## Summary

One single CSS change in `App.css`: remove `overflow-x: hidden` and `max-width: 100vw` from `#root`. That is the entire fix.
