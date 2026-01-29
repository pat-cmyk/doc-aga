import { Capacitor } from '@capacitor/core';

// Module name constant for variable indirection (prevents Rollup static analysis)
const CAP_LOCAL_NOTIF = '@capacitor/local-notifications';

let isInitialized = false;

// Dynamic import helper for LocalNotifications
async function getLocalNotifications() {
  const { LocalNotifications } = await import(/* @vite-ignore */ CAP_LOCAL_NOTIF);
  return LocalNotifications;
}

export async function initNotifications(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.log('Notifications not available on web');
    return false;
  }

  if (isInitialized) return true;

  try {
    const LocalNotifications = await getLocalNotifications();
    const permission = await LocalNotifications.requestPermissions();
    isInitialized = permission.display === 'granted';
    return isInitialized;
  } catch (error) {
    console.error('Failed to initialize notifications:', error);
    return false;
  }
}

export async function sendNotification(
  title: string,
  body: string,
  data?: any
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    console.log('Notification (web fallback):', title, body);
    return;
  }

  try {
    await initNotifications();
    
    const LocalNotifications = await getLocalNotifications();
    await LocalNotifications.schedule({
      notifications: [{
        title,
        body,
        id: Date.now(),
        schedule: { at: new Date(Date.now() + 1000) },
        extra: data,
        smallIcon: 'ic_stat_icon_config_sample',
        iconColor: '#10b981',
      }]
    });
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}

export async function sendSyncSuccessNotification(itemType: string, details: string): Promise<void> {
  const titles: Record<string, string> = {
    'animal_form': 'Animal Added ✅',
    'voice_activity': 'Activity Processed ✅',
  };

  await sendNotification(
    titles[itemType] || 'Synced ✅',
    details,
    { type: itemType }
  );
}

export async function sendSyncFailureNotification(itemCount: number, itemId?: string): Promise<void> {
  await sendNotification(
    'Sync Failed ❌',
    itemCount === 1
      ? 'Hindi na-sync ang 1 item. Tap to retry.'
      : `Hindi na-sync ang ${itemCount} items. Tap to retry.`,
    { failed: true, itemId }
  );
}

export async function sendQueuedNotification(itemType: string): Promise<void> {
  const messages: Record<string, string> = {
    'animal_form': 'Animal na-save offline. Auto-sync later.',
    'voice_activity': 'Recording na-save. I-process later.',
  };

  await sendNotification(
    'Saved Offline 📴',
    messages[itemType] || 'Data saved offline',
    { queued: true, type: itemType }
  );
}
