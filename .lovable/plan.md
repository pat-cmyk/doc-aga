

# Fix FAB Dialog Scroll — Adopt Responsive Drawer Pattern (SSOT)

## Problem

The `AnimalCombobox` dropdown list cannot be scrolled on mobile (and has limited scrollability on desktop) inside FAB-launched dialogs. This affects Record Feeding, Record Milk, and Record Health dialogs. The screenshot confirms the issue also affects desktop — the animal list in the Popover is clipped with no scrollbar.

## Root Cause

All three dialogs use a raw Radix `Dialog`, which captures pointer/touch events and prevents scroll propagation inside nested `Popover` components (used by `AnimalCombobox`). The BCS dialog does NOT have this issue because it uses `ResponsiveBCSContainer`, which renders a **Drawer** (vaul bottom sheet) on mobile, allowing native touch scrolling.

## SSOT Solution

The existing `ResponsiveBCSContainer` (`src/components/body-condition/ResponsiveBCSContainer.tsx`) is the proven working pattern. We will:

1. **Generalize** it into a reusable `ResponsiveFormContainer` in `src/components/ui/`
2. **Apply** it to all three affected FAB dialogs
3. **Migrate** BCS to use the shared component and delete the BCS-specific one

## Files to Change

### 1. CREATE: `src/components/ui/ResponsiveFormContainer.tsx`

A generalized copy of `ResponsiveBCSContainer` with:
- Mobile: vaul `Drawer` with `max-h-[92vh] flex flex-col`, body with `overflow-y-auto` and `-webkit-overflow-scrolling: touch`
- Desktop: Radix `Dialog` with `max-h-[85vh] flex flex-col overflow-hidden`, body with `ScrollArea`
- Props: `open`, `onOpenChange`, `title`, `description`, `children`, `footer`, `className`
- Uses `useIsMobile()` hook (existing SSOT)

### 2. EDIT: `src/components/milk-recording/RecordBulkMilkDialog.tsx`

- Remove `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` imports
- Import `ResponsiveFormContainer` instead
- Replace outer `<Dialog>` + `<DialogContent>` with `<ResponsiveFormContainer>`
- Move the footer buttons (`Cancel` + `Record Milk`) into the `footer` prop
- The inner form content (date picker, session, animal combobox, quality fields, split preview) stays unchanged

### 3. EDIT: `src/components/feed-recording/RecordBulkFeedDialog.tsx`

- Same refactor: replace `Dialog`/`DialogContent` wrapper with `ResponsiveFormContainer`
- Move footer buttons into `footer` prop

### 4. EDIT: `src/components/health-recording/RecordBulkHealthDialog.tsx`

- Same refactor: replace `Dialog`/`DialogContent` wrapper with `ResponsiveFormContainer`
- Move footer buttons into `footer` prop

### 5. EDIT: `src/components/body-condition/RecordBulkBCSDialog.tsx`

- Replace import of `ResponsiveBCSContainer` with `ResponsiveFormContainer`
- Update usage (same API, drop-in replacement)

### 6. DELETE: `src/components/body-condition/ResponsiveBCSContainer.tsx`

- Replaced by the shared `ResponsiveFormContainer`

## What This Does NOT Touch

- `AnimalCombobox` — no changes; it works correctly inside a Drawer
- `UnifiedActionsFab.tsx` — the FAB launcher is fine
- Any non-FAB dialogs — untouched
- Database/RLS — no changes
- Farmer/merchant/vet/government/cooperative code — untouched

## Technical Detail: Why Drawer Fixes It

Radix `Dialog` uses a modal overlay that captures `pointerdown` events, preventing scroll gestures inside nested `Popover` elements. Vaul `Drawer` does not have this issue because it uses a different event model — the bottom sheet allows natural touch scrolling within its content area, and nested `Popover` components work correctly.

## Verification Plan

1. Navigate to farm dashboard at mobile viewport (390x844)
2. Open FAB -> Record Feeding -> tap "Select Animals" -> confirm animal list scrolls with touch
3. Repeat for Record Milk and Record Health
4. Repeat for Record BCS (regression check)
5. Test on desktop viewport (1920x1080) to confirm Dialog mode still works
6. Screenshot proof at both viewports

