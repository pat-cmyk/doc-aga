

# Barn / Paddock Grouping System

## Overview

Create a barn/paddock system that lets farmers group animals by physical housing location. When recording activities (milking, feeding, health, BCS), the farmer selects a barn first, and the dialog opens pre-filtered to only show animals in that group. Assignment history is tracked so you can see where an animal was housed over time.

## Database Design

### New table: `barns`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| farm_id | UUID FK NOT NULL | Links to `farms.id` |
| name | TEXT NOT NULL | e.g., "Barn A", "Paddock 2", "Milking Shed" |
| description | TEXT | Optional notes |
| barn_type | TEXT NOT NULL DEFAULT 'barn' | 'barn' or 'paddock' |
| capacity | INTEGER | Optional max animal count |
| is_active | BOOLEAN DEFAULT true | Soft delete |
| created_by | UUID | Who created it |
| created_at | TIMESTAMPTZ DEFAULT now() | |

RLS: Farm members can read/write barns for their farm.

### New table: `barn_assignments`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| barn_id | UUID FK NOT NULL | Links to `barns.id` |
| animal_id | UUID FK NOT NULL | Links to `animals.id` |
| assigned_at | TIMESTAMPTZ DEFAULT now() | When the animal was placed here |
| removed_at | TIMESTAMPTZ NULL | When the animal was moved out (NULL = current) |
| assigned_by | UUID | Who made the assignment |
| farm_id | UUID FK NOT NULL | Denormalized for RLS efficiency |

- Unique constraint: One active assignment per animal (WHERE `removed_at IS NULL`)
- When moving an animal to a new barn, a trigger sets `removed_at = now()` on the old row and inserts a new one
- RLS: Farm members can read/write for their farm

### Add column to `animals` table
| Column | Type | Notes |
|--------|------|-------|
| current_barn_id | UUID FK NULL | Denormalized pointer to current barn for fast queries |

A trigger on `barn_assignments` keeps `animals.current_barn_id` in sync (set on insert, clear on removal).

## Frontend Components

### 1. Barn Management UI (`src/components/barns/`)

**BarnListView.tsx** -- Shown as a sub-section within the Animals tab
- Grid of barn cards showing: name, type icon, animal count, capacity utilization
- "Add Barn/Paddock" button
- Tap a barn card to expand and see its animals

**BarnFormDialog.tsx** -- Create/edit barn
- Fields: name, type (barn/paddock), description, capacity
- Bilingual labels following existing pattern

**BarnAnimalManager.tsx** -- Assign/remove animals from a barn
- Shown when a barn card is expanded
- Combobox to add animals (filtered to those not currently in this barn)
- List of current animals with "Remove" option
- Moving an animal that's already in another barn shows a confirmation: "Bessie is currently in Barn A. Move to Paddock 2?"

### 2. Pre-filter Integration in Recording Dialogs

The key integration point is `getAnimalDropdownOptions` in `useFarmAnimals.ts` and `useLactatingAnimals.ts`.

**New quick-select options added to the dropdown:**
```
Quick Select:
  All Animals (15)
  All Cattle (10)
  All Goats (5)
  --- NEW ---
  Barn A (6)        <-- barn: prefix
  Paddock 2 (4)     <-- barn: prefix
  Milking Shed (5)  <-- barn: prefix

Individual Animals:
  Bessie (350 kg)
  ...
```

**How it works:**
- `useFarmAnimals` query adds `current_barn_id` to the select
- `getAnimalDropdownOptions` fetches barns for the farm and adds `barn:{id}` options to the quick-select group
- `getSelectedAnimals` handles the `barn:` prefix by filtering animals whose `current_barn_id` matches
- Same pattern applied to `useLactatingAnimals` for milk recording

This means ALL existing recording dialogs (milk, feed, health, BCS) automatically get barn filtering with zero changes to the dialog components themselves -- they just use the existing `AnimalCombobox`.

### 3. Feed/Milk Split Awareness

No changes needed to `feedSplitCalculation.ts` or `milkSplitCalculation.ts`. The split formulas already work on whatever animal list they receive. When a farmer selects "Barn A", only Barn A's animals are passed to the split calculation. The allocation formula stays the same -- it just operates on a smaller, barn-scoped group.

### 4. Animal Profile Integration

In the animal bio/detail view, show current barn assignment and assignment history timeline:
- Current: "Barn A (since Jan 15, 2026)"
- History: "Paddock 2 (Oct 1 - Jan 14, 2026)"

## Data Flow

```text
barns table
  |
  +-- barn_assignments (with history) --+--> animals.current_barn_id (trigger-synced)
                                        |
                                        +--> useFarmAnimals hook (adds current_barn_id)
                                        |
                                        +--> getAnimalDropdownOptions (adds barn: options)
                                        |
                                        +--> getSelectedAnimals (filters by barn:)
                                        |
                                        +--> All recording dialogs (auto-filtered)
```

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | Create `barns`, `barn_assignments` tables, triggers, RLS, add `current_barn_id` to `animals` |
| `src/hooks/useBarns.ts` | NEW -- CRUD hook for barns and assignments |
| `src/components/barns/BarnListView.tsx` | NEW -- barn grid view for Animals tab |
| `src/components/barns/BarnFormDialog.tsx` | NEW -- create/edit barn dialog |
| `src/components/barns/BarnAnimalManager.tsx` | NEW -- assign/remove animals |
| `src/hooks/useFarmAnimals.ts` | Add `current_barn_id` to query, add barn options to dropdown |
| `src/hooks/useLactatingAnimals.ts` | Same barn option additions |
| `src/pages/Dashboard.tsx` | Add BarnListView section to Animals tab |
| `docs/data-relationships-map.md` | Document barn tables and triggers |
| `changelog.md` | Log the feature |

## What Stays The Same

- All recording dialog components (milk, feed, health, BCS) -- unchanged
- Split calculation formulas -- unchanged
- FAB actions -- unchanged (they open the same dialogs, farmer just picks a barn from the dropdown)
- Voice extractors -- unchanged (can be extended later to parse "feed Barn A")
- Offline sync -- unchanged (barn assignments sync like any other table)
