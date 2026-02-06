
# Fix Plan: Allow Camera or Gallery Selection on Mobile Web

## Problem

When farmers tap "Upload Logo" or "Change Logo" on Samsung Internet browser (or other mobile web browsers), it directly opens the camera. There's no option to select photos from the gallery/photo library.

## Root Cause

The hidden file input in `CameraPhotoInput` component has the `capture="environment"` attribute:

```html
<input
  type="file"
  accept="image/*"
  capture="environment"  ← This forces camera-only on mobile browsers
/>
```

This HTML attribute tells mobile browsers to bypass the file picker and go directly to the camera.

## Solution

Remove the `capture` attribute from the file input. Without this attribute, mobile browsers will show their native file picker dialog that gives users the choice to either:
- Take a new photo with the camera
- Choose an existing photo from the gallery

## File to Modify

| File | Change |
|------|--------|
| `src/components/ui/camera-photo-input.tsx` | Remove `capture="environment"` from the input element |

## Code Change

**Before (Line 140-147):**
```tsx
<input
  ref={fileInputRef}
  type="file"
  accept={accept}
  capture="environment"
  className="hidden"
  onChange={handleFileChange}
/>
```

**After:**
```tsx
<input
  ref={fileInputRef}
  type="file"
  accept={accept}
  className="hidden"
  onChange={handleFileChange}
/>
```

## Impact

This fix applies to **all 9 places** where `CameraPhotoInput` is used:

1. Farm Logo Upload (`FarmLogoUpload.tsx`)
2. Animal Avatar Upload (`AnimalDetails.tsx` - 2 places)
3. Animal Profile Photo (`AnimalProfile.tsx`)
4. Doc Aga Image Input (`DocAga.tsx`)
5. Merchant Product Images (`ProductFormDialog.tsx`)
6. Health Record Attachments (`AddHealthRecordDialog.tsx`)
7. Single Health Recording Photos (`RecordSingleHealthDialog.tsx`)
8. Merchant Profile Logo (`MerchantProfile.tsx`)

## Technical Notes

- **Native Apps (Capacitor)**: This change does not affect native Android/iOS apps. The native camera flow uses Capacitor's Camera plugin with `CameraSource.Prompt` which already shows camera/gallery options.
- **Web Browsers**: Removing `capture` allows the browser's native file picker to offer both camera and gallery options.
- **Behavior on Different Browsers**:
  - Samsung Internet: Will show "Camera" + "Gallery" options
  - Chrome Mobile: Will show "Camera" + "Files" + "Gallery" options
  - Safari iOS: Will show "Take Photo" + "Photo Library" + "Browse" options

## Testing Points

After implementation, verify on a mobile device with Samsung Internet browser:
1. Navigate to Farm Settings → Farm Logo section
2. Tap "Upload Logo" or "Change Logo"
3. Confirm a picker appears with options for both Camera and Gallery
4. Test selecting from Gallery works correctly
5. Test taking a new photo still works correctly
