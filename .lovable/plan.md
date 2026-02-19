

# Fix Animal Selection: Inline Rendering (Follow Dialog Scroll Pattern)

## Problem

The AnimalCombobox uses a Radix `Popover` portal that renders in a separate DOM layer outside the dialog. On mobile, this portal intercepts touch events and prevents scrolling. CSS fixes (`touch-action`, `overscroll-behavior`) have not resolved this.

## Working Pattern (SSOT)

The parent dialog (e.g., RecordBulkFeedDialog) already has a proven scroll architecture:

```
DialogContent (max-h-[100dvh] flex flex-col overflow-hidden)
  DialogHeader (flex-shrink-0)
  Body (flex-1 overflow-y-auto)   <-- THIS SCROLLS ON MOBILE
    Date picker...
    Feed type...
    AnimalCombobox (Popover portal)  <-- THIS DOES NOT SCROLL
    Total kg...
  Footer (flex-shrink-0)
```

Everything inside the `flex-1 overflow-y-auto` body scrolls perfectly. The AnimalCombobox breaks this because its dropdown renders **outside** that container via a portal.

## Solution

Replace the Popover-based dropdown with an **inline collapsible list** that renders directly inside the dialog's scrollable body. When the user taps the trigger button, the animal list expands inline (like an accordion) -- it becomes part of the normal document flow and inherits the parent's `overflow-y-auto` scrolling.

### Before (broken):
```
Dialog body (overflow-y-auto)
  [AnimalCombobox trigger button]
                                    Popover Portal (floating, outside dialog DOM)
                                      CommandList (touch scroll blocked)
```

### After (follows SSOT):
```
Dialog body (overflow-y-auto)
  [AnimalCombobox trigger button]
  [Inline CommandList]              <-- lives inside the scrollable body
    Quick Select options
    Individual Animals
```

## File Changes

### EDIT: `src/components/milk-recording/AnimalCombobox.tsx`

Remove the Radix `Popover`, `PopoverTrigger`, and `PopoverContent` wrapper. Replace with:

1. A trigger `Button` that toggles an `open` state (same as current)
2. When `open === true`, render the `Command` + `CommandList` directly below the button as a bordered, rounded container -- no portal, no floating layer
3. The list gets `max-h-[200px] overflow-y-auto` so it scrolls within the dialog's own scroll context
4. Search input and all selection logic remain identical
5. When an item is selected, collapse the list (same as current `handleSelect`)

This is exactly how the rest of the form fields (date picker content, feed type selector content) behave when they need to show options -- they live in the dialog's DOM flow.

## What Does NOT Change

- No changes to any dialog files (RecordBulkFeedDialog, RecordBulkMilkDialog, etc.)
- No changes to the `Command`/`CommandList` shared UI components
- All selection logic, options, groups, search filtering stay identical
- No database changes
- Only 1 file modified: `AnimalCombobox.tsx`

## Verification Plan

1. Navigate to mobile viewport (390x844)
2. Open FAB -> Record Feed -> tap Animal Selection
3. Confirm the animal list appears inline and scrolls with the dialog
4. Test search filtering still works
5. Test selection still works (tap animal -> list collapses)
6. Repeat for Record Milk, Record Health, Record BCS
7. Screenshot proof at mobile viewport
