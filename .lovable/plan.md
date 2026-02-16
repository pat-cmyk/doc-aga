

# Add Cost Column to Feeding History

## What Changes

Show the cost (₱) alongside each feeding record so farmers can see that both kilograms and their peso equivalent are being tracked.

## UI Changes

**Desktop Table** -- Add a "Cost" column after "Amount (kg)":
- Displays `cost_per_kg_at_time * kilograms` formatted as ₱ (e.g., "₱57.60")
- Shows "Free" for records where cost is 0 (Fresh Cut & Carry)
- Shows "-" for records where cost is NULL (legacy untracked)

**Mobile Cards** -- Add a small cost line below the kg badge:
- Format: "₱57.60" in muted text, or "Free" / "-" for zero/null costs

## Technical Details

**File: `src/components/FeedingRecords.tsx`**

1. Import `formatPHP` from `@/lib/currency`
2. Add a helper to compute and format the record cost:
   ```typescript
   const formatRecordCost = (record: FeedingRecord) => {
     if (record.cost_per_kg_at_time === null) return "-";
     if (record.cost_per_kg_at_time === 0) return "Free";
     const total = (record.kilograms || 0) * record.cost_per_kg_at_time;
     return formatPHP(total, true);
   };
   ```
3. Desktop table: Add `<TableHead>Cost</TableHead>` after "Amount (kg)" and corresponding `<TableCell>{formatRecordCost(record)}</TableCell>`
4. Mobile cards: Add a small text line `<span className="text-xs text-muted-foreground">{formatRecordCost(record)}</span>` near the kg badge
5. Update the "Today's Feed" summary card to also show today's total cost below the kg total

No database or backend changes required -- `cost_per_kg_at_time` and `kilograms` are already fetched in the existing query.

