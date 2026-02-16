
# App-Wide Popup Scrollability Audit and Fix

## Problem
Multiple dialog, drawer, and sheet popups across the app lack proper scroll handling, causing content to overflow off-screen -- especially on mobile. The user's screenshots show the `RecordMilkSaleDialog` cutting off at the bottom with no way to scroll to the submit button.

## Root Cause Categories

There are three patterns causing the issue:

1. **No `max-h` or `overflow` at all** -- content grows beyond the viewport with no scroll mechanism
2. **`max-h` set but no `overflow-y-auto`** -- height is capped but overflow content is simply hidden
3. **`overflow-y-auto` on `DialogContent` directly** -- works on desktop but fights with the Radix Dialog's internal layout on mobile, preventing the footer/buttons from staying pinned

## Standardized Fix Pattern

Following the existing SSOT pattern established in `ResponsiveBCSContainer.tsx` and `EditAnimalDialog.tsx`, the correct structure for scrollable dialogs is:

```
DialogContent (max-h-[90vh], p-0 or flex flex-col, NO overflow)
  DialogHeader (flex-shrink-0, sticky)
  ScrollArea or div.overflow-y-auto (flex-1, contains form body)
  DialogFooter (flex-shrink-0, sticky at bottom)
```

This keeps header and footer pinned while allowing the body to scroll independently.

## Files Requiring Changes

### Critical (content cut off, no scroll -- visible in screenshots):

| File | Component | Current Issue |
|------|-----------|--------------|
| `src/components/milk-inventory/RecordMilkSaleDialog.tsx` | Milk Sale Dialog | `sm:max-w-md` only -- no max-height, no overflow. Content overflows off-screen on mobile. |
| `src/components/milk-recording/RecordSingleMilkDialog.tsx` | Record Milk Dialog | `sm:max-w-md` only -- no scroll handling. |
| `src/components/milk-recording/EditMilkRecordDialog.tsx` | Edit Milk Record | `sm:max-w-md` only -- no scroll handling. |
| `src/components/animal-expenses/AddAnimalExpenseDialog.tsx` | Add Expense | `sm:max-w-md` only -- no scroll handling. |
| `src/components/finance/AddRevenueDialog.tsx` | Add Revenue | `max-w-md` only -- no scroll handling. |
| `src/components/breeding/BreedingEventActions.tsx` | AI Breeding Dialog | `max-w-md` only -- no scroll handling. |
| `src/components/breeding/FarmRecordHeatDialog.tsx` | Record Heat | `max-w-md` only -- no scroll handling. |
| `src/components/breeding/FarmScheduleAIDialog.tsx` | Schedule AI | `max-w-md` only -- no scroll handling. |
| `src/components/breeding/BreedingStatusAnimalList.tsx` | Breeding Animal List | `max-w-sm` only -- no scroll handling. |
| `src/components/bio-card/OVRBadge.tsx` | OVR Details | `sm:max-w-md` only -- no scroll handling. |
| `src/components/preventive-health/AddPreventiveHealthDialog.tsx` | Preventive Health | `sm:max-w-md` only -- no scroll handling. |
| `src/components/marketplace/AddToCartDialog.tsx` | Add to Cart | `sm:max-w-md` only -- no scroll handling. |
| `src/components/admin/EditUserDialog.tsx` | Edit User | `sm:max-w-md` only -- no scroll handling. |
| `src/components/admin/CreateUserDialog.tsx` | Create User | `sm:max-w-[500px]` only -- no scroll handling. |
| `src/components/voice-training/VoiceTrainingOnboarding.tsx` | Voice Onboarding | `sm:max-w-md` only -- no scroll handling. |
| `src/components/MicrophonePermissionDialog.tsx` | Mic Permission | `sm:max-w-md` only -- no scroll handling. |
| `src/components/permissions/LocationPermissionDialog.tsx` | Location Permission | `sm:max-w-md` only -- no scroll handling. |
| `src/components/permissions/CameraPermissionDialog.tsx` | Camera Permission | `sm:max-w-md` only -- no scroll handling. |
| `src/components/merchant/InvoicePreview.tsx` | Invoice Preview | `max-w-3xl` only -- no scroll handling. |
| `src/components/OfflineOnboarding.tsx` | Offline Onboarding | `sm:max-w-md` only -- no scroll handling. |

### Moderate (has overflow-y-auto on DialogContent but footer not pinned):

| File | Current Issue |
|------|--------------|
| `src/components/feed-recording/RecordSingleFeedDialog.tsx` | `overflow-y-auto` on DialogContent -- footer scrolls away on long forms. |
| `src/components/feed-recording/EditFeedingRecordDialog.tsx` | Same issue. |
| `src/components/weight-recording/RecordSingleWeightDialog.tsx` | Same issue. |
| `src/components/health-records/AddHealthRecordDialog.tsx` | Same issue. |
| `src/components/breeding/RecordCalvingDialog.tsx` | Same issue. |
| `src/components/animal-exit/RecordAnimalExitDialog.tsx` | Same issue. |
| `src/components/feed-inventory/AddFeedStockDialog.tsx` | Same issue. |
| `src/components/merchant/ProductFormDialog.tsx` | Same issue. |
| `src/components/admin/EditFarmDialog.tsx` | Same issue. |
| `src/components/admin/AdminAnimalDialog.tsx` | Same issue. |

### Already Correct (no changes needed):

| File | Pattern Used |
|------|-------------|
| `src/components/animal-details/EditAnimalDialog.tsx` | ScrollArea with pinned header/footer |
| `src/components/body-condition/ResponsiveBCSContainer.tsx` | Responsive Drawer/Dialog with ScrollArea |
| `src/components/approval/ActivityDetailsDialog.tsx` | flex flex-col + ScrollArea |
| `src/components/farmer/OrderDetails.tsx` | ScrollArea inside DialogContent |
| `src/components/approval/EditSubmissionDialog.tsx` | flex flex-col with max-h |
| `src/components/admin/UserDetailPanel.tsx` | flex flex-col overflow-hidden (Sheet) |
| `src/components/admin/TicketDetailPanel.tsx` | flex flex-col overflow-hidden (Sheet) |

## Implementation Approach

For each file in the Critical and Moderate lists, apply the standardized pattern:

1. Add `max-h-[90vh] flex flex-col` to `DialogContent` (remove any `overflow-y-auto` from it)
2. Wrap the form body (between header and footer) in a `<div className="flex-1 overflow-y-auto px-6 pb-2">` or `<ScrollArea>`
3. Keep `DialogHeader` and `DialogFooter` outside the scroll wrapper with `flex-shrink-0`
4. For mobile-heavy dialogs (like `RecordMilkSaleDialog`), use `max-h-[100dvh] sm:max-h-[90vh]` to account for dynamic mobile browser chrome

## Data Flow Impact

None -- this is a pure UI/CSS change. No database queries, RPCs, hooks, or data flows are affected. No DRM or changelog updates needed beyond noting the UI fix.

## Verification Plan

After implementation, each dialog will be tested at mobile viewport (390x844) using `browser--navigate_to_sandbox` and `browser--screenshot` to confirm:
1. Content is scrollable when it exceeds viewport height
2. Submit/Cancel buttons remain visible and accessible
3. Dialog header stays pinned at top
