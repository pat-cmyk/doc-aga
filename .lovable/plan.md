

# Fix: Remove Nested Scroll Containers — Single Scroll Point Strategy

## Root Cause (confirmed via browser DOM inspection)

There are **three** nested scroll containers fighting each other:

1. The **Card** component has `scrollbar-visible` (overflow-x: auto)
2. The **Table wrapper div** (inside `table.tsx`) also has `scrollbar-visible` (overflow-x: auto)
3. In FarmOversight, there's a `div style={{ width: 1200px }}` between them that forces the Card content to 1200px, but the Table wrapper inside it is ALSO 1200px — so the inner scroll container thinks it doesn't need to scroll, while the outer Card scroll is fighting with CardHeader and padding.

The browser sees the Card as the scroll container, but the CardHeader sits at narrow width while CardContent has a 1200px child — this creates an inconsistent layout where the scrollbar may render but is effectively invisible or non-functional.

## The Fix: Single Scroll Container

Remove `scrollbar-visible` from ALL Card/wrapper elements. The Table component's internal wrapper div (in `table.tsx`) is already the correct scroll container with `scrollbar-visible`. Just pass `style={{ minWidth: '1200px' }}` to the Table component so the `<table>` element forces the overflow inside its own wrapper.

### Files and Changes

**1. `src/components/admin/FarmOversight.tsx`**
- Line 329: `<Card className="scrollbar-visible">` → `<Card>`
- Lines 349/618: Remove the `<div style={{ width: '1200px' }}>` wrapper and its closing `</div>`
- Line 350: `<Table>` → `<Table style={{ minWidth: '1200px' }}>`

**2. `src/components/admin/UserManagement.tsx`**
- Line 232: `<Card className="scrollbar-visible">` → `<Card>`
- Table already has `style={{ minWidth: '1000px' }}` — keep it

**3. `src/components/admin/MerchantOversight.tsx`**
- Line 98: `<Card className="scrollbar-visible">` → `<Card>`
- Table already has `style={{ minWidth: '800px' }}` — keep it

**4. `src/components/admin/SupportTicketsTab.tsx`**
- Line 125: `<Card className="scrollbar-visible">` → `<Card>`
- Table already has `style={{ minWidth: '800px' }}` — keep it

**5. `src/components/admin/UserActivityLogs.tsx`**
- Line 202: `<div className="border rounded-lg scrollbar-visible">` → `<div className="border rounded-lg">`
- Table already has `style={{ minWidth: '800px' }}` — keep it

**6. `src/components/admin/DocAgaManagement.tsx`**
- Line 531: `<Card className="scrollbar-visible">` → `<Card>`
- Line 615: `<Card className="scrollbar-visible">` → `<Card>`
- Tables already have `style={{ minWidth: '700px' }}` — keep them

## Why This Works

The Table component in `table.tsx` already has:
```tsx
<div className="relative w-full overflow-x-auto scrollbar-visible">
  <table ... style={{ minWidth: '1200px' }} />
</div>
```

This wrapper div is constrained by its parent (CardContent, which is constrained by Card, which is constrained by the viewport). The `<table>` inside it has `minWidth: 1200px`, forcing it wider than the wrapper. The wrapper's `overflow-x: auto` + `scrollbar-visible` creates the visible scrollbar. There's only ONE scroll container — no nesting conflicts.

## Technical Detail

| Element | Role | overflow-x |
|---------|------|-----------|
| Card | Visual container only | visible (default) |
| CardContent | Padding wrapper | visible (default) |
| Table wrapper div (table.tsx) | **THE scroll container** | auto (scrollbar-visible) |
| table element | Content, forced to minWidth | n/a |

## Verification Plan

1. Navigate to `/admin?tab=operations` at 390x844 viewport
2. Screenshot to confirm visible scrollbar below the table
3. Scroll right to confirm hidden columns (Status, Created, Actions) are accessible
4. If scrollbar still missing: STOP, report failure, inspect DOM

