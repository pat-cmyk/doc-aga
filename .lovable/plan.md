

# Plan: Fix Wrong Package Name for Native Settings

## Problem Identified

The package `@capgo/capacitor-native-settings` does **not exist** on npm. The correct package name is:

**`capacitor-native-settings`** (without the `@capgo/` prefix)

This is why you're getting the 404 error when trying to install.

## Code Fix Required

### File: `src/lib/openAppSettings.ts`

**Change the import from:**
```typescript
const { NativeSettings, AndroidSettings, IOSSettings } = await import(
  '@capgo/capacitor-native-settings'
);
```

**To:**
```typescript
const { NativeSettings, AndroidSettings, IOSSettings } = await import(
  'capacitor-native-settings'
);
```

## Manual Steps After Code Fix

Once I update the code, run these commands in your `doc-aga` folder:

```bash
npm install capacitor-native-settings --legacy-peer-deps
npx cap sync android
```

Then rebuild the APK in Android Studio.

## Technical Note

The package `capacitor-native-settings` is actively maintained (version 8.0.0 published 9 days ago) and supports Capacitor 7.x which matches your project. The API usage in our code is correct - only the import path needs fixing.

