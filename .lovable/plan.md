

# Fix: Force Visible Scrollbars on Admin Table Containers

## The REAL Problem (verified via browser DOM inspection)

The horizontal scroll **is actually working** — the DOM confirms:
- Table wrapper `offsetWidth`: constrained (smaller than table)
- Table `offsetWidth`: 1200px (correctly forced by inline style)
- `scrollWidth` > `offsetWidth` = scrollable = **true**

The scrollbar is **invisible** because macOS and iOS use overlay scrollbars that only appear during active touch/trackpad scrolling. On a phone or Mac with no active scroll gesture, there is zero visual indication that the table extends beyond the viewport.

## The Fix (two parts)

### 1. Add a CSS class in `src/index.css` that forces always-visible scrollbars

```css
/* Force visible scrollbar for table containers */
.scrollbar-visible {
  overflow-x: auto;
  scrollbar-width: thin; /* Firefox: show thin persistent scrollbar */
}
.scrollbar-visible::-webkit-scrollbar {
  height: 8px;
  display: block;
}
.scrollbar-visible::-webkit-scrollbar-track {
  background: hsl(var(--muted));
  border-radius: 4px;
}
.scrollbar-visible::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.3);
  border-radius: 4px;
}
.scrollbar-visible::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.5);
}
```

### 2. Apply `scrollbar-visible` class to the Table component's internal wrapper div

This is the single point of control. Instead of modifying every admin component file, we change the Table component's wrapper div in `src/components/ui/table.tsx` (line 7):

From:
```tsx
<div className="relative w-full overflow-auto">
```
To:
```tsx
<div className="relative w-full scrollbar-visible">
```

This ensures ALL tables across the entire app get visible scrollbars when they overflow, not just admin tables.

## Files to Change

| File | Change |
|------|--------|
| `src/index.css` | Add `.scrollbar-visible` CSS class with forced visible scrollbar styles |
| `src/components/ui/table.tsx` (line 7) | Replace `overflow-auto` with `scrollbar-visible` |

## No other files need changes
The existing `overflow-x-auto` on Cards and `style={{ minWidth }}` on Tables from previous fixes remain correct and stay in place.

## Verification Plan
1. Navigate to `/admin?tab=operations` at 390x844 viewport
2. Screenshot to confirm a visible horizontal scrollbar appears below the table
3. Scroll right and screenshot to confirm all remaining columns are accessible
