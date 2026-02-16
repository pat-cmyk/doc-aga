

# Fix Avatar Upload Error + Photo Source Selection

## Problem

1. **Upload Error (22P02)**: The upload path in `AnimalDetails.tsx` (line 485) is `avatars/${fileName}` -- missing the farm UUID prefix. The RLS policy requires the first folder segment to be a valid farm UUID: `(storage.foldername(name))[1]::uuid`. This is the PRIMARY bug still causing the error.

2. **Same issue in health dialog**: `RecordSingleHealthDialog.tsx` (line 174) uses `health/${fileName}` instead of `${farmId}/health/${fileName}`.

3. **Photo source selection**: On mobile/tablet, tapping the upload button should offer both Camera and Photo Library options. On desktop/laptop, it should open a standard file picker. The `CameraPhotoInput` component already handles native platforms correctly (uses `CameraSource.Prompt` which shows camera + gallery), but on mobile web browsers the file input should include the `capture` attribute option to also trigger camera access.

## Changes

### 1. `src/components/AnimalDetails.tsx` (line 485)
- Change `const filePath = \`avatars/\${fileName}\`` to `const filePath = \`\${farmId}/avatars/\${fileName}\``
- `farmId` is already available as a component prop (line 232)

### 2. `src/components/health-recording/RecordSingleHealthDialog.tsx` (line 174)
- Change `const filePath = \`health/\${fileName}\`` to `const filePath = \`\${farmId}/health/\${fileName}\``
- `farmId` is already available as a component prop (line 40)

### 3. `src/components/ui/camera-photo-input.tsx` (web file input)
- For web (non-native), remove the single hidden file input and replace with two options shown via a small dropdown/popover:
  - "Take Photo" (sets `capture="environment"` on the file input for mobile browsers to open camera directly)
  - "Choose from Library" (standard file input with `accept="image/*"` for gallery/folder access)
- On desktop browsers, the `capture` attribute is ignored, so both options effectively open the file picker -- simplify to just show one "Choose Photo" button on desktop
- Use `Capacitor.isNativePlatform()` (already imported) to determine behavior:
  - **Native (Android/iOS)**: Current behavior unchanged -- `CameraSource.Prompt` already shows camera + gallery picker natively
  - **Mobile web**: Show the file input without `capture` attribute, which on most mobile browsers shows the "Camera or Photo Library" chooser by default with `accept="image/*"`
  - **Desktop web**: Standard file picker (current behavior, unchanged)

### 4. `src/components/health-records/AddHealthRecordDialog.tsx` (line 125)
- This component appears to be dead code (not imported anywhere). Add `farmId` prop and fix path as a preventive measure: `const filePath = \`\${farmId}/health/\${fileName}\``

## No Database Changes Needed

The four RLS policies (select, insert, update, delete) on `animal-photos` bucket are correctly configured. The fix is purely client-side path construction.

## Verification Plan

1. Navigate to an animal detail page at mobile viewport (390x844)
2. Tap the avatar upload button
3. Confirm photo source options appear (camera + library on mobile, file picker on desktop)
4. Select a photo and confirm upload succeeds (no 22P02 error)
5. Confirm the avatar image renders correctly with the new storage path
6. Test health record photo upload similarly
