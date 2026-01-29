/**
 * Utility for opening native app settings on Android/iOS
 * Uses @capgo/capacitor-native-settings for proper Android Intent handling
 */

import { Capacitor } from '@capacitor/core';

/**
 * Opens the app's settings page in the device's system settings.
 * On Android: Opens Settings > Apps > Doc Aga
 * On iOS: Opens Settings > Doc Aga
 * 
 * @returns true if settings were opened successfully, false otherwise
 */
export async function openAppSettings(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[openAppSettings] Not on native platform');
    return false;
  }

  try {
    // Dynamic import to avoid bundling issues on web
    const { NativeSettings, AndroidSettings, IOSSettings } = await import(
      '@capgo/capacitor-native-settings'
    );

    const platform = Capacitor.getPlatform();

    if (platform === 'android') {
      // Opens Settings > Apps > Doc Aga using ACTION_APPLICATION_DETAILS_SETTINGS
      await NativeSettings.open({
        optionAndroid: AndroidSettings.ApplicationDetails,
        optionIOS: IOSSettings.App,
      });
    } else if (platform === 'ios') {
      await NativeSettings.open({
        optionAndroid: AndroidSettings.ApplicationDetails,
        optionIOS: IOSSettings.App,
      });
    }

    console.log('[openAppSettings] Settings opened successfully');
    return true;
  } catch (error) {
    console.error('[openAppSettings] Failed to open settings:', error);
    return false;
  }
}
