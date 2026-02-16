

# Consolidate Error Messages into a Farmer-Friendly SSOT

## Problem

The app has **51+ files** that pass raw `error.message` directly to toast notifications. This means farmers see cryptic messages like:

- "duplicate key value violates unique constraint \"animals_ear_tag_farm_id_key\""
- "Invalid login credentials"
- "new row violates row-level security policy for table \"milking_records\""
- "JSON object requested, multiple (or no) rows returned"

Meanwhile, `src/lib/errorHandling.ts` already has `sanitizeError()` and `handleDatabaseError()` utilities -- but **zero files import or use them**. They are completely dead code.

## Solution

1. Expand `errorHandling.ts` into a comprehensive error translation engine that pattern-matches raw Supabase/PostgreSQL error strings and returns farmer-friendly bilingual (English + Filipino) messages.
2. Create a single `showErrorToast()` helper that wraps both toast systems (shadcn `useToast` and sonner `toast.error`) so every call site becomes a one-liner.
3. Refactor all 51+ files to use `showErrorToast()` instead of raw `error.message`.

## Error Categories & Translations

| Raw Error Pattern | Farmer-Friendly Message |
|---|---|
| `duplicate key` / `23505` / `unique constraint` | "Duplicate entry. This record already exists. (May dobleng entry. Naka-record na ito.)" |
| `Invalid login credentials` | "Wrong email or password. Please check and try again. (Mali ang email o password. Subukan ulit.)" |
| `User already registered` | "This email is already registered. Please log in instead. (Naka-rehistro na ang email na ito. Mag-log in na lang.)" |
| `password has been exposed` / `breached` / `leaked` | "This password was found in a data breach. Please choose a different, stronger password." |
| `Email not confirmed` | "Please check your email and click the confirmation link first. (I-check ang email at i-click ang confirmation link.)" |
| `row-level security` / `policy` / `permission denied` / `403` | "You don't have permission to do this. Contact your farm owner. (Wala kang permiso dito. Kontakin ang may-ari ng farm.)" |
| `foreign key violation` / `23503` | "Cannot delete -- this record is linked to other data. Remove linked records first. (Hindi mabura -- may konektadong data. Alisin muna ang mga naka-link.)" |
| `not_found` / `PGRST116` (single row) | "Record not found. It may have been deleted. (Hindi mahanap ang record. Baka na-delete na.)" |
| `failed to fetch` / `network` / `timeout` / `offline` | "No internet connection. Check your signal and try again. (Walang internet. Suriin ang signal at subukan ulit.)" |
| `rate limit` / `429` | "Too many attempts. Please wait a moment and try again. (Masyadong maraming pagsubok. Maghintay at subukan ulit.)" |
| `storage` / `file too large` / `bucket` | "File upload failed. Make sure the file is under 5MB. (Hindi na-upload. Siguraduhin na wala pang 5MB ang file.)" |
| `too many requests` | Same as rate limit above |
| Default fallback | "Something went wrong. Please try again. (May problema. Subukan ulit.)" |

## Architecture

```text
errorHandling.ts (SSOT -- expanded)
  ├── ERROR_MESSAGES (expanded bilingual map)
  ├── translateError(error) --> farmer-friendly string
  ├── showErrorToast(error, context?) --> calls sonner toast.error()
  └── showErrorToastLegacy(toast, error, title?) --> calls shadcn useToast
        |
        v
All 51+ consumer files
  BEFORE: toast({ title: "Error", description: error.message, variant: "destructive" })
  AFTER:  showErrorToast(error, "loading animals")
```

### Why Two Toast Helpers?

The codebase uses **two different toast systems**:
- **shadcn `useToast`** (hook-based, used in ~40 files) -- requires `toast` function from the hook
- **sonner `toast.error`** (import-based, used in ~28 files) -- can be called anywhere

The plan provides helpers for both, with the sonner version as the preferred default going forward.

## Technical Details

### 1. EDIT: `src/lib/errorHandling.ts`

