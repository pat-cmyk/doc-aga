
Goal
- Fix the local `npm run build` failure: “Rollup failed to resolve import '@capacitor/camera' from src/lib/devicePermissionService.ts”.

What the screenshot is telling us
- This is not a runtime permission issue; it’s a bundling issue during the production build (specifically when the PWA build step runs).
- Even though the code uses dynamic imports, the way it’s written still leaves Rollup attempting to resolve `@capacitor/camera` at build time in some cases (especially in secondary builds like vite-plugin-pwa’s injectManifest build).
- A second common cause is simply: the local machine’s `node_modules` doesn’t actually contain `@capacitor/camera` (exported project not fully installed / lockfile mismatch). But we should make the build robust even if native-only plugins are absent in “web-only” environments.

Approach (two-layer fix)
1) Make dynamic imports “truly runtime-only” (so Rollup doesn’t try to resolve them)
   - Change `import(/* @vite-ignore */ '@capacitor/camera')` to use variable indirection:
     - `const CAMERA_MODULE = '@capacitor/camera'`
     - `await import(/* @vite-ignore */ CAMERA_MODULE)`
   - This is the same technique you already use for other native-only stubs in the project.

2) Explicitly tell Rollup to externalize native-only Capacitor plugins during web builds
   - Add `@capacitor/camera` and `@capacitor/local-notifications` to `build.rollupOptions.external` in `vite.config.ts`.
   - Optionally include other native-only plugins used via static imports (e.g., `@capacitor/haptics`) to prevent the next “resolve import” failure after we fix camera.

Files to inspect and update
A) `src/lib/devicePermissionService.ts`
- Update both camera dynamic import sites:
  - `checkAllPermissions()`
  - `initDevicePermissions()`
- Replace:
  - `await import(/* @vite-ignore */ '@capacitor/camera')`
  - with variable indirection.

B) `src/hooks/useDevicePermissions.ts`
- Update helper `getNativeCamera()` and `getLocalNotifications()` to use variable indirection (same reason).

C) `src/hooks/useNativeCamera.ts`
- Update `getNativeCamera()` to use variable indirection.
- Keep the `import type { Photo } from '@capacitor/camera'` as-is (type-only imports are erased at build and should not cause bundling issues).

D) `src/lib/notificationService.ts`
- Update `getLocalNotifications()` dynamic import to use variable indirection.

E) `src/App.tsx`
- Update the dynamic import for `@capacitor/local-notifications` to use variable indirection.

F) `vite.config.ts`
- Extend Rollup external list from:
  - `external: ['capacitor-native-settings']`
- To include:
  - `@capacitor/camera`
  - `@capacitor/local-notifications`
  - (optional but recommended) `@capacitor/haptics` if `src/lib/haptics.ts` is used in web builds and you want the build to survive without that plugin present.

Implementation details (exact pattern we will apply)
- Define module name constants near the helper:
  - `const CAP_CAMERA = '@capacitor/camera';`
  - `const CAP_LOCAL_NOTIF = '@capacitor/local-notifications';`
- Use:
  - `await import(/* @vite-ignore */ CAP_CAMERA)`
  - `await import(/* @vite-ignore */ CAP_LOCAL_NOTIF)`
This prevents Rollup from statically resolving those modules as part of the web/PWA build.

Local environment sanity checks (what you should do on your machine)
- After we implement the code changes, the build should be robust even if the modules are absent, but you should still confirm your install:
  1) `rm -rf node_modules package-lock.json` (or pnpm/yarn equivalents)
  2) `npm install`
  3) `npm run build`
- If you are building the native app after pulling latest changes:
  - `npx cap sync`
(You’ve used Capacitor already; syncing is required whenever dependencies or native plugin usage changes.)

Expected result
- `npm run build` succeeds for web/PWA builds without Rollup trying to resolve native-only Capacitor plugins.
- Native behavior remains unchanged because imports only occur at runtime on native platforms.

Test checklist
- Web: `npm run build` completes successfully.
- Web preview: app still loads and routes work (including /auth).
- Native Android: permissions flow still triggers camera + notifications properly.
- Native Android: no runtime crashes in screens that rely on camera/notifications.

If this still fails after the changes
- We’ll check for the next unresolved Capacitor plugin (often `@capacitor/haptics` or another plugin imported statically).
- We’ll apply the same pattern (variable-indirection dynamic import + externalization) to that plugin too.