
# Add Milk Quality Status and Rejection Reason to Milk Recording

## Overview

Add a "Quality Status" dropdown (Good / Rejected) to all milk recording forms. When "Rejected" is selected, a second dropdown appears for the rejection reason. Rejected milk should NOT enter the sellable milk inventory.

## Schema Changes

**Table: `milking_records`** -- Add two columns:

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `milk_quality` | text | `'good'` | Values: `'good'`, `'rejected'` |
| `milk_quality_rejection_reason` | text (nullable) | null | Reason when rejected |

**Trigger update: `sync_milk_inventory_on_insert`** -- Modify the existing trigger so that when `milk_quality = 'rejected'`, the corresponding `milk_inventory` row is inserted with `is_available = false` and `liters_remaining = 0`. This prevents rejected milk from appearing in the sellable inventory.

## Rejection Reasons (Dropdown Options)

Following the app standard (`No Data / Hindi Alam` for unknown):

| Value | Label |
|-------|-------|
| `abnormal_color` | Abnormal Color / Kakaibang Kulay |
| `blood_in_milk` | Blood in Milk / May Dugo |
| `bad_smell` | Bad Smell / Mabaho |
| `clots_or_flakes` | Clots or Flakes / May Buo-buo |
| `watery` | Watery / Malapot |
| `contaminated` | Contaminated / Kontaminado |
| `mastitis` | Mastitis Suspected / Hinala na Mastitis |
| `antibiotic_withdrawal` | Antibiotic Withdrawal Period |
| `other` | Other / Iba Pa |
| `none` | No Data / Hindi Alam |

## Files to Modify

### 1. Database Migration (new file)
- Add `milk_quality` and `milk_quality_rejection_reason` columns to `milking_records`
- Update `sync_milk_inventory_on_insert()` trigger to check `milk_quality` and set `is_available = false` for rejected milk
- Update `sync_milk_inventory_on_update()` trigger to handle quality changes on edits

### 2. `src/components/milk-recording/RecordSingleMilkDialog.tsx`
- Add `milkQuality` state (default `'good'`)
- Add `rejectionReason` state (default `''`)
- Add Quality Status `Select` dropdown after Liters input
- Conditionally show Rejection Reason `Select` when quality is `'rejected'`
- Include `milk_quality` and `milk_quality_rejection_reason` in the insert payload
- Include in offline queue payload

### 3. `src/components/milk-recording/RecordBulkMilkDialog.tsx`
- Same Quality + Rejection Reason dropdowns (applies to entire batch)
- Include in insert records and offline queue payload

### 4. `src/components/milk-recording/EditMilkRecordDialog.tsx`
- Add Quality + Rejection Reason dropdowns, pre-populated from existing record
- Include in update payload

### 5. `src/components/milk-inventory/EditMilkRecordDialog.tsx`
- Add Quality + Rejection Reason dropdowns to the inventory-side edit dialog
- Include in update payloads for both `milk_inventory` and `milking_records`

### 6. `src/components/farmhand/ActivityConfirmation.tsx`
- When voice data includes quality info, carry it into `activity_data`

### 7. Approval RPC (`approve_pending_activity`)
- Carry `milk_quality` and `milk_quality_rejection_reason` from pending activity data into the `milking_records` insert

## Data Flow (SSOT)

```
Recording Form (quality dropdown) --> milking_records (milk_quality, milk_quality_rejection_reason)
                                       |
                                       v (trigger: sync_milk_inventory_on_insert)
                                   milk_inventory (is_available = quality != 'rejected')
                                       |
                                       v
                                   Milk Inventory Tab (rejected milk hidden from sale)
```

## Technical Details

### Migration SQL

```sql
-- Add milk quality columns
ALTER TABLE milking_records ADD COLUMN milk_quality text NOT NULL DEFAULT 'good';
ALTER TABLE milking_records ADD COLUMN milk_quality_rejection_reason text;

-- Update inventory sync trigger for inserts
CREATE OR REPLACE FUNCTION sync_milk_inventory_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.milk_inventory (
    farm_id, animal_id, milking_record_id, record_date,
    liters_original, liters_remaining, is_available, client_generated_id
  )
  SELECT
    a.farm_id,
    NEW.animal_id,
    NEW.id,
    COALESCE(NEW.record_date, CURRENT_DATE),
    NEW.liters,
    CASE WHEN NEW.milk_quality = 'rejected' THEN 0 ELSE NEW.liters END,
    CASE WHEN NEW.milk_quality = 'rejected' THEN false ELSE true END,
    NEW.client_generated_id
  FROM animals a
  WHERE a.id = NEW.animal_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

### UI Conditional Logic

```
if milk_quality === 'rejected':
  - Show rejection reason dropdown (required)
  - Toast message changes to: "XL (Rejected) recorded"
  - Milk does NOT appear in sellable inventory
else:
  - Hide rejection reason dropdown
  - Normal flow
```

### Existing Patterns Used
- `Select` dropdown component (same as Session selector)
- Bilingual labels matching `No Data / Hindi Alam` standard
- `hapticSelection()` on dropdown change
- Offline queue payload extension (same pattern as `session` field)
