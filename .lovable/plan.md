

# Fix: Admin Table Horizontal Scrollbar (Root Cause Verified via Browser)

## Verified Problem

I navigated to `/admin?tab=operations` at 768px and 390px viewports and confirmed:
- Table columns are clipped at the right edge
- No horizontal scrollbar appears anywhere
- Attempting to scroll the table wrapper element does nothing

## Root Cause (confirmed via DOM inspection)

Two issues are combining to prevent scrollbars:

1. `overflow-hidden` on the Card element clips EVERYTHING that overflows, including the scrollbar that `overflow-auto` on the inner Table wrapper would produce. The Card is the outermost constraint, and its `overflow-hidden` prevents any scrolling behavior from being visible or interactive.

2. CSS `min-width` on `<table>` elements can be ignored by the table layout algorithm. Tables size based on their content and column distribution, not standard block-level min-width rules. So `min-w-[1200px]` on the table may not actually force the table to 1200px.

## Fix

Two changes per component:

### A. Change Card from `overflow-hidden` to `overflow-x-auto`
This makes the Card itself the scroll container instead of a clipping container.

### B. Use inline `style` for minWidth instead of Tailwind class
Inline styles on table elements are more reliably enforced than Tailwind utility classes for table sizing.

## Files to Change

### 1. `src/components/admin/FarmOversight.tsx`
- Line 329: `<Card className="overflow-hidden">` to `<Card className="overflow-x-auto">`
- Line 349: `<Table className="min-w-[1200px]">` to `<Table style={{ minWidth: '1200px' }}>`

### 2. `src/components/admin/UserManagement.tsx`
- Card: `overflow-hidden` to `overflow-x-auto`
- Table: `className="min-w-[1000px]"` to `style={{ minWidth: '1000px' }}`

### 3. `src/components/admin/MerchantOversight.tsx`
- Card (line ~117): `overflow-hidden` to `overflow-x-auto`
- Table: `className="min-w-[800px]"` to `style={{ minWidth: '800px' }}`

### 4. `src/components/admin/SupportTicketsTab.tsx`
- Card: `overflow-hidden` to `overflow-x-auto`
- Table: `className="min-w-[800px]"` to `style={{ minWidth: '800px' }}`

### 5. `src/components/admin/UserActivityLogs.tsx`
- The Card wrapping the table (has `overflow-hidden` on a wrapping div at line ~181): change to `overflow-x-auto`
- Table: `className="min-w-[800px]"` to `style={{ minWidth: '800px' }}`

### 6. `src/components/admin/DocAgaManagement.tsx`
- Both Card wrappers with `overflow-hidden`: change to `overflow-x-auto`
- Both Tables: `className="min-w-[700px]"` to `style={{ minWidth: '700px' }}`

## Verification Plan (mandatory per protocol)

After implementation:
1. Navigate to `/admin?tab=operations` at 390x844 viewport
2. Screenshot the Farm Oversight table
3. Confirm horizontal scrollbar is visible
4. Attempt to scroll right and screenshot again to confirm remaining columns (Status, Created, Actions) are accessible
5. If scrollbar still missing: STOP, report failure, diagnose via DOM inspection

## No database changes, no new dependencies.

