

# Mobile Optimization Plan: EditAnimalDialog

## Summary

The `EditAnimalDialog` component needs several mobile-specific adjustments to ensure a smooth experience on phones. The main issues are:
- Footer buttons are arranged horizontally and become cramped on narrow screens
- Dialog doesn't account for safe areas on notched phones
- Some form layouts use fixed grid columns that are too tight on mobile

---

## Changes Overview

| File | Change |
|------|--------|
| `src/components/animal-details/EditAnimalDialog.tsx` | Mobile-responsive footer layout, safe area padding, improved form layouts |

---

## Detailed Changes

### 1. Mobile-Responsive Footer Buttons (High Priority)

**Current Problem**: 4 buttons arranged horizontally cause overflow on narrow screens.

**Current Layout (Line 680-725)**:
```tsx
<div className="flex items-center justify-between w-full">
  <div className="flex gap-2">
    <Button>Delete</Button>
    <Button>Reset</Button>
  </div>
  <div className="flex gap-2">
    <Button>Cancel</Button>
    <Button>Save Changes</Button>
  </div>
</div>
```

**New Mobile-First Layout**:
```tsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-3">
  {/* Primary actions first on mobile (Save/Cancel), last on desktop */}
  <div className="flex gap-2 order-first sm:order-last">
    <Button variant="outline">Cancel</Button>
    <Button>Save Changes</Button>
  </div>
  {/* Secondary actions second on mobile (Delete/Reset), first on desktop */}
  <div className="flex gap-2 order-last sm:order-first">
    <Button variant="destructive" size="sm" className="sm:size-default">
      <Trash2 className="h-4 w-4 sm:mr-2" />
      <span className="hidden sm:inline">Delete</span>
    </Button>
    <Button variant="ghost" size="sm" className="sm:size-default">
      <RotateCcw className="h-4 w-4 sm:mr-1" />
      <span className="hidden sm:inline">Reset</span>
    </Button>
  </div>
</div>
```

**Result**: 
- On mobile: Save/Cancel buttons appear first (full width), Delete/Reset as icon-only buttons below
- On desktop: Same layout as before with all labels visible

---

### 2. Safe Area Bottom Padding (Medium Priority)

**Current Problem**: On phones with notches/navigation bars, the footer buttons may overlap with system UI.

**Change to DialogFooter (Line 678)**:
```tsx
// Before
<DialogFooter className="px-6 pb-6 pt-2">

// After  
<DialogFooter className="px-6 pb-6 pt-2 pb-safe">
```

The `pb-safe` utility class is already defined in the project's CSS and handles `env(safe-area-inset-bottom)`.

---

### 3. Improved Mix Breed Grid on Mobile (Low Priority)

**Current Problem**: The Mix Breed selector uses `grid-cols-2` which can be cramped on very narrow screens.

**Current (Lines 261-297)**:
```tsx
<div className="grid grid-cols-2 gap-4">
  {/* First Breed */}
  {/* Second Breed */}
</div>
```

**New**:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  {/* First Breed */}
  {/* Second Breed */}
</div>
```

---

### 4. Dynamic Viewport Height for ScrollArea (Low Priority)

**Current Problem**: The `calc(90vh-180px)` height may not account for dynamic mobile browser chrome (address bar showing/hiding).

**Current (Line 159)**:
```tsx
<ScrollArea className="max-h-[calc(90vh-180px)] px-6">
```

**New**:
```tsx
<ScrollArea className="max-h-[calc(90dvh-180px)] px-6">
```

The `dvh` (dynamic viewport height) unit properly accounts for mobile browser UI changes.

---

## Summary of Line Changes

| Line(s) | Current | New |
|---------|---------|-----|
| 159 | `max-h-[calc(90vh-180px)]` | `max-h-[calc(90dvh-180px)]` |
| 261 | `grid grid-cols-2 gap-4` | `grid grid-cols-1 sm:grid-cols-2 gap-4` |
| 678 | `px-6 pb-6 pt-2` | `px-6 pb-6 pt-2 pb-safe` |
| 680-725 | Horizontal button layout | Mobile-first stacked layout with icon-only secondary buttons on mobile |

---

## Visual Comparison

**Before (Mobile)**:
```
[Delete] [Reset]     [Cancel] [Save Changes]
         ↑ cramped, may overflow ↑
```

**After (Mobile)**:
```
[    Cancel    ] [  Save Changes  ]
[🗑️] [↺]                          
↑ icon-only, space efficient ↑
```

**After (Desktop)**: Same as current - full labels on all buttons

---

## Testing Points

1. Open an animal profile on a mobile device
2. Tap "Edit All Details"
3. Verify the dialog opens smoothly and fills most of the screen
4. Scroll through all collapsible sections
5. Verify footer buttons are easily tappable and don't overlap system navigation
6. Test on a phone with a notch (e.g., iPhone, recent Samsung) to verify safe area handling
7. Expand "Mix Breed" option and verify the two dropdowns stack on very narrow screens

