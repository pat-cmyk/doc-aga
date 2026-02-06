

# Fix Plan: Unify Animal Profile Editing Experience for Mobile and Desktop

## Problem Summary

The animal profile page has different editing capabilities on mobile vs desktop:

| View | Current Button | Dialog Used | Capabilities |
|------|----------------|-------------|--------------|
| **Desktop** | "Edit All Details" | `EditAnimalDialog` | Full editing: Name, Ear Tag, Livestock Type, Gender, Breed, Birth Date, Farm Entry Date, Milking Start Date, Parentage (Mother/Father), Entry/Birth/Current Weight, Acquisition Type, Purchase Price, Grant Source, Lactation Status, Delete Animal |
| **Mobile** | "Edit Details" | `EditAcquisitionWeightDialog` | Limited: Entry/Birth Weight, Acquisition Type, Purchase Price, Grant Source only |

This creates an inconsistent user experience where farmers on mobile devices cannot edit basic animal information like name, ear tag, breed, gender, or dates.

---

## Solution

Replace the mobile "Edit Details" button (which opens `EditAcquisitionWeightDialog`) with the same "Edit All Details" button that desktop uses (which opens `EditAnimalDialog`).

---

## File to Modify

| File | Change |
|------|--------|
| `src/components/AnimalDetails.tsx` | Update mobile action buttons section (lines 622-654) |

---

## Code Changes

### Current Mobile Implementation (Lines 622-654)

The mobile layout shows "Edit Details" button that opens the limited weight/acquisition dialog:

```tsx
{!readOnly && (
  <div className="flex flex-col gap-2 items-end">
    <Button 
      variant="outline" 
      size="sm"
      onClick={() => setEditWeightDialogOpen(true)}  // Opens limited dialog
      disabled={!isOnline}
    >
      <Pencil className="h-4 w-4 mr-1" />
      Edit Details  // Limited label
    </Button>
    <RecordAnimalExitDialog ... />
    {animal.gender === 'Female' && (
      <DryOffAnimalButton ... />
    )}
    <RecalculateSingleAnimalButton ... />
  </div>
)}
```

### Updated Mobile Implementation

Change to match desktop behavior:

```tsx
{!readOnly && (
  <div className="flex flex-col gap-2 items-end">
    <Button 
      variant="outline" 
      size="sm"
      onClick={() => setEditAnimalDialogOpen(true)}  // Opens full dialog
      disabled={!isOnline}
    >
      <Pencil className="h-4 w-4 mr-1" />
      Edit All Details  // Consistent label
    </Button>
    <RecordAnimalExitDialog ... />
    {animal.gender === 'Female' && (
      <DryOffAnimalButton ... />
    )}
    <RecalculateSingleAnimalButton ... />
  </div>
)}
```

---

## Technical Details

### State Already Exists
The `editAnimalDialogOpen` state is already defined at line 246:
```tsx
const [editAnimalDialogOpen, setEditAnimalDialogOpen] = useState(false);
```

### EditAnimalDialog Already Rendered
The `EditAnimalDialog` component is already rendered at lines 1254-1288, so no additional dialog needs to be added.

### EditAnimalDialog Mobile Compatibility
The `EditAnimalDialog` component is already mobile-friendly:
- Uses `ScrollArea` with `max-h-[calc(90vh-180px)]` for scrollable content
- Collapsible sections to manage screen space
- Uses `max-w-2xl` which scales appropriately on mobile

---

## Change Impact Summary

**Modified Files:**
- `src/components/AnimalDetails.tsx` - Change button onClick handler and label in mobile section

**Data Flow:**
- No data flow changes - using existing `EditAnimalDialog` which has its own data fetching via `useEditAnimalForm` hook

**Consumers Verified:**
- `EditAnimalDialog` already handles all form validation and submission
- State `editAnimalDialogOpen` already exists and is managed
- Dialog component already rendered in the component

**Breaking Changes:** None

---

## Testing Points

1. Open animal profile on a mobile device or narrow browser window
2. Verify "Edit All Details" button appears (not "Edit Details")
3. Tap the button and confirm the full `EditAnimalDialog` opens with:
   - Basic Information section (Name, Ear Tag, Livestock Type, Gender, Breed)
   - Dates section (Birth Date, Farm Entry Date, Milking Start Date)
   - Parentage section (Mother, Father)
   - Weight section (Entry/Birth/Current Weight)
   - Acquisition section (if applicable)
   - Lactation section (if female)
   - Delete Animal option at bottom
4. Make a change and save - verify it persists
5. Test on desktop to ensure no regression

