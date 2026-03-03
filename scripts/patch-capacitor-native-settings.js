/**
 * Postinstall patch for capacitor-native-settings.
 *
 * AGP 9+ blocks getDefaultProguardFile('proguard-android.txt') at evaluation
 * time. The plugin hasn't been updated yet, so we patch it in node_modules
 * after every `npm install`.
 *
 * Safe to remove once the plugin publishes a fix.
 * Tracking: https://github.com/nicovddussen/capacitor-native-settings
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const gradlePath = resolve(
  __dirname,
  '../node_modules/capacitor-native-settings/android/build.gradle'
);

if (!existsSync(gradlePath)) {
  // Plugin not installed (e.g., CI without Android deps) — skip silently
  process.exit(0);
}

const content = readFileSync(gradlePath, 'utf-8');
const patched = content.replace(
  "proguard-android.txt",
  "proguard-android-optimize.txt"
);

if (content !== patched) {
  writeFileSync(gradlePath, patched, 'utf-8');
  console.log('[patch] capacitor-native-settings: replaced proguard-android.txt → proguard-android-optimize.txt');
} else {
  console.log('[patch] capacitor-native-settings: already patched');
}
