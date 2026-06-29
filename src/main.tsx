import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

// Auto-reload on stale dynamic import failures (after new deployments)
window.addEventListener('error', (event) => {
  if (event.message?.includes('Failed to fetch dynamically imported module')) {
    console.warn('[App] Stale chunk detected, reloading...');
    window.location.reload();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.message || String(event.reason);
  if (reason.includes('Failed to fetch dynamically imported module')) {
    console.warn('[App] Stale chunk detected (promise), reloading...');
    event.preventDefault();
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>
);

// Register service worker with auto-update and background sync support
const updateSW = registerSW({
  onNeedRefresh() {
    // New version available - auto-update without prompting
    console.log('[PWA] New version available, updating...');
    updateSW(true);
  },
  onOfflineReady() {
    console.log('[PWA] App ready to work offline');
  },
  onRegistered(registration) {
    console.log('[PWA] Service worker registered:', registration?.scope);

    if (registration) {
      // Force-check for SW updates on every app launch.
      // Critical for Capacitor: when a new APK is installed the local assets
      // change, but Android WebView may cache the old sw.js. Calling update()
      // forces a byte-for-byte comparison against the new file immediately.
      registration.update().catch(() => {
        console.log('[PWA] SW update check failed (offline?)');
      });

      // Re-check periodically while the app is open (every 60s)
      setInterval(() => {
        registration.update().catch(() => {});
      }, 60_000);

      // Try to register periodic sync for background updates (Chrome Android only)
      if ('periodicSync' in registration) {
        (registration as any).periodicSync.register('doc-aga-periodic-sync', {
          minInterval: 15 * 60 * 1000, // 15 minutes
        }).then(() => {
          console.log('[PWA] Periodic background sync registered');
        }).catch(() => {
          console.log('[PWA] Periodic sync not supported');
        });
      }
    }
  },
  onRegisterError(error) {
    console.error('[PWA] Service worker registration failed:', error);
  },
});
