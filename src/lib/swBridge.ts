/**
 * Service Worker Communication Bridge
 * 
 * Enables communication between the main app and the service worker
 * for background sync coordination.
 */

/**
 * Initialize the service worker message listener
 * @param onSync - Callback to run when SW triggers a sync
 */
export function initServiceWorkerBridge(onSync: () => void) {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW Bridge] Service workers not supported');
    return;
  }
  
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'TRIGGER_SYNC') {
      console.log('[SW Bridge] Received sync trigger from service worker');
      onSync();
    }
    if (event.data?.type === 'SYNC_SUCCESS') {
      console.log('[SW Bridge] Background sync success:', event.data.url);
    }
  });
  
  console.log('[SW Bridge] Initialized');
}

/**
 * Request a one-time background sync
 * Falls back gracefully if Background Sync API is not supported
 */
export async function requestBackgroundSync(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check if Background Sync API is available
    if ('sync' in registration) {
      await (registration as any).sync.register('doc-aga-sync');
      console.log('[SW Bridge] Background sync registered');
      return true;
    }
  } catch (error) {
    console.log('[SW Bridge] Background sync registration failed:', error);
  }
  
  return false;
}

/**
 * Request periodic background sync (Chrome Android only)
 * @param minInterval - Minimum interval between syncs in milliseconds
 */
export async function requestPeriodicSync(minInterval: number = 15 * 60 * 1000): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check if Periodic Sync API is available
    if ('periodicSync' in registration) {
      // Check permission
      const status = await navigator.permissions.query({
        name: 'periodic-background-sync' as PermissionName,
      });
      
      if (status.state === 'granted') {
        await (registration as any).periodicSync.register('doc-aga-periodic-sync', {
          minInterval,
        });
        console.log('[SW Bridge] Periodic sync registered');
        return true;
      }
    }
  } catch (error) {
    console.log('[SW Bridge] Periodic sync not available:', error);
  }
  
  return false;
}

/**
 * Tell service worker to process its queue immediately
 */
export async function triggerServiceWorkerSync(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: 'QUEUE_SYNC' });
    console.log('[SW Bridge] Triggered SW queue processing');
  } catch (error) {
    console.log('[SW Bridge] Failed to trigger SW sync:', error);
  }
}

/**
 * Tell service worker to skip waiting and activate immediately
 */
export async function skipWaiting(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
  } catch (error) {
    console.log('[SW Bridge] Failed to skip waiting:', error);
  }
}
