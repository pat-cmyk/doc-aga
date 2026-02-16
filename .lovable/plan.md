
# Continue Error Handling SSOT Migration (Batch 2)

## Scope

Complete the remaining ~30 files that still expose raw `error.message` to users. The core engine (`errorHandling.ts`) and helpers (`showErrorToast`, `showErrorToastLegacy`) are already in place from Batch 1.

## Files to Update

### Pages (3 files)

| File | Current Pattern | Change |
|------|----------------|--------|
| `src/pages/Dashboard.tsx` | `ownedFarmsResult.error.message` in toast | Use `showErrorToastLegacy(toast, error, "loading farm")` |
| `src/pages/Checkout.tsx` | `error.message \|\| "Failed to place order"` in toast | Use `showErrorToastLegacy(toast, error, "placing order")` |
| `src/pages/AdminCreateUser.tsx` | `error instanceof Error ? error.message : "Failed to create user"` | Use `showErrorToastLegacy(toast, error, "creating user")` |

### Hooks (3 files)

| File | Current Pattern | Change |
|------|----------------|--------|
| `src/hooks/useHeatRecords.ts` | `error.message` in toast | Use `showErrorToastLegacy(toast, error, "recording heat event")` |
| `src/hooks/useOptimisticMutation.ts` | `error instanceof Error ? error.message : 'Failed to save'` | Use `showErrorToastLegacy(toast, error)` |
| `src/hooks/useVoiceRecording.ts` | Internal error construction with `error.message` -- these are thrown, not toasted directly, so leave as-is (internal error propagation, not user-facing) |

### Admin Components (5 files)

| File | Instances | Change |
|------|-----------|--------|
| `src/components/admin/FarmOversight.tsx` | 5 onError handlers across mutations | Import `showErrorToastLegacy`, replace all 5 |
| `src/components/admin/UserManagement.tsx` | 3 onError handlers (addRole, removeRole, toggleDisable) | Import `showErrorToastLegacy`, replace all 3 |
| `src/components/admin/DocAgaManagement.tsx` | 1 onError in saveMutation | Import `showErrorToastLegacy`, replace |
| `src/components/admin/RecalculateStatsButton.tsx` | 1 manual 403 check + catch -- already has custom "Authentication Error" handling; leave the 403 check, only update the generic catch | Import `showErrorToastLegacy`, replace generic catch only |
| `src/components/admin/SystemOverview.tsx` | 1 inline `{error.message}` in JSX | Use `translateError(error).description` for the inline text |
| `src/components/admin/AdminAnimalDialog.tsx` | 2 catch blocks with `error.message` | Import `showErrorToastLegacy`, replace both |

### Animal Components (3 files)

| File | Instances | Change |
|------|-----------|--------|
| `src/components/animal-details/AnimalProfile.tsx` | 1 upload error toast | Import `showErrorToastLegacy`, replace |
| `src/components/animal-details/EditAcquisitionWeightDialog.tsx` | 1 catch with `error instanceof Error ? error.message` | Import `showErrorToastLegacy`, replace |
| `src/components/animal-exit/RecordAnimalExitDialog.tsx` | 1 catch with `error.message` | Import `showErrorToastLegacy`, replace |

### Farm Components (2 files)

| File | Instances | Change |
|------|-----------|--------|
| `src/components/FarmLogoUpload.tsx` | 3 instances (upload, remove, CameraPhotoInput onError) | Import `showErrorToastLegacy`, replace all 3 |
| `src/components/ScheduleAIDialog.tsx` | 1 catch with `error.message` | Import `showErrorToastLegacy`, replace |

### Chat/AI Components (2 files)

| File | Instances | Change |
|------|-----------|--------|
| `src/components/DocAga.tsx` | 3 instances (upload error, send message error, CameraPhotoInput onError) | Import `showErrorToastLegacy`, replace all 3 |
| `src/components/farmhand/DocAgaConsultation.tsx` | 1 catch with `error.message` | Import `showErrorToastLegacy`, replace |

### Merchant Components (1 file)

| File | Instances | Change |
|------|-----------|--------|
| `src/components/merchant/InvoiceGenerator.tsx` | 1 onError with `error.message` | Import `showErrorToastLegacy`, replace |

### Voice/Recording Components (2 files)

| File | Instances | Change |
|------|-----------|--------|
| `src/components/farmhand/VoiceRecordButton.tsx` | 2 catch blocks with `error.message` | Import `showErrorToastLegacy`, replace both |
| `src/components/animal-form/VoiceQuickAdd.tsx` | 1 `error.message` used for component state (not toast) -- this sets `errorMessage` state for inline display. Use `translateError(error).description` instead |

### Milk Inventory (1 file)

| File | Instances | Change |
|------|-----------|--------|
| `src/components/milk-inventory/FeedMilkToAnimalDialog.tsx` | 1 catch with `error.message` | Import `showErrorToastLegacy`, replace |

### Health Records (1 file)

| File | Instances | Change |
|------|-----------|--------|
| `src/components/health-records/AddHealthRecordDialog.tsx` | 3 instances (photo upload, save error, CameraPhotoInput onError) | Import `showErrorToastLegacy`, replace all 3 |

### Documentation (1 file)

| File | Change |
|------|--------|
| `docs/data-relationships-map.md` | Add Error Handling SSOT entry |

## Files NOT Changed (intentional)

| File | Reason |
|------|--------|
| `src/hooks/useVoiceRecording.ts` | Internal error propagation (throws errors, never toasts directly) |
| `src/hooks/useRealtimeTranscription.ts` | Already updated in Batch 1; remaining `error.message` refs are for microphone permission checks (specific UX, not generic errors) |
| `src/hooks/useIntegrityScan.ts` | Internal error wrapping for re-throw, not user-facing |
| `src/hooks/useRegionalStats.ts` | Console.error only (no toast) |
| `src/hooks/useProfile.test.ts` | Test file -- assertions check old behavior; will update assertions to match new translated messages |
| `src/test-utils/data-integrity-helpers.ts` | Internal test tooling, not user-facing |

## Total: 24 files edited, 1 documentation update
