import { Capacitor } from '@capacitor/core';

// Module name constants for variable indirection (prevents Rollup static analysis)
const CAP_CAMERA = '@capacitor/camera';
const CAP_LOCAL_NOTIF = '@capacitor/local-notifications';

let isInitialized = false;

export type PermissionStatus = 'granted' | 'denied' | 'prompt';

export interface PermissionResults {
  camera: PermissionStatus;
  microphone: PermissionStatus;
  notifications: PermissionStatus;
}

/**
 * Check current permission status without requesting
 */
export async function checkAllPermissions(): Promise<PermissionResults> {
  const results: PermissionResults = {
    camera: 'prompt',
    microphone: 'prompt',
    notifications: 'prompt',
  };

  if (!Capacitor.isNativePlatform()) {
    return results;
  }

  // Check camera - dynamic import
  try {
    const { Camera } = await import(/* @vite-ignore */ CAP_CAMERA);
    const cameraStatus = await Camera.checkPermissions();
    if (cameraStatus.camera === 'granted' && cameraStatus.photos === 'granted') {
      results.camera = 'granted';
    } else if (cameraStatus.camera === 'denied' || cameraStatus.photos === 'denied') {
      results.camera = 'denied';
    }
  } catch (error) {
    console.error('[DevicePermissions] Camera check failed:', error);
  }

  // Check microphone via Permissions API
  try {
    if (navigator.permissions) {
      const micStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      results.microphone = micStatus.state as PermissionStatus;
    }
  } catch (error) {
    // Safari doesn't support microphone permission query
    results.microphone = 'prompt';
  }

  // Check notifications - dynamic import
  try {
    const { LocalNotifications } = await import(/* @vite-ignore */ CAP_LOCAL_NOTIF);
    const notifStatus = await LocalNotifications.checkPermissions();
    results.notifications = notifStatus.display as PermissionStatus;
  } catch (error) {
    console.error('[DevicePermissions] Notification check failed:', error);
  }

  return results;
}

/**
 * Initialize and request all device permissions on app start.
 * This is the Single Source of Truth (SSOT) for permission initialization.
 * Mirrors the proven notification pattern for Camera and Microphone.
 */
export async function initDevicePermissions(): Promise<PermissionResults> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[DevicePermissions] Not on native platform, skipping initialization');
    return { camera: 'prompt', microphone: 'prompt', notifications: 'prompt' };
  }

  if (isInitialized) {
    console.log('[DevicePermissions] Already initialized, returning cached status');
    return checkAllPermissions();
  }

  console.log('[DevicePermissions] Initializing device permissions...');

  const results: PermissionResults = {
    camera: 'prompt',
    microphone: 'prompt',
    notifications: 'prompt',
  };

  // Camera: Use Capacitor Camera plugin for native permission dialog - dynamic import
  try {
    console.log('[DevicePermissions] Requesting camera permissions...');
    const { Camera } = await import(/* @vite-ignore */ CAP_CAMERA);
    const cameraStatus = await Camera.requestPermissions({
      permissions: ['camera', 'photos']
    });
    
    if (cameraStatus.camera === 'granted' && cameraStatus.photos === 'granted') {
      results.camera = 'granted';
    } else if (cameraStatus.camera === 'denied' || cameraStatus.photos === 'denied') {
      results.camera = 'denied';
    }
    console.log('[DevicePermissions] Camera permission result:', results.camera);
  } catch (error) {
    console.error('[DevicePermissions] Camera permission request failed:', error);
    results.camera = 'denied';
  }

  // Microphone: Use Web API with early trigger to register with Android
  // This forces Android to show the native permission dialog and register
  // the permission in system settings
  try {
    console.log('[DevicePermissions] Requesting microphone permissions...');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Immediately stop the stream - we just needed to trigger the permission
    stream.getTracks().forEach(track => track.stop());
    results.microphone = 'granted';
    console.log('[DevicePermissions] Microphone permission granted');
  } catch (error) {
    console.log('[DevicePermissions] Microphone permission denied or failed:', error);
    results.microphone = 'denied';
  }

  // Notifications: Already working, maintain existing behavior - dynamic import
  try {
    console.log('[DevicePermissions] Requesting notification permissions...');
    const { LocalNotifications } = await import(/* @vite-ignore */ CAP_LOCAL_NOTIF);
    const notifResult = await LocalNotifications.requestPermissions();
    results.notifications = notifResult.display as PermissionStatus;
    console.log('[DevicePermissions] Notification permission result:', results.notifications);
  } catch (error) {
    console.error('[DevicePermissions] Notification permission request failed:', error);
    results.notifications = 'denied';
  }

  isInitialized = true;
  console.log('[DevicePermissions] Initialization complete:', results);
  
  return results;
}

/**
 * Reset the initialization flag (useful for testing or re-requesting)
 */
export function resetPermissionInitialization(): void {
  isInitialized = false;
}
