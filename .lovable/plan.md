
# Edit Feeding Record Functionality

## Overview
Implement edit/update functionality for feeding records, following the established `EditMilkRecordDialog` pattern. This includes updating the `feeding_records` table, reversing inventory deductions when feed type or quantity changes, and updating related expense records.

## Current State Analysis

### Data Model (from `types.ts`)

**`feeding_records` table:**
| Column | Type | Description |
|--------|------|-------------|
| id | string | Primary key |
| animal_id | string | FK to animals |
| record_datetime | string | Date/time of feeding |
| feed_type | string | Feed type name |
| kilograms | number | Amount fed |
| feed_inventory_id | string (nullable) | FK to feed_inventory (null for Fresh Cut) |
| cost_per_kg_at_time | number (nullable) | Locked cost at consumption |
| notes | string (nullable) | Optional notes |
| created_by | string (nullable) | FK to profiles |

**Related tables affected by edits:**
- `feed_inventory`: quantity_kg must be adjusted
- `feed_stock_transactions`: new adjustment record needed
- `farm_expenses`: linked expenses must be updated

### Existing Patterns

The `RecordSingleFeedDialog.tsx` creates:
1. A `feeding_records` entry with `feed_inventory_id` and `cost_per_kg_at_time`
2. Updates `feed_inventory.quantity_kg` (deduction)
3. Creates `feed_stock_transactions` entry (type: 'consumption')
4. Creates `farm_expenses` entry with `linked_feed_inventory_id`

## Implementation Plan

### 1. Create `EditFeedingRecordDialog.tsx`

**File:** `src/components/feed-recording/EditFeedingRecordDialog.tsx`

**Props interface:**
```typescript
interface EditFeedingRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: FeedingRecordWithDetails;
  farmId: string;
  animalName: string;
  onSuccess?: () => void;
}

interface FeedingRecordWithDetails {
  id: string;
  animal_id: string;
  feed_type: string | null;
  kilograms: number | null;
  notes: string | null;
  record_datetime: string;
  feed_inventory_id: string | null;
  cost_per_kg_at_time: number | null;
}
```

**UI Components:**
- Date picker (with backdate validation)
- Feed type selector (dropdown from feed_inventory + "Fresh Cut and Carry")
- Kilograms input with stock validation
- Notes textarea
- Save/Cancel buttons

### 2. Update Logic (Complex Inventory Reversal)

When a feeding record is edited, the system must handle three scenarios:

**Scenario A: Same feed type, quantity changed**
- Calculate delta: `newKg - originalKg`
- Adjust inventory: `quantity_kg -= delta`
- Update expense amount based on new quantity

**Scenario B: Different feed type selected**
- Reverse original deduction: restore original `kilograms` to old inventory
- Apply new deduction to new inventory
- Update expense record with new linked_feed_inventory_id

**Scenario C: Changed to/from "Fresh Cut and Carry"**
- If changing FROM Fresh Cut TO inventory item: deduct from inventory, create expense
- If changing TO Fresh Cut FROM inventory: restore to inventory, delete expense

### 3. Database Operations Sequence

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Edit Feeding Record Flow                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Fetch original record details                                │
│     └─ Get original kg, feed_inventory_id, cost_per_kg          │
│                                                                  │
│  2. Calculate inventory adjustment                               │
│     ├─ If same feed_inventory_id:                               │
│     │   └─ delta = new_kg - original_kg                         │
│     │                                                            │
│     └─ If different feed_inventory_id:                          │
│         ├─ Restore original_kg to old inventory                 │
│         └─ Deduct new_kg from new inventory                     │
│                                                                  │
│  3. Update feed_inventory.quantity_kg                           │
│     └─ Create feed_stock_transactions (type: 'adjustment')      │
│                                                                  │
│  4. Update feeding_records row                                   │
│     ├─ kilograms                                                 │
│     ├─ feed_type                                                │
│     ├─ feed_inventory_id                                        │
│     ├─ cost_per_kg_at_time (recalculate if new feed type)       │
│     ├─ record_datetime                                          │
│     └─ notes                                                     │
│                                                                  │
│  5. Update/Create/Delete farm_expenses                          │
│     ├─ Find expense by animal_id + description match            │
│     ├─ Update amount if quantity changed                        │
│     └─ Delete if changed to Fresh Cut (no cost)                 │
│                                                                  │
│  6. Invalidate queries                                           │
│     └─ feeding-records, feed-inventory, animal-expenses         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Update `FeedingRecords.tsx` Component

Add edit functionality to the record display:

**Mobile view changes:**
- Add edit icon button to each record card
- Track selected record for editing

**Desktop table changes:**
- Add "Actions" column with edit button

**State additions:**
```typescript
const [editDialogOpen, setEditDialogOpen] = useState(false);
const [selectedRecord, setSelectedRecord] = useState<FeedingRecordWithDetails | null>(null);
```

### 5. Update Interface for FeedingRecord

Extend the existing interface to include inventory-related fields:

```typescript
interface FeedingRecord {
  id: string;
  animal_id: string;
  feed_type: string | null;
  kilograms: number | null;
  notes: string | null;
  record_datetime: string;
  created_at: string;
  created_by: string | null;
  // Add these fields for edit functionality:
  feed_inventory_id: string | null;
  cost_per_kg_at_time: number | null;
}
```

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/components/feed-recording/EditFeedingRecordDialog.tsx` | Create | New edit dialog component |
| `src/components/FeedingRecords.tsx` | Modify | Add edit button, integrate dialog |

## Technical Considerations

1. **Stock validation**: When editing to increase quantity, check if sufficient stock exists
2. **Fresh Cut handling**: No inventory/expense tracking for Fresh Cut and Carry
3. **Cost locking**: Recalculate `cost_per_kg_at_time` only if feed type changes
4. **Offline support**: Edit functionality will be online-only initially (matches EditMilkRecordDialog pattern)
5. **Query invalidation**: Ensure all related caches are refreshed after edit

## Edge Cases Handled

- Editing a record where the original feed_inventory item was deleted
- Changing from inventory-tracked feed to Fresh Cut (expense deletion)
- Changing from Fresh Cut to inventory-tracked (expense creation)
- Stock insufficient for increased quantity
- Record date validation against farm entry date

---

## Summary

This implementation provides complete CRUD functionality for feeding records, aligning with the Doc Aga SSOT pattern established in the project architecture. The edit dialog follows the existing `EditMilkRecordDialog` pattern while handling the additional complexity of inventory deduction reversals and expense record synchronization.
