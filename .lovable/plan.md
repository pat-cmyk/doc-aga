

# Improve Dialog Scrolling for Edit/View Voice Entries

## Current State Analysis

I found **two dialog components** used for voice entry management:

### 1. EditSubmissionDialog (`src/components/approval/EditSubmissionDialog.tsx`)
- Used by **farmhands** to edit their pending submissions before manager review
- Used by **farmhands** to resubmit rejected activities
- **Issue**: Has a fixed width (`sm:max-w-[425px]`) but **NO scrolling mechanism**
- The dialog content grows indefinitely without scroll constraints

### 2. ActivityDetailsDialog (`src/components/approval/ActivityDetailsDialog.tsx`)  
- Used by **farm managers/owners** to view and approve/reject submissions
- **Partially addressed**: Has `max-h-[90vh]` on DialogContent and `ScrollArea` with `max-h-[50vh]`
- **Issue**: The 50vh scroll area may be too restrictive on mobile devices, cutting off content

## Identified Problems

| Dialog | Problem | Impact |
|--------|---------|--------|
| EditSubmissionDialog | No max-height constraint | On long forms (injection with many fields), content can overflow screen |
| EditSubmissionDialog | No ScrollArea wrapper | Users cannot scroll to see all form fields |
| ActivityDetailsDialog | Fixed 50vh for content | On mobile, this may only show ~300-350px of scrollable area |
| Both | No mobile-specific handling | No responsive adjustments for smaller screens |

## Solution

### EditSubmissionDialog Fixes

1. **Add max-height constraint** to DialogContent:
   ```tsx
   <DialogContent className="sm:max-w-[425px] max-h-[90vh] flex flex-col">
   ```

2. **Wrap form content in ScrollArea** with responsive height:
   ```tsx
   <ScrollArea className="max-h-[60vh] flex-1 pr-4">
     <div className="py-4 space-y-4">
       {/* Animal selection */}
       {/* Form fields */}
     </div>
   </ScrollArea>
   ```

3. **Keep DialogHeader and DialogFooter outside ScrollArea** so they remain fixed and visible

### ActivityDetailsDialog Fixes

1. **Increase scroll area height** for better mobile experience:
   ```tsx
   <ScrollArea className="max-h-[60vh] pr-4">
   ```

2. **Add flex layout** to ensure footer stays at bottom:
   ```tsx
   <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
   ```

## Technical Details

### File Changes

| File | Change |
|------|--------|
| `src/components/approval/EditSubmissionDialog.tsx` | Add ScrollArea, max-height, flex layout |
| `src/components/approval/ActivityDetailsDialog.tsx` | Adjust scroll area height, add flex layout |

### EditSubmissionDialog Changes

**Lines 269-313** - Current structure:
```tsx
<DialogContent className="sm:max-w-[425px]">
  <DialogHeader>...</DialogHeader>
  {/* Rejection alert */}
  <div className="py-4 space-y-4">
    {/* Animal selection */}
    {renderFields()}
  </div>
  <DialogFooter>...</DialogFooter>
</DialogContent>
```

**Proposed structure**:
```tsx
<DialogContent className="sm:max-w-[425px] max-h-[90vh] flex flex-col">
  <DialogHeader>...</DialogHeader>
  {/* Rejection alert - stays outside scroll */}
  <ScrollArea className="max-h-[60vh] flex-1">
    <div className="py-4 space-y-4 pr-4">
      {/* Animal selection */}
      {renderFields()}
    </div>
  </ScrollArea>
  <DialogFooter>...</DialogFooter>
</DialogContent>
```

### ActivityDetailsDialog Changes

**Line 515** - Current:
```tsx
<DialogContent className="max-w-3xl max-h-[90vh]">
```

**Line 535** - Current scroll area:
```tsx
<ScrollArea className="max-h-[50vh] pr-4">
```

**Proposed changes**:
```tsx
<DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
...
<ScrollArea className="flex-1 max-h-[60vh] pr-4">
```

## Visual Behavior After Fix

```text
┌─────────────────────────────────────────┐
│  DialogHeader (Fixed - always visible)  │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │     ScrollArea (60vh max)         │  │
│  │     - Shows scrollbar when        │  │
│  │       content exceeds height      │  │
│  │     - Smooth scroll on touch      │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
├─────────────────────────────────────────┤
│  DialogFooter (Fixed - always visible)  │
│  [Cancel] [Save Changes]                │
└─────────────────────────────────────────┘
```

## Import Addition

EditSubmissionDialog needs to import ScrollArea:
```tsx
import { ScrollArea } from "@/components/ui/scroll-area";
```

## Testing Checklist

After implementation:
1. Open EditSubmissionDialog with an injection record (has most fields)
2. Verify scrollbar appears when content exceeds viewport
3. Verify header and footer remain fixed while scrolling
4. Test on mobile viewport (390px width)
5. Open ActivityDetailsDialog with milking record showing multiple animals
6. Verify all animal cards are accessible via scroll
7. Confirm approve/reject buttons remain visible

