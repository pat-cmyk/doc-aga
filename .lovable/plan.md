

# Plan: Include Feed Consumption Costs in Herd Investment (SSOT Fix)

## Summary

This fix ensures the Herd Investment calculation follows the Single Source of Truth pattern by including consumption-based feed costs from `feeding_records` alongside manual expenses from `farm_expenses`.

---

## Current State

| Source | Current Total | Included in Herd Investment? |
|--------|---------------|------------------------------|
| Animal Purchase Prices | ₱70,000 | Yes |
| Manual Animal Expenses (`farm_expenses`) | ₱8,427 | Yes |
| Feed Consumption Costs (`feeding_records`) | ₱39,930 | **No** |

**Current Total Shown**: ₱78,427
**Actual Total Should Be**: ₱118,357

---

## Changes Required

### File 1: `src/hooks/useHerdInvestment.ts`

**Update Interface** - Add new fields for transparency:

```typescript
export interface HerdInvestment {
  totalPurchasePrice: number;
  totalAnimalExpenses: number;      // Now includes feed consumption
  manualExpenses: number;           // NEW: Just farm_expenses
  feedConsumptionCost: number;      // NEW: From feeding_records
  totalInvestment: number;
  // ... existing fields
}
```

**Add Feed Consumption Query** - After the expenses query:

```typescript
// Get feed consumption costs from feeding_records
const { data: feedingRecords, error: feedingError } = await supabase
  .from("feeding_records")
  .select(`
    kilograms,
    cost_per_kg_at_time,
    animal:animals!inner(farm_id)
  `)
  .eq("animal.farm_id", farmId)
  .not("cost_per_kg_at_time", "is", null);

if (feedingError) throw feedingError;

const feedConsumptionCost = feedingRecords?.reduce(
  (sum, record) => sum + (record.kilograms * (record.cost_per_kg_at_time || 0)),
  0
) || 0;
```

**Update Return Object**:

```typescript
const manualExpenses = expenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;

return {
  totalPurchasePrice,
  manualExpenses,
  feedConsumptionCost,
  totalAnimalExpenses: manualExpenses + feedConsumptionCost,  // Combined
  totalInvestment: totalPurchasePrice + manualExpenses + feedConsumptionCost,
  // ... rest of fields
};
```

---

### File 2: `src/components/farm-dashboard/HerdInvestmentSheet.tsx`

**Update Cost Breakdown Section** - Replace the single "Animal Expenses" line with a detailed breakdown:

```text
Before:
  Purchase Costs     ₱70K
  Animal Expenses    ₱8K    <-- misleading
  ─────────────────────
  Total Investment   ₱78K

After:
  Purchase Costs       ₱70K
  Manual Expenses      ₱8K
  Feed Consumption     ₱40K   <-- NEW line
  ─────────────────────────
  Total Investment     ₱118K
```

**Code Changes**:

Add a new row in the cost breakdown section:

```tsx
{/* Cost Breakdown */}
<div className="space-y-2 pt-2 border-t">
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">Purchase Costs</span>
    <span className="font-medium">{formatCurrency(investmentData.totalPurchasePrice)}</span>
  </div>
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">Manual Expenses</span>
    <span className="font-medium">{formatCurrency(investmentData.manualExpenses)}</span>
  </div>
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">Feed Consumption</span>
    <span className="font-medium">{formatCurrency(investmentData.feedConsumptionCost)}</span>
  </div>
  <div className="flex justify-between text-sm font-medium pt-2 border-t">
    <span>Total Investment</span>
    <span>{formatCurrency(investmentData.totalInvestment)}</span>
  </div>
</div>
```

---

## Data Flow After Fix

```text
┌─────────────────────────────┐
│      Herd Investment        │
│        ₱118,357             │
└─────────────────────────────┘
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
┌─────────┐ ┌─────────┐ ┌─────────────────┐
│Purchase │ │ Manual  │ │Feed Consumption │
│ ₱70,000 │ │ ₱8,427  │ │    ₱39,930      │
└─────────┘ └─────────┘ └─────────────────┘
    │           │               │
    │           │               │
animals    farm_expenses   feeding_records
(purchase  (animal_id      (kilograms ×
 _price)    not null)      cost_per_kg)
```

---

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Dashboard Card | ₱78K | ₱118K |
| Purchase Costs | ₱70K | ₱70K |
| Manual Expenses | ₱8K (labeled "Animal Expenses") | ₱8K (labeled "Manual Expenses") |
| Feed Consumption | Not shown | ₱40K (new line) |
| Total Investment | ₱78K | ₱118K |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/hooks/useHerdInvestment.ts` | Add feed consumption query, update interface and calculations |
| `src/components/farm-dashboard/HerdInvestmentSheet.tsx` | Add feed consumption line in cost breakdown |

---

## Testing Checklist

1. Open the Farm Dashboard
2. Click on the "Herd Investment" card to open the sheet
3. Verify total shows ~₱118K instead of ₱78K
4. Verify breakdown shows three lines: Purchase Costs, Manual Expenses, Feed Consumption
5. Verify Feed Consumption matches the Feed Stock Audit total (~₱40K)
6. Cross-check: Purchase + Manual + Feed = Total Investment

