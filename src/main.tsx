import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
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
    
    // Try to register periodic sync for background updates (Chrome Android only)
    if (registration && 'periodicSync' in registration) {
      (registration as any).periodicSync.register('doc-aga-periodic-sync', {
        minInterval: 15 * 60 * 1000, // 15 minutes
      }).then(() => {
        console.log('[PWA] Periodic background sync registered');
      }).catch(() => {
        console.log('[PWA] Periodic sync not supported');
      });
    }
  },
  onRegisterError(error) {
    console.error('[PWA] Service worker registration failed:', error);
  },
});
