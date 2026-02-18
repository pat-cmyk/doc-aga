
# Fix FAB Dialog Scrollability — Standardized Popup Scroll Pattern

## Problem

When FAB-launched dialogs (Record Milk, Record Feed, Record Health, Record BCS) have content taller than the viewport — especially on mobile with rejection reasons, split previews, or many form fields — the content overflows without a scrollbar. Users cannot reach the submit button.

## Root Cause

These dialogs do NOT follow the app's standardized "Sticky Header/Footer" scroll pattern that 23+ other dialogs already use. Specifically:

| Dialog | Current `DialogContent` class | Missing |
|--------|------------------------------|---------|
| `RecordBulkMilkDialog` | `sm:max-w-md` | `max-h-[100dvh] sm:max-h-[90vh] flex flex-col overflow-hidden` |
| `RecordBulkFeedDialog` | `sm:max-w-md` | `max-h-[100dvh] sm:max-h-[90vh] flex flex-col overflow-hidden` |
| `RecordBulkHealthDialog` | `sm:max-w-md max-h-[90vh] overflow-y-auto` | Partially correct but missing `100dvh` for mobile, not using flex layout |
| `RecordBulkBCSDialog` | Uses a wrapper component — needs separate check | May need the same fix |

The standardized pattern (used by `AddRevenueDialog`, `EditMilkRecordDialog`, `AddHealthRecordDialog`, etc.) is:

```
DialogContent: max-h-[100dvh] sm:max-h-[90vh] flex flex-col overflow-hidden
DialogHeader:  flex-shrink-0
Body:          flex-1 overflow-y-auto
DialogFooter:  flex-shrink-0
```

## Files to Change

### 1. `src/components/milk-recording/RecordBulkMilkDialog.tsx`
- Line 434: Add `max-h-[100dvh] sm:max-h-[90vh] flex flex-col overflow-hidden` to DialogContent
- Add `flex-shrink-0` to DialogHeader
- Wrap the body `div.space-y-4` (line 479) with `flex-1 overflow-y-auto`
- Extract the footer buttons into a `flex-shrink-0` section outside the scrollable area

### 2. `src/components/feed-recording/RecordBulkFeedDialog.tsx`
- Same pattern: Add scroll constraints to DialogContent, make header/footer sticky, body scrollable

### 3. `src/components/health-recording/RecordBulkHealthDialog.tsx`
- Currently uses `max-h-[90vh] overflow-y-auto` — upgrade to the full flex pattern with `100dvh` for mobile and sticky header/footer

### 4. `src/components/body-condition/RecordBulkBCSDialog.tsx`
- Verify and apply the same pattern if it uses a raw Dialog (it appears to use a wrapper component — will check and align)

## What This Does NOT Touch

- `UnifiedActionsFab.tsx` — the FAB itself is fine; the issue is inside the dialogs it opens
- No farmer/merchant/vet/government code changes
- No database changes
- No new files created

## Verification Plan

After applying fixes:
1. Navigate to the farm dashboard on mobile viewport (390x844)
2. Open FAB -> Record Milk -> select animals, add rejection reason -> confirm scrollbar appears and submit button is reachable
3. Repeat for Feed, Health, and BCS dialogs
4. Screenshot proof at mobile viewport
