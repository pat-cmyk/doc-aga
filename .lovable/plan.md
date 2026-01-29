

# Fix Device Permission Issues for Camera and Microphone on Native Android

## Problem Summary

Device asset access (microphone, camera) is not working correctly on native Android. The issues are:

| Issue | Location | Impact |
|-------|----------|--------|
| Incorrect App ID in AppLauncher | `MicrophonePermissionDialog.tsx`, `CameraPermissionDialog.tsx` | "Open Settings" button opens wrong app |
| Missing `@capacitor/camera` plugin | Project dependencies | Cannot use native camera for photo capture |
| Web-only permission requests | `useDevicePermissions.ts`, `useVoiceRecording.ts`, `VoiceTrainingSession.tsx` | Native Android permission dialogs may not trigger |
| No pre-emptive permission checking | Voice/Camera components | Permission errors only caught after failure |

### Root Cause Analysis

1. **Wrong Package Name**: Both permission dialogs use `package:app.lovable.fa0cc69c441c4305b8c2e99c9ca1b5ea` but the actual app ID is `com.goldenforage.docaga` (defined in `capacitor.config.ts`)

2. **No Native Camera Plugin**: The project uses standard HTML file inputs (`accept="image/*"`) which work on web but are unreliable on native Android

3. **Web API Reliance**: Components directly call `navigator.mediaDevices.getUserMedia()` without first checking/requesting native Android permissions through Capacitor

---

## Solution Overview

```text
+------------------------------------------+
|           Phase 1: Quick Fixes           |
+------------------------------------------+
| 1. Update AppLauncher URLs (appId fix)   |
| 2. Add centralized APP_CONFIG constant   |
+------------------------------------------+
              |
              v
+------------------------------------------+
|        Phase 2: Camera Plugin            |
+------------------------------------------+
| 1. Install @capacitor/camera             |
| 2. Create useNativeCamera hook           |
| 3. Update image upload components        |
+------------------------------------------+
              |
              v
+------------------------------------------+
|      Phase 3: Permission Flow            |
+------------------------------------------+
| 1. Enhance useDevicePermissions hook     |
| 2. Add native permission requests        |
| 3. Update VoiceTrainingSession           |
+------------------------------------------+
```

---

## Phase 1: Fix AppLauncher URLs (Quick Fix)

### 1.1 Create Centralized App Config

**New File**: `src/lib/appConfig.ts`

```typescript
// Centralized app configuration for native platform
export const APP_CONFIG = {
  appId: 'com.goldenforage.docaga',
  appName: 'Doc Aga',
} as const;

// Helper to get Android settings URL
export const getAndroidSettingsUrl = () => 
  `package:${APP_CONFIG.appId}`;
```

### 1.2 Update MicrophonePermissionDialog.tsx

**File**: `src/components/MicrophonePermissionDialog.tsx`

| Line | Current | Updated |
|------|---------|---------|
| 39-41 | `url: 'package:app.lovable.fa0cc69c441c4305b8c2e99c9ca1b5ea'` | `url: getAndroidSettingsUrl()` |

**Changes**:
- Import `getAndroidSettingsUrl` from `@/lib/appConfig`
- Replace hardcoded package URL with helper function

### 1.3 Update CameraPermissionDialog.tsx

**File**: `src/components/permissions/CameraPermissionDialog.tsx`

| Line | Current | Updated |
|------|---------|---------|
| 38-40 | `url: 'package:app.lovable.fa0cc69c441c4305b8c2e99c9ca1b5ea'` | `url: getAndroidSettingsUrl()` |

**Changes**:
- Import `getAndroidSettingsUrl` from `@/lib/appConfig`
- Replace hardcoded package URL with helper function

---

## Phase 2: Install and Integrate Capacitor Camera Plugin

### 2.1 Install Plugin

The `@capacitor/camera` plugin must be installed. This enables:
- Native camera capture with proper permission handling
- Photo library access on Android
- Automatic permission prompts

### 2.2 Create Native Camera Hook

**New File**: `src/hooks/useNativeCamera.ts`

```typescript
import { useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';

export interface UseNativeCameraOptions {
  quality?: number;
  allowEditing?: boolean;
  source?: 'camera' | 'photos' | 'prompt';
}

export interface UseNativeCameraReturn {
  takePhoto: () => Promise<Photo | null>;
  pickPhoto: () => Promise<Photo | null>;
  captureOrPick: () => Promise<Photo | null>;
  isCapturing: boolean;
  error: Error | null;
  isNative: boolean;
}

export function useNativeCamera(options: UseNativeCameraOptions = {}): UseNativeCameraReturn {
  const { quality = 90, allowEditing = false, source = 'prompt' } = options;
  
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isNative = Capacitor.isNativePlatform();

  const checkPermissions = async () => {
    if (!isNative) return true;
    
    const status = await Camera.checkPermissions();
    if (status.camera !== 'granted' || status.photos !== 'granted') {
      const request = await Camera.requestPermissions();
      return request.camera === 'granted' && request.photos === 'granted';
    }
    return true;
  };

  const capturePhoto = async (cameraSource: CameraSource): Promise<Photo | null> => {
    setIsCapturing(true);
    setError(null);
    
    try {
      const hasPermission = await checkPermissions();
      if (!hasPermission) {
        throw new Error('Camera permission denied');
      }

      const photo = await Camera.getPhoto({
        quality,
        allowEditing,
        resultType: CameraResultType.Uri,
        source: cameraSource,
        saveToGallery: false,
      });

      return photo;
    } catch (err: any) {
      // User cancelled is not an error
      if (err.message?.includes('cancelled') || err.message?.includes('canceled')) {
        return null;
      }
      setError(err);
      throw err;
    } finally {
      setIsCapturing(false);
    }
  };

  const takePhoto = useCallback(() => 
    capturePhoto(CameraSource.Camera), [quality, allowEditing]);

  const pickPhoto = useCallback(() => 
    capturePhoto(CameraSource.Photos), [quality, allowEditing]);

  const captureOrPick = useCallback(() => 
    capturePhoto(CameraSource.Prompt), [quality, allowEditing]);

  return {
    takePhoto,
    pickPhoto,
    captureOrPick,
    isCapturing,
    error,
    isNative,
  };
}
```

