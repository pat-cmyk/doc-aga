
# Enable Animal Editing in Pending Approval Phase + ALL Species Voice Selection

## Overview

This plan enables both farmhands and farm managers/owners to edit pending activity submissions including animal selection, and ensures voice input supports "ALL Animals" and "ALL + specific species" options.

## Current Gaps

| Area | Current State | Target State |
|------|---------------|--------------|
| EditSubmissionDialog | Only edits activity_data fields | Also allows animal selection changes |
| PendingActivitiesQueue | No edit option for managers | Add Edit button for managers |
| usePendingActivities hook | Update doesn't include animal_ids | Include animal_ids in update |
| Animal selection in dialog | Not available | Full combobox with ALL/species options |

---

## Part 1: Enhance EditSubmissionDialog with Animal Selection

### File: `src/components/approval/EditSubmissionDialog.tsx`

**Changes:**
1. Add `farmId` prop to fetch farm animals
2. Import and use `useFarmAnimals` hook and `AnimalCombobox` component
3. Add animal selection field with ALL/species options
4. Store selected animal IDs and pass them in onSave callback
5. Support multi-animal display and selection

```typescript
// New props interface
interface EditSubmissionDialogProps {
  activity: PendingActivity | null;
  mode: 'edit' | 'resubmit';
  farmId: string;  // NEW
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (activityData: any, animalIds: string[]) => void;  // UPDATED
  isSaving: boolean;
}
```

**New animal selection section:**
- Show current animal count
- AnimalCombobox with "All Animals", "All Cattle", "All Goat", etc. options
- Individual animal selection
- Update selected animals in local state

---

## Part 2: Update usePendingActivities Hook

### File: `src/hooks/usePendingActivities.ts`

**Changes to updateMutation:**
```typescript
const updateMutation = useMutation({
  mutationFn: async ({ 
    pendingId, 
    activityData,
    animalIds  // NEW
  }: { 
    pendingId: string; 
    activityData: any;
    animalIds?: string[];  // NEW
  }) => {
    const updatePayload: any = { 
      activity_data: activityData,
      submitted_at: new Date().toISOString()
    };
    
    // Include animal_ids if provided
    if (animalIds && animalIds.length > 0) {
      updatePayload.animal_ids = animalIds;
    }
    
    const { error } = await supabase
      .from('pending_activities')
      .update(updatePayload)
      .eq('id', pendingId)
      .eq('status', 'pending');
    
    if (error) throw error;
  },
  // ...
});
```

**Similar changes to resubmitMutation** for rejected activity resubmission.

**Update function signatures:**
```typescript
updateActivity: (pendingId: string, activityData: any, animalIds?: string[]) => void;
resubmitActivity: (pendingId: string, activityData: any, animalIds?: string[]) => void;
```

---

## Part 3: Add Edit Button to Manager's PendingActivitiesQueue

### File: `src/components/approval/PendingActivitiesQueue.tsx`

**Changes:**
1. Import EditSubmissionDialog
2. Add state for editing activity
3. Add edit mutation functions from hook
4. Add "Edit" button alongside "Quick Approve" and "View Details"
5. Render EditSubmissionDialog with farmId prop

```typescript
// Add to imports
import { EditSubmissionDialog } from "./EditSubmissionDialog";

// Add state
const [editingActivity, setEditingActivity] = useState<PendingActivity | null>(null);

// Add to usePendingActivities destructuring
const { updateActivity, isUpdating } = usePendingActivities(farmId);

// Add Edit button in card actions
<Button
  size="sm"
  variant="outline"
  onClick={(e) => {
    e.stopPropagation();
    setEditingActivity(activity);
  }}
>
  <Pencil className="h-4 w-4 mr-1" />
  Edit
</Button>
```

---

## Part 4: Update MySubmissions to Pass Animal IDs

### File: `src/components/approval/MySubmissions.tsx`

**Changes:**
1. Update handleSave to include animalIds parameter
2. Pass farmId to EditSubmissionDialog (need to get from activity)

```typescript
const handleSave = (activityData: any, animalIds: string[]) => {
  if (!editingActivity) return;
  
  if (dialogMode === 'edit') {
    updateActivity(editingActivity.id, activityData, animalIds);
  } else {
    resubmitActivity(editingActivity.id, activityData, animalIds);
  }
  setEditingActivity(null);
};
```

---

## Part 5: Voice Selection for ALL Species

The AnimalSelectionStep already supports "All {species}" selection through:
- `handleTypeSelectAll()` function
- Grouped display by livestock type
- `selection: 'ALL'` in the callback

The `useFarmAnimals.ts` already provides species-based quick options:
```typescript
// Already exists in getAnimalDropdownOptions():
options.push({
  value: `species:${species}`,
  label: `All ${species.charAt(0).toUpperCase() + species.slice(1)} (${count})`,
  group: 'quick',
});
```

**No changes needed** - voice animal selection already supports ALL and ALL Species through AnimalSelectionStep.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/approval/EditSubmissionDialog.tsx` | Add farmId prop, animal selection with combobox, update onSave signature |
| `src/hooks/usePendingActivities.ts` | Add animalIds to update/resubmit mutations |
| `src/components/approval/PendingActivitiesQueue.tsx` | Add Edit button and EditSubmissionDialog for managers |
| `src/components/approval/MySubmissions.tsx` | Pass animalIds in handleSave, get farmId from activity |

---

## User Flow After Implementation

### Farmhand Flow:
1. Submit voice activity → Goes to pending queue
2. View "My Submissions" → See pending activities
3. Click Edit → Opens dialog with animal selector
4. Change animals using combobox (All Animals, All Cattle, individual, etc.)
5. Save → Updates pending_activities.animal_ids

### Manager/Owner Flow:
1. View "Pending Approvals" queue
2. Click "Edit" button on any pending activity
3. Opens same dialog with animal selector
4. Modify animals or activity data
5. Save → Updates pending activity
6. Can then Approve or continue reviewing

---

## Technical Notes

- RLS policies already allow:
  - Farmhands: UPDATE own pending/rejected
  - Managers/Owners: UPDATE any farm pending
- The `animal_ids` column is an array type (ARRAY) that can be updated directly
- Voice "ALL Animals" and "ALL Cattle/Goat/Carabao" already works via AnimalSelectionStep component
