/**
 * Centralized app configuration for native platform
 * Used for consistent App ID references across the codebase
 */

export const APP_CONFIG = {
  appId: 'com.goldenforage.docaga',
  appName: 'Doc Aga',
} as const;

/**
 * Get the Android app settings URL for AppLauncher
 * Opens the app's settings page in Android system settings
 */
export const getAndroidSettingsUrl = () => 
  `package:${APP_CONFIG.appId}`;

/**
 * Get the iOS app settings URL for AppLauncher
 * Opens the app's settings page in iOS Settings app
 */
export const getIOSSettingsUrl = () => 'app-settings:';
