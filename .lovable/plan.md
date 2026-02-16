

# Display "Source Farm" in Animal Profile Tab

## What This Does

Adds a **"Source Farm"** data row to the animal profile details section, visible for all acquired animals (purchased or grant). Shows the farm name if available, or "No data available" if the field is empty. This completes the SSOT data flow from database to display.

## Change (1 file)

### `src/components/AnimalDetails.tsx` (line ~940)

Insert a new row after the "Acquisition" display block (line 940), still inside the `farm_entry_date` conditional block (which covers all acquired/new entrant animals):

```tsx
{/* Source Farm */}
<div>
  <p className="text-muted-foreground">Source Farm</p>
  <p className="font-medium">
    {animal.source_farm
      ? animal.source_farm
      : <span className="text-muted-foreground italic">No data available</span>
    }
  </p>
</div>
```

This sits naturally after the Acquisition info since both relate to how the animal was sourced. Farm-born animals (no `farm_entry_date`) won't show this field since it's not applicable to them.

## SSOT Data Flow (Complete)

```
animals.source_farm (DB column)
       |
       v
useAnimalDetails.ts (Animal interface) -- DONE
       |
       v
AnimalDetails.tsx (Profile display) -- THIS CHANGE
AnimalForm.tsx (Add form UI) -- DONE
EditAnimalDialog.tsx (Edit All Details UI) -- DONE
EditAcquisitionWeightDialog.tsx (Quick-edit dialog) -- DONE
       |
       v
DRM documentation -- DONE
```

## No Other Changes Needed

The `Animal` interface already includes `source_farm`, and the data is already fetched via `select("*")`. This is a single-line UI addition.
