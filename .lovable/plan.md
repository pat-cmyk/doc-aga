

# Fix AnimalCombobox Scroll Inside Dialogs

## Problem

The `AnimalCombobox` dropdown cannot be scrolled when opened inside any FAB dialog. The scrollbar appears momentarily then disappears, making animals below the visible area unreachable. This affects both mobile and desktop.

## Root Cause

`AnimalCombobox` uses a Radix `Popover` component. When this Popover opens inside a Radix `Dialog` (desktop mode of `ResponsiveFormContainer`), the Dialog's **modal behavior** intercepts pointer/touch events and prevents scroll gestures from reaching the `CommandList` inside the Popover — even though the Popover portals its content out of the Dialog DOM.

This is a well-documented Radix UI issue. The BCS dialog avoids it on mobile by using a Drawer, but on desktop (where Dialog is used), the problem persists for all FAB dialogs.

## Solution

Add `modal={false}` to the `Popover` in `AnimalCombobox.tsx`. This tells Radix not to lock pointer events when the Popover is open, allowing scroll gestures to reach the `CommandList` naturally.

Since `AnimalCombobox` is a **shared SSOT component** used by 5 dialogs (Record Milk, Record Feed, Record Health, Record BCS, Edit Submission), fixing it once fixes all entry points.

Additionally, `FeedMilkToAnimalDialog` still uses a raw `Dialog` instead of `ResponsiveFormContainer` and has a `Select` dropdown for animals — this should be migrated to the SSOT container for consistency.

## Files to Change

### 1. EDIT: `src/components/milk-recording/AnimalCombobox.tsx`

One-line change — add `modal={false}` to the Popover:

```tsx
// Before:
<Popover open={open} onOpenChange={setOpen}>

// After:
<Popover open={open} onOpenChange={setOpen} modal={false}>
```

This prevents the parent Dialog from intercepting scroll events inside the Popover's CommandList.

### 2. EDIT: `src/components/milk-inventory/FeedMilkToAnimalDialog.tsx`

Migrate from raw `Dialog` to `ResponsiveFormContainer` for SSOT consistency. This dialog also has a `Select` dropdown for animals that could have similar scroll issues inside the Dialog.

## Impact

| Dialog | Uses AnimalCombobox | Fixed by change 1 |
|--------|--------------------|--------------------|
| RecordBulkMilkDialog | Yes | Yes |
| RecordBulkFeedDialog | Yes | Yes |
| RecordBulkHealthDialog | Yes | Yes |
| RecordBulkBCSDialog | Yes | Yes |
| EditSubmissionDialog | Yes | Yes |
| FeedMilkToAnimalDialog | No (uses Select) | Fixed by change 2 |

## What This Does NOT Touch

- ResponsiveFormContainer — already correct
- Database/RLS — no changes
- Any other dialogs or components

## Verification Plan

1. Open FAB -> Record Feeding -> Select Animals -> confirm the full animal list scrolls on both mobile and desktop
2. Repeat for Record Milk, Record Health, Record BCS
3. Test FeedMilkToAnimalDialog animal Select dropdown
4. Screenshot proof at mobile (390x844) and desktop viewports

