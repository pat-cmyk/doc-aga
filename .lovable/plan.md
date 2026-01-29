
# Plan: Convert Capacitor Plugin Static Imports to Dynamic Imports

## Problem
The Vite/Rollup bundler is failing because static imports of Capacitor plugins (`@capacitor/camera`, `@capacitor/local-notifications`) are evaluated at build time. Since these plugins only work on native devices (iOS/Android), there's no JavaScript bundle to resolve for web builds.

## Solution
Convert all static Capacitor plugin imports to dynamic imports wrapped in `Capacitor.isNativePlatform()` checks. This tells Vite to exclude these modules from the web bundle.

## Files to Modify

### 1. `src/lib/devicePermissionService.ts`
**Current (line 1-3):**
```typescript
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { LocalNotifications } from '@capacitor/local-notifications';
```

**After:**
```typescript
import { Capacitor } from '@capacitor/core';
// Camera and LocalNotifications imported dynamically below
```

**Update functions to use dynamic imports:**
```typescript
export async function checkAllPermissions(): Promise<PermissionResults> {
  // ...
  if (!Capacitor.isNativePlatform()) {
    return results;
  }

  // Camera - dynamic import
  try {
    const { Camera } = await import('@capacitor/camera');
    const cameraStatus = await Camera.checkPermissions();
    // ... rest of camera logic
  } catch (error) { ... }

  // Notifications - dynamic import  
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const notifStatus = await LocalNotifications.checkPermissions();
    // ... rest of notification logic
  } catch (error) { ... }
}
```

### 2. `src/hooks/useNativeCamera.ts`
**Current (line 3):**
```typescript
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
```

**After:**
- Remove static import
- Add type-only imports for TypeScript types
- Dynamically import Camera inside the hook functions when `isNative` is true

```typescript
import { Capacitor } from '@capacitor/core';
import type { Photo } from '@capacitor/camera';

// Dynamic import helper for native camera
async function getNativeCamera() {
  const module = await import('@capacitor/camera');
  return {
    Camera: module.Camera,
    CameraResultType: module.CameraResultType,
    CameraSource: module.CameraSource,
  };
}
```

### 3. `src/lib/notificationService.ts`
**Current (line 1):**
```typescript
import { LocalNotifications } from '@capacitor/local-notifications';
```

**After:**
```typescript
import { Capacitor } from '@capacitor/core';

// Dynamic import helper
async function getLocalNotifications() {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  return LocalNotifications;
}
```

### 4. `src/App.tsx`
**Current (line 20):**
```typescript
import { LocalNotifications } from '@capacitor/local-notifications';
```

**After:**
Remove the static import and use dynamic import where LocalNotifications is used (inside `Capacitor.isNativePlatform()` blocks).

## Technical Approach

The pattern to use everywhere:

```typescript
// BEFORE (causes build failure)
import { Camera } from '@capacitor/camera';

if (Capacitor.isNativePlatform()) {
  Camera.getPhoto({ ... });
}

// AFTER (works correctly)
if (Capacitor.isNativePlatform()) {
  const { Camera } = await import('@capacitor/camera');
  Camera.getPhoto({ ... });
}
```

## Type Safety

For TypeScript types (like `Photo`, `CameraSource`), use type-only imports which are stripped at compile time:
```typescript
import type { Photo } from '@capacitor/camera';
```

This preserves type checking without causing bundler issues.

## Rollup Vite-Ignore Directive

In some cases, adding `/* @vite-ignore */` can prevent static analysis warnings:
```typescript
const { Camera } = await import(/* @vite-ignore */ '@capacitor/camera');
```

This is already used in your `openAppSettings.ts` for `capacitor-native-settings`.

## Summary of Changes

| File | Action |
|------|--------|
| `src/lib/devicePermissionService.ts` | Dynamic import Camera + LocalNotifications |
| `src/hooks/useNativeCamera.ts` | Dynamic import Camera, keep type imports |
| `src/lib/notificationService.ts` | Dynamic import LocalNotifications |
| `src/App.tsx` | Remove static import, use dynamic inside native check |

## Testing Checklist
- Web preview builds without errors
- Camera works on native Android/iOS
- Notifications work on native Android/iOS
- Web fallbacks still function (file input for photos, console.log for notifications)
