

# Plan: Fix Android Permission Handling with Native Settings Plugin

## Overview

This plan fixes two Android permission issues:
1. **"Open Settings" button fails** - Currently redirects to Chrome help page instead of app settings
2. **Permission check unreliable** - WebView's `navigator.permissions.query` can be out of sync with native Android permissions

## Files to Create

### 1. `src/lib/openAppSettings.ts` (New File)

A utility that uses `@capgo/capacitor-native-settings` to properly open Android app settings using the correct Android Intent (`ACTION_APPLICATION_DETAILS_SETTINGS`).

```typescript
import { Capacitor } from '@capacitor/core';

export async function openAppSettings(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  const { NativeSettings, AndroidSettings, IOSSettings } = await import(
    '@capgo/capacitor-native-settings'
  );
  
  await NativeSettings.open({
    optionAndroid: AndroidSettings.ApplicationDetails,
    optionIOS: IOSSettings.App,
  });
  
  return true;
}
```

## Files to Modify

### 2. `src/components/MicrophonePermissionDialog.tsx`

**Changes:**
- Remove `AppLauncher` import
- Remove `getAndroidSettingsUrl`, `getIOSSettingsUrl` imports
- Add `openAppSettings` import from new utility
- Add `toast` import from sonner
- Replace `handleOpenSettings` to use `openAppSettings()` with toast fallback

### 3. `src/components/permissions/CameraPermissionDialog.tsx`

**Same changes as MicrophonePermissionDialog:**
- Use `openAppSettings()` instead of `AppLauncher.openUrl()`
- Add toast error feedback when settings can't be opened

### 4. `src/components/permissions/LocationPermissionDialog.tsx`

**Same changes:**
- Use `openAppSettings()` instead of `AppLauncher.openUrl()`
- Add toast error feedback

### 5. `src/components/permissions/NotificationPermissionDialog.tsx`

**Same changes:**
- Use `openAppSettings()` instead of `AppLauncher.openUrl()`
- Add toast error feedback

### 6. `src/hooks/useVoiceRecording.ts`

**Changes (lines 165-228):**
- Remove the `navigator.permissions.query` check inside the native platform block
- Call `getUserMedia` directly with audio constraints
- This is more reliable because WebView permissions API can be out of sync with native Android permissions

**Before:**
```typescript
if (Capacitor.isNativePlatform()) {
  const permissionStatus = await navigator.permissions.query({ 
    name: 'microphone' as PermissionName 
  });
  if (permissionStatus.state === 'denied') {
    throw new Error('Microphone permission denied');
  }
}
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
```

**After:**
```typescript
const stream = await navigator.mediaDevices.getUserMedia({ 
  audio: {
    echoCancellation,
    noiseSuppression,
  } 
});
```

## Manual Steps Required After Implementation

After I make these code changes, you'll need to:

1. **Pull the changes locally:**
   ```bash
   git pull
   ```

2. **Install the native settings plugin:**
   ```bash
   npm install @capgo/capacitor-native-settings
   npx cap sync android
   ```

3. **Rebuild the APK in Android Studio:**
   - Open Android Studio
   - Build → Clean Project
   - Build → Build Bundle(s) / APK(s) → Build APK(s)

4. **Test on your Samsung Galaxy A17 5G:**
   - Install the new APK
   - Try the microphone/camera features
   - "Open Settings" should now open **Settings > Apps > Doc Aga**

## Expected Results

| Issue | Before | After |
|-------|--------|-------|
| Open Settings button | Opens Chrome help page | Opens Android app settings |
| Permission detection | Uses unreliable permissions.query API | Uses getUserMedia directly |
| User experience | Must navigate manually to settings | One tap to app settings |

