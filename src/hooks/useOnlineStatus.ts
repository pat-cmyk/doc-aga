import { useState, useEffect } from 'react';

/**
 * Non-hook accessor for use in non-React code (dataCache, syncService, etc.)
 * Also used inside mutationFn closures to get execution-time connectivity state.
 */
export function getIsOnline(): boolean {
  return navigator.onLine;
}

/**
 * React hook that subscribes to connectivity state changes.
 * Uses passive browser events (online/offline) for compatibility with Android WebView.
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
};
