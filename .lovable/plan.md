
# Make Breeding the Default Operations Sub-tab

## Change

One line change in `src/pages/Dashboard.tsx`: update the default value of `operationsSubtab` from `"milk"` to `"breeding"`.

## Technical Details

**File: `src/pages/Dashboard.tsx` (line 59)**

Change:
```typescript
const [operationsSubtab, setOperationsSubtab] = useState<string>("milk");
```
To:
```typescript
const [operationsSubtab, setOperationsSubtab] = useState<string>("breeding");
```

All existing deep-links (e.g. `/?tab=operations&subtab=milk` or `/?tab=operations&subtab=feed`) will continue to work because the URL parameter override logic on lines 302-308 already handles explicit subtab values. This change only affects the default when no subtab is specified.
