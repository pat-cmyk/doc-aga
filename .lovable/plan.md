
# Complete Device Permission Integration: Camera + Microphone

## Summary

This plan extends the previous camera-focused plan to include a comprehensive review and update of all voice/microphone components. The goal is to ensure **both camera AND microphone** permissions correctly trigger native Android dialogs and appear in the Android app settings.

## Current Status

### Camera Components (Not Yet Integrated)
These still use HTML `<input type="file">` and need to be replaced with `CameraPhotoInput`:

| Component | Purpose | Status |
|-----------|---------|--------|
| `AnimalDetails.tsx` | Avatar upload | ❌ Uses file input |
| `AnimalProfile.tsx` | Avatar upload | ❌ Uses file input |
| `FarmLogoUpload.tsx` | Farm logo | ❌ Uses file input |
| `AddHealthRecordDialog.tsx` | Photo attachments | ❌ Uses file input |
| `RecordSingleHealthDialog.tsx` | Photo attachments | ❌ Uses file input |
| `DocAga.tsx` | Image attachment | ❌ Uses file input |
| `MerchantProfile.tsx` | Business logo | ❌ Uses file input |
| `ProductFormDialog.tsx` | Product image | ❌ Uses file input |

### Microphone Components (Already Updated)
These already have native permission checks from the previous implementation:

| Component | Permission Check | Status |
|-----------|------------------|--------|
| `useVoiceRecording.ts` | ✅ Capacitor native check (lines 174-190) | Done |
| `VoiceTrainingSession.tsx` | ✅ Native permission pre-check | Done |
| `useDevicePermissions.ts` | ✅ Uses `Camera.checkPermissions()` for camera | Done |
| `MicrophonePermissionDialog.tsx` | ✅ Uses correct App ID | Done |

### Microphone Components (Need Updates)
These still call `getUserMedia` directly without native checks:

| Component | Current Behavior | Needed Update |
|-----------|------------------|---------------|
| `VoiceInputButton.tsx` | Calls `getUserMedia` directly (line 30) | Add Capacitor check |
| `farmhand/VoiceRecordButton.tsx` | Calls `getUserMedia` directly (line 130) | Add Capacitor check |

---

## Architecture Overview

```text
+------------------------------------------------------------------+
|                    PERMISSION FLOW DIAGRAM                       |
+------------------------------------------------------------------+

CAMERA PERMISSION:                    MICROPHONE PERMISSION:
┌────────────────────┐                ┌────────────────────────┐
│  CameraPhotoInput  │                │  VoiceInputButton /    │
│  Component         │                │  VoiceRecordButton     │
└────────┬───────────┘                └───────────┬────────────┘
         │                                        │
         v                                        v
┌────────────────────┐                ┌────────────────────────┐
│ useNativeCamera()  │                │ Native permission      │
│ hook               │                │ pre-check              │
└────────┬───────────┘                └───────────┬────────────┘
         │                                        │
         v                                        v
┌────────────────────┐                ┌────────────────────────┐
│ Capacitor.is       │                │ Capacitor.is           │
│ NativePlatform()?  │                │ NativePlatform()?      │
├────────┬───────────┤                ├───────────┬────────────┤
│  YES   │    NO     │                │   YES     │    NO      │
│   │    │     │     │                │    │      │     │      │
│   v    │     v     │                │    v      │     v      │
│Camera. │ <input    │                │ Query     │ getUserMedia
│getPhoto│ type=file>│                │ permission│ directly   │
│  ()    │           │                │ first     │            │
└────────┴───────────┘                └───────────┴────────────┘
         │                                        │
         v                                        v
    ┌────────────┐                        ┌────────────┐
    │ Native     │                        │ Native     │
    │ Permission │                        │ Permission │
    │ Dialog     │                        │ Dialog     │
    └────────────┘                        └────────────┘
```

---

## Implementation Plan

### Phase 1: Camera Components (8 files)

Replace HTML file inputs with `CameraPhotoInput` in these components:

#### 1.1 AnimalDetails.tsx
- Remove `fileInputRef` and hidden input
- Replace camera button with `CameraPhotoInput`
- Update `handleAvatarUpload` to accept `File` directly

#### 1.2 AnimalProfile.tsx
- Same pattern as AnimalDetails.tsx

#### 1.3 FarmLogoUpload.tsx
- Replace `<Input id="logo-upload" type="file">` with `CameraPhotoInput`
- Update handler to accept `File`

#### 1.4 AddHealthRecordDialog.tsx
- Replace hidden file input with `CameraPhotoInput`
- Photos are added one at a time (native camera only captures single photos)

#### 1.5 RecordSingleHealthDialog.tsx
- Same pattern as AddHealthRecordDialog

#### 1.6 DocAga.tsx
- Replace image attachment input with `CameraPhotoInput`

#### 1.7 MerchantProfile.tsx
- Replace logo upload input with `CameraPhotoInput`

#### 1.8 ProductFormDialog.tsx
- Replace product image input with `CameraPhotoInput`

### Phase 2: Microphone Components (2 files)

