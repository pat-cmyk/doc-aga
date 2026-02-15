

# Fix: Admin Table Horizontal Scrollbar Not Appearing

## Root Cause Analysis

The DOM chain from viewport to table is:

```text
body (overflow-x: hidden)          <-- PROBLEM #1: Creates clipping context
  #root (max-width: 1280px)        <-- Constrains width on desktop
    AdminLayout div
      container div (px-4/px-8)    <-- Adds padding
        Tabs > TabsContent
          OperationsTab > Tabs > TabsContent
            Card                   <-- No overflow constraint (correct)
              CardContent (p-6)    <-- Adds 48px total padding
                Table wrapper div  <-- overflow-x: auto + scrollbar-visible
                  table            <-- minWidth: 1200px via inline style
```

**Problem 1: `body { overflow-x: hidden }` in `src/index.css` (line 183)**
This creates a Block Formatting Context that suppresses nested scrollbar rendering in certain browser/OS combinations (notably macOS with overlay scrollbar settings). Per the project's own memory note on admin table standards, global overflow constraints "create clipping contexts that suppress nested scrollbars."

**Problem 2: Tight margin between table minWidth and viewport**
On desktop (1280px viewport), after container padding (32-64px) and card padding (48px), available width is ~1170px. The table `minWidth: 1200px` only overflows by ~30px -- barely enough for a visible scrollbar thumb.

## Fix Plan

### File 1: `src/index.css` (line 183)
Replace `body { overflow-x: hidden; }` with `overflow-x: clip`. The `clip` value prevents page-level horizontal overflow (same visual result) but does NOT create a formatting context, so nested `overflow-x: auto` containers retain their independent scroll behavior.

```css
/* Before */
body {
  overflow-x: hidden;
}

/* After */
body {
  overflow-x: clip;
}
```

### File 2: `src/components/admin/FarmOversight.tsx` (line 349)
Increase the table `minWidth` to `1400px` to ensure clear overflow on both desktop and mobile viewports, producing a visible scrollbar thumb.

```tsx
/* Before */
<Table style={{ minWidth: '1200px' }}>

/* After */
<Table style={{ minWidth: '1400px' }}>
```

### File 3: `src/index.css` (scrollbar-visible class)
Strengthen the scrollbar-visible styles to force persistent visibility across all platforms, including macOS overlay scrollbar mode:

```css
.scrollbar-visible {
  overflow-x: auto;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}
.scrollbar-visible::-webkit-scrollbar {
  height: 10px;         /* Increased from 8px for better grab target */
  display: block !important;
}
```

### Verification
After changes:
1. Navigate to `/admin?tab=operations` at desktop (1280px), tablet (768px), and mobile (390px) viewports
2. Screenshot each to confirm a visible, draggable horizontal scrollbar beneath the Farm Oversight table
3. Confirm no horizontal page-level scroll on any viewport

### Files Changed

| File | Change |
|------|--------|
| `src/index.css` | `overflow-x: hidden` to `overflow-x: clip` on body; increase scrollbar height to 10px |
| `src/components/admin/FarmOversight.tsx` | Table minWidth `1200px` to `1400px` |