### 2.3 Create Camera Photo Input Component

**New File**: `src/components/ui/camera-photo-input.tsx`

A drop-in replacement for `<input type="file" accept="image/*">` that:
- Uses Capacitor Camera on native platforms
- Falls back to standard file input on web
- Handles permissions gracefully
- Shows the CameraPermissionDialog when denied

---

## Phase 3: Enhance Native Permission Flow

### 3.1 Update useDevicePermissions Hook

**File**: `src/hooks/useDevicePermissions.ts`

**Current Issues**:
- Uses only Web APIs (`navigator.permissions.query`, `navigator.mediaDevices.getUserMedia`)
- These don't always trigger native Android permission dialogs
- No integration with Capacitor plugins

**Enhanced Implementation**:

```typescript
import { Camera } from '@capacitor/camera';

// In checkAllPermissions:
const checkCameraPermission = async (): Promise<PermissionStatus> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await Camera.checkPermissions();
      if (status.camera === 'granted' && status.photos === 'granted') {
        return 'granted';
      }
      if (status.camera === 'denied' || status.photos === 'denied') {
        return 'denied';
      }
      return 'prompt';
    } catch {
      return 'unknown';
    }
  }
  // Fall back to web API
  // ... existing web logic
};

// In requestCameraPermission:
const requestCameraPermission = async (): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await Camera.requestPermissions();
      const granted = result.camera === 'granted' && result.photos === 'granted';
      setPermissions(prev => ({ ...prev, camera: granted ? 'granted' : 'denied' }));
      return granted;
    } catch {
      setPermissions(prev => ({ ...prev, camera: 'denied' }));
      return false;
    }
  }
  // Fall back to web API (getUserMedia)
  // ... existing web logic
};
```

### 3.2 Add Native Microphone Permission Check

For microphone, Android requires explicit permission. Add a pre-check before calling `getUserMedia`:

**File**: `src/hooks/useVoiceRecording.ts` (lines ~172-175)

```typescript
// Before calling getUserMedia, check if on native platform
if (Capacitor.isNativePlatform()) {
  // Check microphone permission status first
  const status = await checkMicrophonePermission();
  if (status === 'denied') {
    throw new Error('Microphone permission denied');
  }
}

const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
```

### 3.3 Update VoiceTrainingSession

**File**: `src/components/voice-training/VoiceTrainingSession.tsx`

The `startRecording` function directly calls `getUserMedia` without checking permissions. Update to:

1. Import `Capacitor` from `@capacitor/core`
2. Check native permissions before recording
3. Show permission dialog proactively if denied

```typescript
const startRecording = async () => {
  try {
    // On native, check permission first
    if (Capacitor.isNativePlatform()) {
      const permissionStatus = await navigator.permissions.query({ 
        name: 'microphone' as PermissionName 
      }).catch(() => ({ state: 'prompt' }));
      
      if (permissionStatus.state === 'denied') {
        setShowPermissionDialog(true);
        return;
      }
    }
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // ... rest of recording logic
  } catch (error) {
    console.error('Error starting recording:', error);
    setShowPermissionDialog(true);
  }
};
```

---

## Files to Modify Summary

| File | Changes |
|------|---------|
| **New**: `src/lib/appConfig.ts` | Centralized app ID configuration |
| **New**: `src/hooks/useNativeCamera.ts` | Native camera capture hook |
| **New**: `src/components/ui/camera-photo-input.tsx` | Cross-platform photo input component |
| `src/components/MicrophonePermissionDialog.tsx` | Fix AppLauncher URL |
| `src/components/permissions/CameraPermissionDialog.tsx` | Fix AppLauncher URL |
| `src/hooks/useDevicePermissions.ts` | Add Capacitor Camera integration |
| `src/hooks/useVoiceRecording.ts` | Add native permission pre-check |
| `src/components/voice-training/VoiceTrainingSession.tsx` | Add permission check before recording |

---

## Native Build Steps (Post-Implementation)

After the code changes are implemented, you'll need to:

1. **Pull the latest code** from your repository
2. **Install the new plugin**:
   ```bash
   npm install @capacitor/camera
   ```
3. **Sync with native project**:
   ```bash
   npx cap sync android
   ```
4. **Rebuild and deploy**:
   ```bash
   npx cap run android
   ```

---

## Testing Checklist

After implementation, test on Samsung Galaxy A17 5G:

| Test | Expected Result |
|------|-----------------|
| Tap microphone in Voice Training | Native Android permission dialog appears |
| Deny mic permission, tap "Open Settings" | Opens Doc Aga app settings (not wrong app) |
| Grant mic permission | Recording starts successfully |
| Tap camera/photo upload | Native Android permission dialog appears |
| Deny camera permission, tap "Open Settings" | Opens Doc Aga app settings |
| Grant camera permission | Camera/gallery opens successfully |
| Check Device Permissions Hub | All statuses reflect actual Android permissions |

