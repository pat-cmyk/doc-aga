
# Fix: Cloud Build Error for Native Settings Plugin

## Problem
The Lovable cloud environment is failing to build because Vite scans all import statements - including dynamic imports - during the build analysis phase. Even though `capacitor-native-settings` is installed locally on your machine, it's not available in the cloud environment.

## Solution
Add a TypeScript declaration file to tell the build system this module exists (even if it's only available at runtime on native platforms). This is a standard pattern for native-only Capacitor plugins.

## Changes Required

### 1. Create Type Declaration File
**New file: `src/types/capacitor-native-settings.d.ts`**

```typescript
declare module 'capacitor-native-settings' {
  export const NativeSettings: {
    open(options: {
      optionAndroid: AndroidSettings;
      optionIOS: IOSSettings;
    }): Promise<void>;
  };
  
  export enum AndroidSettings {
    ApplicationDetails = 'application_details',
    // ... other settings
  }
  
  export enum IOSSettings {
    App = 'app',
    // ... other settings
  }
}
```

This declaration file tells TypeScript "trust me, this module exists" without requiring the actual package to be installed in the cloud build.

## Why This Works
- The native check `Capacitor.isNativePlatform()` returns `false` in web/cloud environments
- The dynamic import inside the `try` block only executes on native platforms
- The type declaration satisfies Vite's build-time import analysis
- Your local Android build already works because the package is installed there

## After Implementation
1. **Git commit and push** these changes to GitHub
2. The Lovable cloud build should succeed
3. Your local Android APK continues to work as before

## Technical Note
This is a common pattern for Capacitor plugins that are native-only. The type declaration acts as a "stub" for web builds while the real implementation runs on Android/iOS.
