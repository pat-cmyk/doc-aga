
# Fix: Cloud Build Error for Native Settings Plugin (Complete Solution)

## Root Cause Analysis

The previous fix added `capacitor-native-settings` to `build.rollupOptions.external`, but the error persists because:

1. **vite-plugin-pwa runs a separate Rollup process** for the service worker build
2. This separate process **does not inherit** the main Vite `external` configuration
3. Rollup scans ALL imports (including dynamic imports) during build analysis
4. Even though the code has a runtime guard (`Capacitor.isNativePlatform()`), the bundler still tries to resolve the import at build time

## Solution

We need a **build-time conditional import** approach that completely hides the native module from the bundler during web builds. This involves:

1. Creating a **virtual module shim** that provides a no-op implementation for web builds
2. Using **Vite's define feature** to swap implementations based on build target

### Alternative (Simpler) Approach

Since the `openAppSettings` function already has a platform check that returns early on web, we can refactor to use a **string-based dynamic import** that Vite/Rollup won't try to resolve:

## Changes Required

### 1. Refactor `src/lib/openAppSettings.ts`

Replace the static dynamic import with a fully runtime-evaluated import that bundlers cannot analyze:

```typescript
export async function openAppSettings(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[openAppSettings] Not on native platform');
    return false;
  }

  try {
    // Use a variable to prevent static analysis by bundlers
    const moduleName = 'capacitor-native-settings';
    const module = await import(/* @vite-ignore */ moduleName);
    const { NativeSettings, AndroidSettings, IOSSettings } = module;

    // ... rest of implementation
  } catch (error) {
    console.error('[openAppSettings] Failed to open settings:', error);
    return false;
  }
}
```

The key change is:
- `/* @vite-ignore */` comment tells Vite to skip analyzing this import
- Using a variable (`moduleName`) instead of a string literal prevents Rollup from resolving it

### 2. Keep existing files (no changes needed)

- `src/types/capacitor-native-settings.d.ts` - Keep for TypeScript support
- `vite.config.ts` with `external: ['capacitor-native-settings']` - Keep as fallback

## Technical Details

| Aspect | Before | After |
|--------|--------|-------|
| Import style | `await import('capacitor-native-settings')` | `await import(/* @vite-ignore */ moduleName)` |
| Bundler behavior | Tries to resolve and fails | Skips resolution entirely |
| Runtime behavior | Same | Same (works on native, no-op on web) |

## Why This Works

1. **`/* @vite-ignore */`** - Official Vite directive to skip import analysis
2. **Variable indirection** - `moduleName` variable prevents Rollup's static analysis from seeing the module name
3. **Platform guard first** - The `isNativePlatform()` check runs before the import, so on web the import never executes
4. **Type declaration file** - Keeps TypeScript happy without needing the actual package

## Files to Modify

1. **`src/lib/openAppSettings.ts`** - Add `@vite-ignore` comment and use variable for module name

## After Implementation

1. The cloud build should complete successfully
2. Your local Android APK build continues to work (the actual package is installed there)
3. Commit and push to GitHub
4. Proceed with your release process
