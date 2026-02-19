

# Fix Animal Selection Dropdown Touch Scrollability on Mobile

## Problem

The Animal Selection dropdown (used in FAB -> Record Milk, Record Feed, Record Health, Record BCS) uses a Radix Popover + cmdk CommandList pattern. On desktop, the scrollbar appears and works. On mobile touch devices, touch scrolling inside the Popover portal does not work -- users cannot scroll down to see all animals.

This is a known limitation of Radix Popover portals on mobile touch devices: the portal intercepts touch events for dismiss handling, preventing scroll propagation to the inner CommandList.

## Root Cause

`AnimalCombobox.tsx` line 88: `CommandList` has `max-h-[300px]` with `overflow-y-auto` (from `command.tsx`). The parent Popover portal captures touch events, blocking native touch scroll inside the list.

## Fix Strategy

Apply two targeted changes to the `AnimalCombobox.tsx` component:

### 1. Add touch-scroll CSS to the CommandList

Add explicit touch-scroll enabling styles to the CommandList:
- `overscroll-behavior-y: contain` -- prevents scroll chaining to parent
- `touch-action: pan-y` -- explicitly tells the browser to allow vertical touch panning
- `-webkit-overflow-scrolling: touch` -- enables momentum scrolling on iOS

### 2. Add `onOpenAutoFocus` prevention to PopoverContent

Radix Popover auto-focuses the content on open, which on mobile can interfere with scroll behavior. Adding `onOpenAutoFocus={(e) => e.preventDefault()}` prevents this.

## File Changes

### EDIT: `src/components/milk-recording/AnimalCombobox.tsx`

**Change 1** -- PopoverContent (line 81): Add `onOpenAutoFocus` handler:
```tsx
<PopoverContent 
  className="w-[var(--radix-popover-trigger-width)] p-0" 
  align="start"
  onOpenAutoFocus={(e) => e.preventDefault()}
>
```

**Change 2** -- CommandList (line 88): Add touch-scroll styles:
```tsx
<CommandList 
  className="max-h-[300px]" 
  style={{ 
    overscrollBehaviorY: 'contain', 
    WebkitOverflowScrolling: 'touch', 
    touchAction: 'pan-y' 
  }}
>
```

## What This Does NOT Touch

- No dialog layout changes (those were fixed in the previous task)
- No changes to the `command.tsx` shared component (avoids side effects)
- No changes to farmer/merchant/vet/government code
- No database changes

## Verification Plan

1. Open preview at mobile viewport (390x844)
2. Navigate to FAB -> Record Milk -> click Animal Selection dropdown
3. Attempt to scroll the animal list -- verify scrollbar appears and touch scroll works
4. Screenshot proof at mobile viewport
