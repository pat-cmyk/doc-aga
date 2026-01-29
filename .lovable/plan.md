
# Permission Architecture Assessment and SSOT Implementation Plan

## Executive Summary

After a thorough analysis, I've identified **the key architectural difference** between why **Notifications work** (permission granted) while **Camera and Microphone do not appear** in Android settings.

## Root Cause Analysis

### What Notifications Do Right (The Working Pattern)

```text
NOTIFICATIONS SSOT PATTERN (WORKS):
┌─────────────────────────────────────────────────────────────────────┐
│ 1. PLUGIN CONFIGURATION                                            │
│    capacitor.config.ts → plugins: { LocalNotifications: {...} }    │
│                                                                     │
│ 2. EARLY INITIALIZATION (App.tsx line 108)                         │
│    App mounts → initNotifications() called immediately             │
│                                                                     │
│ 3. PERMISSION REQUEST (notificationService.ts line 15)             │
│    LocalNotifications.requestPermissions() → Native dialog         │
│                                                                     │
│ 4. RESULT: Permission appears in Android Settings                  │
└─────────────────────────────────────────────────────────────────────┘
```

### What Camera and Microphone Are Missing

```text
CAMERA/MICROPHONE CURRENT PATTERN (BROKEN):
┌─────────────────────────────────────────────────────────────────────┐
│ 1. PLUGIN INSTALLED (@capacitor/camera)                            │
│    ✅ Installed in package.json                                    │
│                                                                     │
│ 2. PLUGIN CONFIGURATION                                            │
│    ❌ NOT in capacitor.config.ts plugins section                   │
│                                                                     │
│ 3. NO EARLY INITIALIZATION                                         │
│    ❌ No initCamera() or initMicrophone() on app mount             │
│                                                                     │
│ 4. PERMISSION REQUEST (only when user clicks button)               │
│    ⚠️ Camera.requestPermissions() only called on user action       │
│    ⚠️ Microphone uses Web API (getUserMedia) not Capacitor plugin  │
│                                                                     │
│ 5. RESULT: Permissions don't appear in Android Settings            │
│    (because they were never properly requested through native API) │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Finding: The Missing Pieces

### Issue 1: No Camera Plugin Configuration in capacitor.config.ts

The current `capacitor.config.ts` only has `LocalNotifications` configured:

```typescript
// Current capacitor.config.ts (line 24-27)
plugins: {
  LocalNotifications: { ... },  // ✅ Configured
  // Camera: ???                // ❌ Missing!
}
```

### Issue 2: No Early Permission Initialization for Camera/Microphone

Notifications work because `initNotifications()` is called in `App.tsx` on mount:

```typescript
// src/App.tsx line 106-108 (works for notifications)
useEffect(() => {
  initNotifications();  // Called immediately on app start
  // ...
}, [navigate]);
```

**Camera and Microphone have NO equivalent initialization** - they only request permissions when the user actually tries to use the feature.

### Issue 3: No Capacitor Plugin for Microphone

There is no `@capacitor/microphone` plugin - microphone access uses the Web Audio API (`getUserMedia`). This means:
- Microphone permissions are handled through the WebView, not native Android
- The permission may not be correctly registered with the Android permission system

## Solution: SSOT Permission Architecture

Following the proven notification pattern, we need to create a centralized permission initialization system.

### Architecture Overview

```text
NEW SSOT PERMISSION ARCHITECTURE:
┌─────────────────────────────────────────────────────────────────────┐
│                        App.tsx (Entry Point)                        │
│                               │                                     │
│                               ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │           initDevicePermissions()                             │  │
│  │  (Single Source of Truth for all native permissions)          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                               │                                     │
│         ┌─────────────────────┼─────────────────────┐              │
│         ▼                     ▼                     ▼              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│  │ Notifications │     │    Camera    │     │  Microphone  │       │
│  │ (existing)    │     │   (new)      │     │   (new)      │       │
│  └──────────────┘     └──────────────┘     └──────────────┘       │
│         │                     │                     │              │
│         ▼                     ▼                     ▼              │
│  LocalNotifications   Camera.request    Early getUserMedia         │
│  .requestPermissions  Permissions()     check + fallback           │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Add Camera Plugin Configuration

**File:** `capacitor.config.ts`

Add the Camera plugin configuration to match the LocalNotifications pattern:

```typescript
plugins: {
  CapacitorHttp: { enabled: true },
  SplashScreen: { ... },
  LocalNotifications: { ... },
  // NEW: Add Camera plugin configuration
  Camera: {
    // Use Android's default photo picker for better UX
    photoPickerPresentation: 'sheet',
    // Permissions prompts
    permissionType: 'prompt',
  },
},
```

