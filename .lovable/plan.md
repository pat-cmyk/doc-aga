

# Milk-to-Calf Feeding + Rejected Milk Inventory

## Overview

Add the ability to feed milk (good or rejected) from the milk inventory to any animal on the farm, with FIFO deduction, feeding history tracking, and opportunity-cost accounting. Rejected milk gets its own visible section in the inventory tab instead of being silently discarded.

## SSOT Data Flow

```text
milking_records (quality: good/rejected)
       |
       v (DB trigger: sync_milk_inventory_on_insert)
milk_inventory
  ├── is_available = true, milk_quality = 'good'   --> Sellable Stock section
  └── is_available = true, milk_quality = 'rejected' --> Rejected Stock section (NEW)
       |
       v  (Feed Calf dialog -- FIFO deduction)
  milk_inventory.liters_remaining reduced
       |
       v  (Insert into feeding_records)
  feeding_records
    ├── feed_type = 'Whole Milk' or 'Waste Milk'
    ├── milk_inventory_id = UUID (NEW column -- links to batch)
    ├── cost_per_kg_at_time = price/L from useLastMilkPriceBySpecies (good) or 0 (rejected)
    └── kilograms = liters (1L milk ~ 1.03kg, use 1:1 for simplicity)
       |
       v  (Existing SSOT paths)
  FeedingRecords.tsx (animal feeding history -- already shows feed_type + cost)
  useHerdInvestment (already sums feeding_records.cost_per_kg_at_time * kilograms)
  useAnimalExpenses (already sums per-animal feed costs)
```

No new hooks or RPCs needed. The existing `feeding_records` cost-tracking pipeline already flows into Herd Investment and the animal Costs tab.

---

## Database Changes (1 migration)

### A. Add `milk_quality` column to `milk_inventory`

Currently rejected milk is set to `is_available = false, liters_remaining = 0`. We need to:
- Add `milk_quality TEXT NOT NULL DEFAULT 'good'` to `milk_inventory`
- Add `milk_quality_rejection_reason TEXT` to `milk_inventory`

### B. Add `milk_inventory_id` column to `feeding_records`

- Add `milk_inventory_id UUID REFERENCES milk_inventory(id)` (nullable) to `feeding_records`
- This mirrors the existing `feed_inventory_id` pattern for solid feed

### C. Update trigger: `sync_milk_inventory_on_insert()`

Change behavior for rejected milk:
- **Before**: `is_available = false, liters_remaining = 0`
- **After**: `is_available = true, liters_remaining = NEW.liters, milk_quality = 'rejected'`

This keeps rejected milk in a trackable, feedable state.

### D. Update trigger: `sync_milk_inventory_on_update()`

When quality changes from good to rejected (or vice versa), update `milk_quality` on the inventory row instead of zeroing it out. Keep `is_available = true` so it can still be fed to animals.

---

## Frontend Changes

### 1. UPDATE: `src/hooks/useMilkInventory.ts`

Add a second data set for rejected milk inventory:
- Query `milk_inventory` WHERE `milk_quality = 'rejected'` AND `liters_remaining >= 0.05`
- Return `rejectedItems` and `rejectedSummary` alongside the existing `items`/`summary`
- The existing query already filters `is_available = true`, so adding `milk_quality = 'good'` to it keeps sellable stock pure

### 2. UPDATE: `src/components/milk-inventory/MilkInventoryTab.tsx`

Add a third sub-tab or a section within "Current Stock":
- **Option A (approved)**: Separate section within the same "Current Stock" tab
- Show "Sellable Stock" section (current behavior)
- Show "Rejected Stock" section below it with a distinct visual (amber/warning border)
- Each section gets its own "Feed to Animal" button instead of "Record Sale"

### 3. UPDATE: `src/components/milk-inventory/MilkStockList.tsx`

- Add a "Feed to Animal" button alongside "Record Sale"
- Pass `stockType: 'good' | 'rejected'` to differentiate button labels
- "Record Sale" only appears for good-quality stock
- "Feed to Animal" appears for both

### 4. CREATE: `src/components/milk-inventory/FeedMilkToAnimalDialog.tsx`

New dialog that mirrors `RecordMilkSaleDialog` structure:
- **Animal selector**: Dropdown of all active farm animals (fetched via `useFarmAnimals`)
  - Each option shows: `{name || ear_tag} - {age}` (e.g., "NDA 123 - 3 months old" or "Bessie - No data available")
  - Age computed from `birth_date` using `differenceInMonths`
- **Liters input**: How much milk to feed
- **Feeding hint**: "Recommended: {X}-{Y}L/day for a {weight}kg animal (10-20% of body weight)"
  - Uses `current_weight_kg` from the selected animal
  - If no weight data: "No weight data -- typical calf intake is 4-6L/day"
- **FIFO preview**: Same as sale dialog -- shows which inventory batches will be deducted
- **Cost display**:
  - Good milk: Shows "Opportunity cost: [price] x [liters] = [total]" using `useLastMilkPriceBySpecies`
  - Rejected milk: Shows "Cost: Free (rejected milk)"
- **Submit logic**:
  1. Deduct `liters_remaining` from `milk_inventory` rows (FIFO, partial support)
  2. Mark fully consumed rows as `is_available = false`
  3. Insert `feeding_records` with:
     - `feed_type`: "Whole Milk" (good) or "Waste Milk" (rejected)
     - `milk_inventory_id`: linked batch ID
     - `cost_per_kg_at_time`: price/L (good) or 0 (rejected)
     - `kilograms`: liters value (1:1 approximation, industry standard)
  4. Refetch milk inventory queries

### 5. UPDATE: `src/components/FeedingRecords.tsx`

- No structural changes needed -- it already displays `feed_type` and cost
- "Whole Milk" and "Waste Milk" will naturally appear as feed types
- Cost display already handles zero-cost as "Free"

### 6. UPDATE: `docs/data-relationships-map.md`

- Add Milk Feeding SSOT flow
- Document `milk_inventory_id` in `feeding_records`

---

## Downstream Impact (Already Handled)

These existing SSOT paths will automatically pick up milk feeding costs with zero code changes:

| Component | How It Works |
|-----------|-------------|
| **Herd Investment** (`useHerdInvestment`) | Already sums `feeding_records.cost_per_kg_at_time * kilograms` per animal |
| **Animal Costs Tab** (`useAnimalExpenses`) | Already aggregates per-animal feed costs |
| **Feed Cost Analytics** (`FeedCostAnalytics`) | Already reads all `feeding_records` |
| **Profitability Thermometer** | Already includes feed costs via expenses |

Good milk fed to calves will appear as a real cost in Herd Investment (opportunity cost). Rejected milk fed to calves will appear as "Free" -- accurate since it had no market value.

---

## Files Summary (8 files)

| File | Action |
|------|--------|
| `supabase/migrations/[timestamp].sql` | **CREATE** - Add columns + update triggers |
| `src/hooks/useMilkInventory.ts` | EDIT - Add rejected inventory query |
| `src/components/milk-inventory/MilkInventoryTab.tsx` | EDIT - Wire rejected stock section |
| `src/components/milk-inventory/MilkStockList.tsx` | EDIT - Add "Feed to Animal" button, support stock types |
| `src/components/milk-inventory/FeedMilkToAnimalDialog.tsx` | **CREATE** - New FIFO milk feeding dialog |
| `src/components/FeedingRecords.tsx` | MINOR EDIT - Add milk emoji for Whole/Waste Milk feed types |
| `docs/data-relationships-map.md` | EDIT - Document new SSOT flow |
| `docs/ssot-architecture.md` | EDIT - Add milk feeding to core data flows |

