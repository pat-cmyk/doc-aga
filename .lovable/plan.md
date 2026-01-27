
# Add Delete Button to EditAnimalDialog for Error Correction

## Overview

Add a delete functionality to the `EditAnimalDialog` component that allows users to remove animal profiles that were created in error. This is distinct from the existing "Record Exit" functionality (sold, died, culled, etc.) - this is specifically for correcting data entry mistakes where the animal record should not exist at all.

## User Story

As a farm owner/manager, when I'm editing an animal's details and realize the animal was added by mistake (e.g., duplicate entry, wrong farm, test data), I want to be able to delete it directly from the edit dialog with a clear explanation of why I'm deleting it.

---

## Design Decisions

| Decision | Approach |
|----------|----------|
| Delete type | **Hard delete** vs soft delete (is_deleted: true) - Using **soft delete with exit_reason: 'data_error'** to maintain audit trail |
| Location | Delete button in the **footer of EditAnimalDialog**, styled as destructive |
| Confirmation | **Two-step confirmation** with reason input required |
| Audit trail | Store `exit_reason: 'data_error'`, `exit_notes: [user's reason]`, `is_deleted: true` |

---

## Changes Required

### Part 1: Add New Exit Reason for Data Errors

**File: `src/lib/bcsDefinitions.ts`**

Add a new exit reason specifically for data correction:

```typescript
export const EXIT_REASONS = [
  { value: 'sold', label: 'Sold', labelTagalog: 'Nabenta' },
  { value: 'died', label: 'Died', labelTagalog: 'Namatay' },
  { value: 'culled', label: 'Culled', labelTagalog: 'Tinanggal sa Kawan' },
  { value: 'transferred', label: 'Transferred', labelTagalog: 'Inilipat' },
  { value: 'slaughtered', label: 'Slaughtered', labelTagalog: 'Kinatay' },
  { value: 'data_error', label: 'Data Entry Error', labelTagalog: 'Mali sa Pagpasok ng Datos' },  // NEW
];
```

### Part 2: Add Delete Functionality to useEditAnimalForm Hook

**File: `src/components/animal-details/hooks/useEditAnimalForm.ts`**

Add a `handleDelete` function that:
1. Accepts a deletion reason
2. Updates the animal with `is_deleted: true`, `exit_reason: 'data_error'`, and `exit_notes`
3. Invalidates relevant queries
4. Shows success/error toast

```typescript
const [deleting, setDeleting] = useState(false);

const handleDelete = async (reason: string) => {
  if (!animal) return;
  
  setDeleting(true);
  try {
    const { error } = await supabase
      .from("animals")
      .update({
        is_deleted: true,
        exit_date: new Date().toISOString().split('T')[0],
        exit_reason: 'data_error',
        exit_notes: reason,
      })
      .eq("id", animal.id);

    if (error) throw error;

    queryClient.invalidateQueries({ queryKey: ["animal", animal.id] });
    queryClient.invalidateQueries({ queryKey: ["animals", farmId] });

    toast({
      title: "Animal Deleted",
      description: "The animal record has been removed from your farm.",
    });

    onSuccess();
  } catch (error: any) {
    toast({
      title: "Error deleting animal",
      description: translateError(error),
      variant: "destructive",
    });
  } finally {
    setDeleting(false);
  }
};

// Return deleting and handleDelete
return {
  // ...existing returns
  deleting,
  handleDelete,
};
```

### Part 3: Add Delete Button and Confirmation Dialog to EditAnimalDialog

**File: `src/components/animal-details/EditAnimalDialog.tsx`**

1. Add state for delete confirmation dialog and reason input
2. Add delete button in the dialog footer (left side, destructive variant)
3. Add AlertDialog for confirmation with reason textarea
4. Wire up the delete flow

**UI Layout in DialogFooter:**
```
[Delete Animal]                    [Cancel] [Save Changes]
(destructive, left)                        (right aligned)
```

