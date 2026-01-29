
# Plan: Fix Financial Capacity Report - Herd Value and Data Source Alignment

## Problem Summary
The Farmer Financial Capacity Report shows an incorrect "Herd Value" of ₱70,000 instead of the dynamically calculated value (~₱473,550). This happens because:
1. A database column name mismatch causes valuation data to fail loading
2. The herd value logic falls back to `purchase_price` instead of calculating `weight × market_price`
3. The report doesn't use the same valuation approach as the dashboard

---

## Technical Analysis

### Current State (Broken)
```text
Herd Value Calculation Flow:
1. Fetch valuations → FAILS (wrong column name: "fair_value" vs "estimated_value")
2. Returns empty array []
3. For each animal:
   - Check valuation → None found
   - Check purchase_price → Only Tita Barbecue has ₱70,000
4. Total: ₱70,000 (only 1 of 6 animals valued)
```

### Expected State (Fixed)
```text
Herd Value Calculation Flow:
1. For each animal, get effective weight (current → entry → birth)
2. Fetch market price via get_market_price RPC
3. Calculate: effective_weight × market_price
4. Sum all animals
5. Total: ~₱473,550 (5 of 6 animals with weight × ₱350/kg)
```

---

## Changes Required

### File: `src/lib/financialReportGenerator.ts`

**Change 1: Fix Valuations Query Column Name**
- Location: `fetchValuationsData` function (~line 384-388)
- Change `fair_value` to `estimated_value`
- This fixes the silent failure when fetching historical valuations

**Change 2: Replace Market Price Fetch with RPC Call**
- Location: `fetchMarketPrice` function (~line 396-413)
- Use `supabase.rpc("get_market_price", {...})` like the dashboard
- Return the proper market price with source information

**Change 3: Align Herd Value Calculation with SSOT Pattern**
- Location: `processHerdSummary` function (~line 439-498)
- New logic:
  1. Use `getAnimalEffectiveWeight()` helper (already imported)
  2. Calculate per-animal value as: `effective_weight × market_price`
  3. Fallback to `estimated_value` from valuations if available
  4. Last resort: use `purchase_price`

**Change 4: Update HerdSummary Interface to Include Price Source**
- Add `priceSource: string` field to match dashboard data
- Helps transparency about where the price came from

---

## Implementation Details

### Updated `processHerdSummary` Logic

```text
For each active animal:
1. Get effective weight using priority: current_weight → entry_weight → birth_weight
2. If weight exists:
   - Calculate value = weight × marketPrice
3. Else if valuation exists:
   - Use valuation.estimated_value
4. Else if purchase_price exists:
   - Use purchase_price
5. Else:
   - Value = 0 (animal contributes 0 to herd value)
```

### Updated `fetchMarketPrice` Logic

```text
1. Call get_market_price RPC with livestock_type and farm_id
2. Return { price, source, effectiveDate }
3. Fallback to ₱300/kg only if RPC fails
```

---

## Affected Components

| Component | Change Type | Impact |
|-----------|-------------|--------|
| `financialReportGenerator.ts` | Fix + Enhancement | Core calculation fix |
| `HerdSummary` interface | Add field | Minor type update |
| Report PDF/CSV exports | None | Will automatically use corrected data |

---

## Expected Outcome

After the fix:
- **Herd Value**: Will show ~₱473,550 (calculated from weight × market price)
- **Market Price**: Will use ₱350/kg from DA Bulletin (via RPC)
- **Consistency**: Report values will match dashboard HerdValueChart
- **Data Source**: Each animal valued by weight × price (SSOT pattern)

---

## Testing Points
1. Open Financial Capacity Report and verify Herd Value matches dashboard
2. Confirm console logs show successful valuation fetching
3. Export PDF and verify correct herd value in document
4. Test with different period selections (3/6/12 months)
