/**
 * Centralized app configuration for native platform
 * Used for consistent App ID references across the codebase
 */

export const APP_CONFIG = {
  appId: 'com.goldenforage.docaga',
  appName: 'Doc Aga',
  publishedUrl: 'https://doc-aga.lovable.app',
} as const;

/**
 * Get the base URL for public-facing links (invitations, shares, etc.)
 * Always uses the published URL to ensure external users can access
 */
export const getPublicAppUrl = () => APP_CONFIG.publishedUrl;

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