**Delete Confirmation Dialog:**
- Title: "Delete Animal Record"
- Description: Explains this is for records added in error
- Required: Reason textarea (e.g., "Duplicate of A003", "Test data", "Wrong farm")
- Bilingual labels (English/Filipino)
- Buttons: Cancel, Delete (destructive)

---

## Technical Implementation

### EditAnimalDialog Changes:

```typescript
// New state
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
const [deleteReason, setDeleteReason] = useState("");

// From hook
const { deleting, handleDelete } = useEditAnimalForm(...);

// Delete confirmation handler
const confirmDelete = () => {
  if (!deleteReason.trim()) {
    toast({
      title: "Reason required",
      description: "Please provide a reason for deleting this animal record.",
      variant: "destructive",
    });
    return;
  }
  handleDelete(deleteReason);
};
```

### DialogFooter Layout:

```tsx
<DialogFooter>
  <div className="flex justify-between items-center w-full gap-4">
    {/* Left side - Delete button */}
    <Button
      variant="destructive"
      onClick={() => setShowDeleteConfirm(true)}
      disabled={saving || deleting}
    >
      <Trash2 className="h-4 w-4 mr-2" />
      Delete Animal
    </Button>
    
    {/* Right side - Cancel and Save */}
    <div className="flex gap-2">
      <Button variant="outline" onClick={handleClose} disabled={saving}>
        Cancel
      </Button>
      <Button onClick={handleSubmit} disabled={saving || !hasChanges || !isFormValid}>
        {saving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  </div>
</DialogFooter>
```

### Delete Confirmation AlertDialog:

```tsx
<AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle className="flex items-center gap-2 text-destructive">
        <Trash2 className="h-5 w-5" />
        Delete Animal Record
      </AlertDialogTitle>
      <AlertDialogDescription className="space-y-2">
        <p>
          This will permanently remove <strong>{animal.name || animal.ear_tag}</strong> from your farm records.
        </p>
        <p className="text-muted-foreground text-sm">
          Use this only for records that were added in error (e.g., duplicates, test data).
          For animals that left the farm, use "Record Exit" instead.
        </p>
      </AlertDialogDescription>
    </AlertDialogHeader>
    
    <div className="space-y-2 py-2">
      <Label htmlFor="delete-reason">
        Reason for deletion <span className="text-destructive">*</span>
      </Label>
      <Textarea
        id="delete-reason"
        value={deleteReason}
        onChange={(e) => setDeleteReason(e.target.value)}
        placeholder="e.g., Duplicate entry, Wrong farm, Test data..."
        rows={2}
      />
    </div>
    
    <AlertDialogFooter>
      <AlertDialogCancel onClick={() => setDeleteReason("")}>
        Cancel
      </AlertDialogCancel>
      <AlertDialogAction
        onClick={confirmDelete}
        disabled={!deleteReason.trim() || deleting}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        {deleting ? "Deleting..." : "Delete Animal"}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/bcsDefinitions.ts` | Add `data_error` to EXIT_REASONS |
| `src/components/animal-details/hooks/useEditAnimalForm.ts` | Add `deleting` state and `handleDelete` function |
| `src/components/animal-details/EditAnimalDialog.tsx` | Add delete button, confirmation dialog, and wire up deletion flow |

---

## User Flow

1. User opens EditAnimalDialog for an animal
2. User notices the animal was added by mistake
3. User clicks "Delete Animal" button (red, bottom-left)
4. Confirmation dialog appears asking for reason
5. User enters reason (e.g., "Duplicate of A003")
6. User clicks "Delete Animal" to confirm
7. Animal is soft-deleted with `exit_reason: 'data_error'`
8. Dialog closes, animal list refreshes
9. Toast confirms "Animal Deleted"

---

## Audit Trail

When an animal is deleted for error correction, the database will have:

```json
{
  "is_deleted": true,
  "exit_date": "2026-01-27",
  "exit_reason": "data_error",
  "exit_notes": "Duplicate entry - same animal already exists as A003"
}
```

This maintains full traceability while distinguishing error corrections from legitimate exits.
