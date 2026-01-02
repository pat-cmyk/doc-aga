/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, NetworkOnly } from 'workbox-strategies';
import { BackgroundSyncPlugin, Queue } from 'workbox-background-sync';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

// Supabase project URL pattern
const SUPABASE_URL = 'sxorybjlxyquxteptdyk.supabase.co';

// Precache all static assets injected by Vite
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

/**
 * Create queue for offline sync operations
 * Items remain in queue for up to 24 hours
 */
const docAgaSyncQueue = new Queue('doc-aga-sync-queue', {
  maxRetentionTime: 24 * 60, // 24 hours in minutes
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request);
        // Notify clients of successful sync
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'SYNC_SUCCESS',
            url: entry.request.url,
          });
        });
      } catch (error) {
        // Put back for retry
        await queue.unshiftRequest(entry);
        throw error;
      }
    }
  },
});

/**
 * Background sync plugin for Supabase API calls
 * Automatically retries failed POST/PATCH requests when online
 */
const bgSyncPlugin = new BackgroundSyncPlugin('doc-aga-api-sync', {
  maxRetentionTime: 24 * 60, // 24 hours
});

// Cache animals data with cache-first strategy for quick loads
registerRoute(
  new RegExp(`${SUPABASE_URL}/rest/v1/animals\\?`),
  new CacheFirst({
    cacheName: 'animals-cache',
    plugins: [
      new ExpirationPlugin({ 
        maxAgeSeconds: 60 * 60, // 1 hour
        maxEntries: 50,
      }),
    ],
  })
);

// Cache records with network-first strategy
registerRoute(
  new RegExp(`${SUPABASE_URL}/rest/v1/(milking_records|weight_records|health_records|feeding_records|ai_records)\\?`),
  new NetworkFirst({
    cacheName: 'records-cache',
    plugins: [
      new ExpirationPlugin({ 
        maxAgeSeconds: 30 * 60, // 30 minutes
        maxEntries: 100,
      }),
    ],
  })
);

// Cache feed inventory with network-first
registerRoute(
  new RegExp(`${SUPABASE_URL}/rest/v1/feed_inventory\\?`),
  new NetworkFirst({
    cacheName: 'feed-cache',
    plugins: [
      new ExpirationPlugin({ 
        maxAgeSeconds: 2 * 60 * 60, // 2 hours
        maxEntries: 50,
      }),
    ],
  })
);

// Handle POST requests with background sync
registerRoute(
  new RegExp(`${SUPABASE_URL}/rest/v1/`),
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  'POST'
);

// Handle PATCH requests with background sync
registerRoute(
  new RegExp(`${SUPABASE_URL}/rest/v1/`),
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  'PATCH'
);

/**
 * Notify app to run its sync logic
 */
async function triggerAppSync() {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage({ type: 'TRIGGER_SYNC' });
  });
}

// Listen for sync events (triggered by browser when online)
self.addEventListener('sync', (event) => {
  if (event.tag === 'doc-aga-sync') {
    event.waitUntil(triggerAppSync());
  }
});

// Periodic sync (if supported - Chrome Android only)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'doc-aga-periodic-sync') {
    event.waitUntil(triggerAppSync());
  }
});

// Message handler for app communication
self.addEventListener('message', (event) => {
  if (event.data?.type === 'QUEUE_SYNC') {
    // Trigger queue processing
    docAgaSyncQueue.replayRequests();
  }
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Handle service worker installation
self.addEventListener('install', () => {
  console.log('[SW] Installing service worker...');
  self.skipWaiting();
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(self.clients.claim());
});
