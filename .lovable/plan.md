

# Fix Farmer Voice Filter + Move Data Toggle to Header

## Issue 1: Feedback Not Filtering by Demo/Live

The hook code (`useGovernmentFeedback.ts`) is correct -- it has `farms!inner(...)` with `data_category` and the query-level `.eq('farms.data_category', ...)` filter. However, the browser is still running a stale build with the old query. The code change will be re-applied cleanly to ensure the build picks it up.

No logic changes needed in the hook -- just ensuring the build compiles correctly.

## Issue 2: Move Data Category Toggle to Header

Currently the Live/Demo/All selector sits inside the Livestock Analytics tab's action row (line 520 of GovernmentDashboard.tsx). When you switch to Farmer Voice or Programs tabs, the toggle disappears. Moving it to the header next to the WiFi icon makes it globally accessible from any tab.

### Changes

| File | Change |
|------|--------|
| `src/components/government/GovernmentLayout.tsx` | Accept `dataCategory` + `onDataCategoryChange` props; render the compact data source selector next to NetworkStatusIndicator |
| `src/pages/GovernmentDashboard.tsx` | (1) Pass `dataCategory` and `setDataCategory` to GovernmentLayout. (2) Remove the data source Select from the Livestock tab's action row (lines 519-545). (3) Remove the "Demo Mode" / "All Data" badge (lines 575-580) since the header toggle makes the state obvious. |

### GovernmentLayout Header (After)

```text
+------------------------------------------------------------------+
| [Philippine Flag]  Government Dashboard     [Toggle] [WiFi] [User] |
|                    Livestock industry...                           |
+------------------------------------------------------------------+
```

The data source selector will be a compact Select dropdown (same styling, same 3 options: Live/Demo/All) placed between the left title section and the right icon group, next to the NetworkStatusIndicator.

### Technical Details

- `GovernmentLayout` gets two new optional props: `dataCategory?: DataCategory` and `onDataCategoryChange?: (value: DataCategory) => void`
- When props are provided, render the Select in the header's right-side icon group
- When not provided (backward compatibility), header renders as before
- State remains owned by `GovernmentDashboard.tsx` -- no context needed
- URL persistence (`data_source` param) continues working unchanged
- The non-live badge indicator moves into the header selector itself (colored dot already shown in dropdown options)
