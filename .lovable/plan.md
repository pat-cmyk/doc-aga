

# Plan: Fix Animal Profile Cost Tab to Include Feed Consumption Costs (SSOT Alignment)

## Problem Summary

The Animal Profile "Cost" tab only reads from `farm_expenses` table, missing ₱7,608 in feed consumption costs for Mang Tomas and similar gaps across 18 animals totaling ~₱52K in untracked feed costs.

This directly mirrors the issue we just fixed for the Herd Investment card - we need to apply the same SSOT pattern to individual animal cost tracking.

## Changes Required

### File 1: `src/hooks/useAnimalExpenses.ts`

**Add Feed Consumption Query to Summary**

Update `useAnimalExpenseSummary` to include feed consumption costs from `feeding_records`:

```text
Current Data Sources:
  - farm_expenses (manual expenses only)

New Data Sources:
  - farm_expenses (manual expenses)
  - feeding_records (consumption-based costs: kilograms x cost_per_kg_at_time)
```

Update the interface and query:

```typescript
export interface AnimalExpenseSummary {
  totalExpenses: number;
  categoryBreakdown: Record<string, number>;
  expenseCount: number;
  feedConsumptionCost: number;  // NEW: From feeding_records
  manualExpenses: number;       // NEW: Just from farm_expenses
}
```

Add a second query for feeding costs:

```typescript
// Query feeding_records for this animal
const { data: feedingData } = await supabase
  .from("feeding_records")
  .select("kilograms, cost_per_kg_at_time")
  .eq("animal_id", animalId)
  .not("cost_per_kg_at_time", "is", null);

const feedConsumptionCost = feedingData?.reduce(
  (sum, r) => sum + ((r.kilograms || 0) * (r.cost_per_kg_at_time || 0)),
  0
) || 0;
```

---

### File 2: `src/components/animal-expenses/AnimalCostSummary.tsx`

**Add Feed Consumption Line to Breakdown**

Update the props interface and display:

```typescript
interface AnimalCostSummaryProps {
  // ... existing props
  feedConsumptionCost: number;  // NEW
  manualExpenses: number;       // NEW
}
```

Update the breakdown section to show:
- Acquisition Cost (purchase price or grant)
- Manual Expenses (from farm_expenses per category)
- Feed Consumption (from feeding_records) - NEW
- Total Investment

---

### File 3: `src/components/animal-expenses/AnimalExpenseTab.tsx`

**Pass New Props to AnimalCostSummary**

Update to pass the new `feedConsumptionCost` and `manualExpenses` from the updated summary hook:

```tsx
<AnimalCostSummary
  // ... existing props
  feedConsumptionCost={summary?.feedConsumptionCost || 0}
  manualExpenses={summary?.manualExpenses || 0}
  totalExpenses={summary?.totalExpenses || 0}  // Now includes feed consumption
/>
```

---

## Data Flow After Fix

```text
Animal Profile Cost Tab
          |
    +-----+-----+
    |           |
    v           v
farm_expenses  feeding_records
(manual)       (consumption)
    |               |
    +-------+-------+
            |
            v
   AnimalCostSummary
   (Unified Total)
```

---

## Expected Results for Mang Tomas

| Line Item | Before | After |
|-----------|--------|-------|
| Acquisition Cost | ₱0 | ₱0 |
| Manual Expenses | ₱54.90 | ₱54.90 |
| Feed Consumption | Not shown | ₱7,663.02 |
| **Total Investment** | **₱54.90** | **₱7,717.92** |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useAnimalExpenses.ts` | Add feeding_records query to summary, update interface |
| `src/components/animal-expenses/AnimalCostSummary.tsx` | Add feedConsumptionCost prop and display line |
| `src/components/animal-expenses/AnimalExpenseTab.tsx` | Pass new summary props |

---

## Technical Details

### Query for Feed Consumption (per animal)

```sql
SELECT SUM(kilograms * cost_per_kg_at_time) as feed_consumption_cost
FROM feeding_records
WHERE animal_id = :animalId
  AND cost_per_kg_at_time IS NOT NULL
```

### Consistency with Herd Investment

This fix aligns the Animal Profile Cost Tab with the Herd Investment calculation we just implemented, ensuring both use:
- `feeding_records.kilograms * cost_per_kg_at_time` for consumption-based costs
- `farm_expenses` for manual expense entries

---

## Testing Checklist

1. Open Mang Tomas's animal profile
2. Navigate to the Cost tab
3. Verify Feed Consumption line shows ~₱7,663
4. Verify Total Investment reflects the combined cost
5. Check other animals (Mang Flora, Tita Barbecue, Bessie) show similar feed consumption costs
6. Confirm Herd Investment total still matches the sum of all animal investments

