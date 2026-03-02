import { useState, useEffect } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const PING_INTERVAL = 10_000; // 10 seconds
const PING_TIMEOUT = 5_000;   // 5 seconds

// Singleton state
let _isOnline = navigator.onLine;
const _listeners = new Set<(online: boolean) => void>();
let _intervalId: ReturnType<typeof setInterval> | null = null;
let _started = false;

function notifyListeners(online: boolean) {
  if (_isOnline === online) return;
  _isOnline = online;
  _listeners.forEach(cb => cb(online));
}

async function checkConnectivity(): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT);
    
    await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
    
    clearTimeout(timeoutId);
    notifyListeners(true);
  } catch {
    notifyListeners(false);
  }
}

function startProbing() {
  if (_started) return;
  _started = true;

  // Initial check
  checkConnectivity();

  // Periodic check when document is visible
  _intervalId = setInterval(() => {
    if (!document.hidden) {
      checkConnectivity();
    }
  }, PING_INTERVAL);

  // Passive browser events for instant transitions (when they work)
  window.addEventListener('online', () => {
    // Optimistically set online, verify with ping
    checkConnectivity();
  });
  window.addEventListener('offline', () => {
    notifyListeners(false);
  });

  // Pause/resume on visibility change
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkConnectivity();
    }
  });
}

// Auto-start probing on module load
startProbing();

/**
 * Non-hook accessor for use in non-React code (dataCache, syncService, etc.)
 */
export function getIsOnline(): boolean {
  return _isOnline;
}

/**
 * React hook that subscribes to connectivity state changes.
 * Uses active HEAD request probing (every 10s) to detect real connectivity,
 * solving Android WebView's unreliable navigator.onLine.
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(_isOnline);

  useEffect(() => {
    const handler = (online: boolean) => setIsOnline(online);
    _listeners.add(handler);
    // Sync with current state in case it changed before mount
    setIsOnline(_isOnline);
    return () => { _listeners.delete(handler); };
  }, []);

  return isOnline;
};
