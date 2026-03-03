

# Fix: 2 Remaining Build Errors

## Error 1: `src/components/milk-inventory/FeedMilkToAnimalDialog.tsx` lines 79-80

Accessing `.animals` on `AnimalDataCache` which doesn't have that property. Need to check what the correct property name is on `AnimalDataCache`.

## Error 2: `src/lib/dataCache.ts` lines 1289, 1292

Accessing `.id` on `GenericStringError` type. The optimistic record entry likely needs a type narrowing check before accessing `.id`.

### Investigation needed

I need to read these files to confirm the exact fixes. Let me look at the types and usages.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/milk-inventory/FeedMilkToAnimalDialog.tsx` | Fix `.animals` property access on `AnimalDataCache` |
| `src/lib/dataCache.ts` | Fix `.id` access on `GenericStringError` at lines 1289/1292 |