### Phase 2: Create Centralized Permission Service

**File:** `src/lib/devicePermissionService.ts` (NEW)

Create a single service that mirrors the notification service pattern:

```typescript
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { LocalNotifications } from '@capacitor/local-notifications';

let isInitialized = false;

export interface PermissionResults {
  camera: 'granted' | 'denied' | 'prompt';
  microphone: 'granted' | 'denied' | 'prompt';
  notifications: 'granted' | 'denied' | 'prompt';
}

export async function initDevicePermissions(): Promise<PermissionResults> {
  if (!Capacitor.isNativePlatform()) {
    return { camera: 'prompt', microphone: 'prompt', notifications: 'prompt' };
  }

  if (isInitialized) {
    return checkAllPermissions();
  }

  const results: PermissionResults = {
    camera: 'prompt',
    microphone: 'prompt', 
    notifications: 'prompt',
  };

  // Camera: Use Capacitor Camera plugin
  try {
    const cameraStatus = await Camera.requestPermissions({ 
      permissions: ['camera', 'photos'] 
    });
    results.camera = cameraStatus.camera === 'granted' ? 'granted' : 'denied';
  } catch (error) {
    console.error('Camera permission request failed:', error);
  }

  // Microphone: Use Web API but trigger early to register with Android
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    results.microphone = 'granted';
  } catch (error) {
    results.microphone = 'denied';
  }

  // Notifications: Already working, maintain existing behavior
  try {
    const notifResult = await LocalNotifications.requestPermissions();
    results.notifications = notifResult.display as 'granted' | 'denied' | 'prompt';
  } catch (error) {
    console.error('Notification permission request failed:', error);
  }

  isInitialized = true;
  return results;
}
```

### Phase 3: Update App.tsx to Initialize All Permissions

**File:** `src/App.tsx`

Replace the single `initNotifications()` call with the new centralized service:

```typescript
// Change from:
import { initNotifications } from "./lib/notificationService";

// To:
import { initDevicePermissions } from "./lib/devicePermissionService";

// In SyncHandler useEffect:
useEffect(() => {
  // Initialize ALL device permissions on mount (SSOT)
  initDevicePermissions().then((results) => {
    console.log('[SyncHandler] Permission results:', results);
  });
  // ... rest of notification click handler
}, [navigate]);
```

### Phase 4: Update capacitor.config.ts with Camera Plugin

**File:** `capacitor.config.ts`

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.goldenforage.docaga',
  appName: 'Doc Aga',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#166534",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#166534",
    },
    // NEW: Camera plugin configuration
    Camera: {
      // Present photo picker as a sheet (Android 13+)
      presentationStyle: 'popover',
    },
  },
};

export default config;
```

## Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `src/lib/devicePermissionService.ts` | CREATE | Centralized SSOT permission initialization |
| 2 | `capacitor.config.ts` | MODIFY | Add Camera plugin configuration |
| 3 | `src/App.tsx` | MODIFY | Call initDevicePermissions() on mount |

## Post-Implementation: Native Project Steps

After code changes are deployed, in your local environment:

```bash
# 1. Pull latest code
git pull origin main

# 2. Rebuild the project
npm run build

# 3. Sync native project (this applies plugin changes)
npx cap sync android

# 4. Run on device
npx cap run android
```

## Expected Results After Implementation

| Permission | Before | After |
|------------|--------|-------|
| Notifications | ✅ Granted | ✅ Granted |
| Camera | ❌ Not in Settings | ✅ Appears in Settings, native dialog shown |
| Microphone | ❌ Not in Settings | ✅ Appears in Settings, native dialog shown |

## Why This Works

1. **Early Initialization**: Requesting permissions on app mount ensures Android registers them
2. **Capacitor Camera Plugin**: Uses native Android permission APIs, not WebView
3. **Microphone Trigger**: Early `getUserMedia` call forces Android to register the permission
4. **SSOT Pattern**: Single centralized service mirrors the working notification pattern
5. **Plugin Configuration**: Adding Camera to capacitor.config.ts ensures proper native integration

## Technical Notes

### Why Microphone Needs Special Handling

Unlike camera (which has a dedicated Capacitor plugin), microphone access in Android WebView:
- Uses Web Audio API (`getUserMedia`)
- Requires an early call to trigger Android's permission registration
- Will show native dialog on first `getUserMedia` call

### AndroidManifest.xml Requirements

The permissions you added manually are correct. The key missing piece was the **early initialization call** that triggers Android to show the permission dialog and register the permission with the system.