Expand the file with:
- **Bilingual `ERROR_MESSAGES`** covering all categories above (Filipino + English)
- **`translateError(error: unknown, context?: string): { title: string; description: string }`** -- the core pattern-matching engine. The optional `context` param lets call sites add specificity (e.g., "saving milk record") which gets prepended to the message.
- **`showErrorToast(error: unknown, context?: string)`** -- calls sonner `toast.error()` with the translated message. One-liner for any file.
- **`showErrorToastLegacy(toastFn, error, title?)`** -- for files still using shadcn `useToast`. Accepts the toast function and calls it with the translated message + `variant: "destructive"`.
- Keep existing `isNetworkError()`, `getRetryableError()` (used by `useNetworkError` hook)
- Remove `sanitizeError()` and `handleDatabaseError()` (unused, replaced by `translateError`)

### 2. EDIT: Auth Pages (4 files)

**`src/pages/Auth.tsx`** -- Replace raw `error.message` in:
- `handleSignIn` catch: translate "Invalid login credentials" to "Wrong email or password"
- `handleSignUp` error: already handles leaked password, add duplicate email handling
- `handleForgotPassword` error: translate to friendly message
- `handleGoogleSignIn` error: translate to friendly message

**`src/pages/GovernmentAuth.tsx`** -- Same pattern for government login errors

**`src/pages/MerchantAuth.tsx`** -- Same pattern, plus the "already registered" flow

**`src/pages/AdminAuth.tsx`** -- Same pattern for admin login

### 3. EDIT: Data Hooks (~15 files)

Files that catch Supabase query errors and show raw `error.message`:
- `src/hooks/useProfile.ts`
- `src/hooks/useMerchant.ts`
- `src/hooks/useBodyConditionScores.ts`
- `src/hooks/useDailyChecklist.ts`
- `src/hooks/useSupportTickets.ts`
- `src/hooks/useExpenses.ts`
- `src/hooks/usePendingActivities.ts`
- `src/hooks/useGovernmentFeedback.ts`
- `src/hooks/useFarmerFeedback.ts`
- `src/hooks/useRealtimeTranscription.ts`
- `src/components/animal-list/hooks/useAnimalList.ts`

Each gets: `import { showErrorToast } from "@/lib/errorHandling"` and replaces `toast({ title: "Error", description: error.message, variant: "destructive" })` with `showErrorToast(error, "context")`.

### 4. EDIT: Component Error Handlers (~25 files)

Files with inline error toasts:
- `src/components/AnimalDetails.tsx`
- `src/components/AnimalList.tsx`
- `src/components/HealthRecords.tsx`
- `src/components/FarmSetup.tsx`
- `src/components/UserEmailDropdown.tsx`
- `src/components/breeding/BreedingEventActions.tsx`
- `src/components/animal-exit/RecordAnimalExitDialog.tsx`
- `src/components/health-records/AddHealthRecordDialog.tsx`
- `src/components/milk-inventory/EditMilkRecordDialog.tsx`
- `src/components/milk-inventory/DeleteMilkRecordDialog.tsx`
- `src/components/body-condition/RecordBulkBCSDialog.tsx`
- `src/components/farmhand/ActivityConfirmation.tsx`
- `src/components/farmhand/VoiceRecordButton.tsx`
- `src/components/farmhand/DocAgaConsultation.tsx`
- `src/components/government/RicoChat.tsx`
- `src/components/merchant/OrderStatusUpdate.tsx`
- `src/components/admin/FarmOversight.tsx`
- `src/components/admin/EditUserDialog.tsx`
- `src/components/admin/UserDetailPanel.tsx`
- `src/components/admin/FaqCandidatesTab.tsx`
- `src/components/admin/RecalculateHistoricalStatsButton.tsx`
- `src/components/admin/RoleDebugger.tsx`
- `src/components/approval/ApprovalSettings.tsx`
- `src/components/sync/SyncStatusSheet.tsx`
- `src/components/animal-form/VoiceQuickAdd.tsx`

### 5. EDIT: `docs/data-relationships-map.md`

- Add Error Handling SSOT entry documenting `translateError` as the single source for all user-facing error messages

## What This Does NOT Change

- No database changes
- No RLS changes
- No hook logic changes (only the error display path)
- Console.error logging stays (translateError still logs the raw error for debugging)
- The `NetworkError` component and `useNetworkError` hook stay as-is (they handle retry UI, not toast messages)

## Migration Strategy

Since this touches 51+ files, implementation will be done in batches:
1. First: expand `errorHandling.ts` with the new translation engine + helpers
2. Then: auth pages (highest user impact)
3. Then: data hooks (most frequent errors)
4. Then: remaining components
5. Last: documentation update