Add native permission pre-checks to remaining voice components:

#### 2.1 VoiceInputButton.tsx (src/components/ui/voice-input-button.tsx)

**Current code (line 28-30):**
```typescript
const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
```

**Updated code:**
```typescript
import { Capacitor } from '@capacitor/core';

const startRecording = async () => {
  try {
    // On native Android, check permission status first
    if (Capacitor.isNativePlatform()) {
      try {
        const permissionStatus = await navigator.permissions.query({ 
          name: 'microphone' as PermissionName 
        });
        
        if (permissionStatus.state === 'denied') {
          setShowPermissionDialog(true);
          return;
        }
      } catch (permError: any) {
        // If permissions API doesn't support microphone query, continue
        if (permError.message === 'Microphone permission denied') {
          setShowPermissionDialog(true);
          return;
        }
      }
    }
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
```

#### 2.2 farmhand/VoiceRecordButton.tsx

**Current code (line 126-130):**
```typescript
const startRecording = async () => {
  try {
    await hapticImpact('medium');
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
```

**Updated code:**
```typescript
import { Capacitor } from '@capacitor/core';

const startRecording = async () => {
  try {
    await hapticImpact('medium');
    
    // On native Android, check permission status first
    if (Capacitor.isNativePlatform()) {
      try {
        const permissionStatus = await navigator.permissions.query({ 
          name: 'microphone' as PermissionName 
        });
        
        if (permissionStatus.state === 'denied') {
          setShowPermissionDialog(true);
          return;
        }
      } catch (permError: any) {
        // If permissions API doesn't support microphone query, continue
        if (permError.message === 'Microphone permission denied') {
          setShowPermissionDialog(true);
          return;
        }
      }
    }
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
```

---

## Files to Modify Summary

| # | File | Type | Change |
|---|------|------|--------|
| 1 | `src/components/AnimalDetails.tsx` | Camera | Replace file input with CameraPhotoInput |
| 2 | `src/components/animal-details/AnimalProfile.tsx` | Camera | Replace file input with CameraPhotoInput |
| 3 | `src/components/FarmLogoUpload.tsx` | Camera | Replace file input with CameraPhotoInput |
| 4 | `src/components/health-records/AddHealthRecordDialog.tsx` | Camera | Replace file input with CameraPhotoInput |
| 5 | `src/components/health-recording/RecordSingleHealthDialog.tsx` | Camera | Replace file input with CameraPhotoInput |
| 6 | `src/components/DocAga.tsx` | Camera | Replace file input with CameraPhotoInput |
| 7 | `src/components/merchant/MerchantProfile.tsx` | Camera | Replace file input with CameraPhotoInput |
| 8 | `src/components/merchant/ProductFormDialog.tsx` | Camera | Replace file input with CameraPhotoInput |
| 9 | `src/components/ui/voice-input-button.tsx` | Microphone | Add Capacitor native check before getUserMedia |
| 10 | `src/components/farmhand/VoiceRecordButton.tsx` | Microphone | Add Capacitor native check before getUserMedia |

---

## Post-Implementation Steps

After all code changes are implemented:

1. **Pull latest code** to local development environment
2. **Sync native project:**
   ```bash
   npx cap sync android
   ```
3. **Rebuild the app:**
   ```bash
   npx cap run android
   ```
4. **Verify in Android Settings** → Apps → Doc Aga → Permissions:
   - Camera permission should now appear
   - Microphone permission should now appear

---

## Testing Checklist

| Test | Location | Expected Result |
|------|----------|-----------------|
| Tap camera icon on animal avatar | Animal Details | Native camera permission dialog |
| Tap farm logo upload | Farm Settings | Native camera permission dialog |
| Tap photo button in health record | Add Health Record | Native camera permission dialog |
| Tap Doc Aga image attachment | Doc Aga chat | Native camera permission dialog |
| Tap voice record button | Farmhand dashboard | Native microphone permission dialog |
| Tap VoiceInputButton | Any form with voice input | Native microphone permission dialog |
| Check Android Settings | App Permissions | Both Camera and Microphone listed |
| Deny permission, tap "Open Settings" | Permission dialog | Opens Doc Aga app settings (correct app) |

---

## Technical Notes

### Why Microphone Needs Different Handling
- There is no `@capacitor/microphone` plugin - Android microphone access works through Web Audio API (`getUserMedia`)
- However, on native platforms, we should still check permission status before calling `getUserMedia` to provide better UX
- The permission check uses `navigator.permissions.query({ name: 'microphone' })` on native to pre-detect denied state

### Why Camera Uses Capacitor Plugin
- `@capacitor/camera` provides native camera UI with proper permission handling
- It also handles photo library access
- The plugin automatically manages Android runtime permissions

### Existing Infrastructure
- `CameraPhotoInput` component is already created and tested
- `useNativeCamera` hook handles native/web fallback
- `MicrophonePermissionDialog` and `CameraPermissionDialog` use correct App ID URLs
- `useDevicePermissions` hook properly checks both camera and microphone status

