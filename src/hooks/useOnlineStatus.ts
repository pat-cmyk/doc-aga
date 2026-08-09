import { useState, useEffect } from 'react';

/**
 * Active connectivity probe for reliable offline detection.
 *
 * HISTORY: A previous attempt used HEAD requests to the Supabase REST API,
 * which failed because (1) it needed an apikey header and (2) error responses
 * lacked CORS headers, causing the browser to treat them as network errors
 * and permanently report "offline" (P0 bug).
 *
 * This implementation is fundamentally different:
 * - Target: Google's connectivity check endpoint (same one Android itself uses)
 * - Mode: `no-cors` — opaque response, immune to CORS issues
 * - Logic: fetch succeeds → online; fetch throws → offline
 */

const PROBE_URL = 'https://connectivitycheck.gstatic.com/generate_204';
const PROBE_TIMEOUT_MS = 5_000;
const PROBE_INTERVAL_ONLINE_MS = 30_000;  // 30s while online (verify)
const PROBE_INTERVAL_OFFLINE_MS = 10_000; // 10s while offline (detect reconnection faster)

// ─── Connection quality estimation ──────────────────────────────────────────
// Measured from probe round-trip times. Thresholds based on typical latencies:
// - Wi-Fi/4G: <300ms RTT
// - 3G: 300-1500ms RTT
// - 2G: >1500ms RTT (or probe timeout)
export type ConnectionQuality = 'fast' | 'slow' | '2g' | 'offline';

const RTT_THRESHOLD_FAST = 300;   // ms — Wi-Fi or 4G
const RTT_THRESHOLD_SLOW = 1500;  // ms — 3G
// Above 1500ms or timeout → 2G

let _connectionQuality: ConnectionQuality = 'fast';
let _lastProbeRTT: number = 0;

// ─── Singleton state ─────────────────────────────────────────────────────────
// Shared between the React hook and the non-hook getIsOnline() accessor.
// The probe runs as a singleton (once started, runs for the app's lifetime).
let _isOnline: boolean = navigator.onLine;
let _probeStarted = false;
let _probeTimer: ReturnType<typeof setTimeout> | null = null;
const _listeners = new Set<(online: boolean) => void>();

/**
 * Active connectivity probe — sends a lightweight no-cors fetch
 * to Google's connectivity check endpoint.
 *
 * In `no-cors` mode the fetch succeeds with an opaque response even
 * without CORS headers. The only failure case is a real network error
 * (TypeError: Failed to fetch), which reliably indicates no internet.
 */
async function probeConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const start = performance.now();

    await fetch(PROBE_URL, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    _lastProbeRTT = performance.now() - start;

    // Classify connection quality from RTT
    if (_lastProbeRTT < RTT_THRESHOLD_FAST) {
      _connectionQuality = 'fast';
    } else if (_lastProbeRTT < RTT_THRESHOLD_SLOW) {
      _connectionQuality = 'slow';
    } else {
      _connectionQuality = '2g';
    }

    return true;
  } catch {
    _connectionQuality = 'offline';
    _lastProbeRTT = 0;
    return false;
  }
}

/** Broadcast state change to all React hook subscribers */
function updateOnlineState(online: boolean) {
  if (online === _isOnline) return; // No change
  _isOnline = online;
  _listeners.forEach((fn) => fn(online));
}

/** Schedule the next probe (recursive setTimeout for dynamic interval). */
function scheduleProbe() {
  if (_probeTimer !== null) clearTimeout(_probeTimer);

  const interval = _isOnline
    ? PROBE_INTERVAL_ONLINE_MS
    : PROBE_INTERVAL_OFFLINE_MS;

  _probeTimer = setTimeout(async () => {
    const reallyOnline = await probeConnectivity();
    updateOnlineState(reallyOnline);
    scheduleProbe();
  }, interval);
}

/**
 * Start the singleton probe. Idempotent — only starts once.
 * Called by both `getIsOnline()` and `useOnlineStatus()`.
 */
function ensureProbeStarted() {
  if (_probeStarted) return;
  _probeStarted = true;

  // Passive browser events (instant but unreliable on Android WebView)
  window.addEventListener('online', () => {
    // Trust the "online" event, then verify with a probe
    updateOnlineState(true);
    probeConnectivity().then((reallyOnline) => {
      updateOnlineState(reallyOnline);
    });
  });
  window.addEventListener('offline', () => updateOnlineState(false));

  // Pause/resume probing when app visibility changes (saves battery)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (_probeTimer !== null) {
        clearTimeout(_probeTimer);
        _probeTimer = null;
      }
    } else {
      // Coming back to foreground — probe immediately then resume
      probeConnectivity().then((reallyOnline) => {
        updateOnlineState(reallyOnline);
        scheduleProbe();
      });
    }
  });

  // Initial probe + start periodic probing
  probeConnectivity().then((reallyOnline) => {
    updateOnlineState(reallyOnline);
    scheduleProbe();
  });
}

/**
 * Non-hook accessor for use in non-React code (dataCache, syncService, etc.)
 * Also used inside mutationFn closures to get execution-time connectivity state.
 *
 * Returns the probe-verified connectivity state. On the very first call
 * before the probe completes, falls back to navigator.onLine.
 */
export function getIsOnline(): boolean {
  ensureProbeStarted();
  return _isOnline;
}

/**
 * Subscribe to connectivity changes outside React (SSOT: same probe as
 * useOnlineStatus). Returns an unsubscribe function.
 * Does not fire with the current state on subscribe — call getIsOnline() first if you need it.
 */
export function subscribeOnlineStatus(listener: (online: boolean) => void): () => void {
  ensureProbeStarted();
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

/**
 * Non-hook accessor for connection quality.
 * Returns 'fast' (Wi-Fi/4G, <300ms), 'slow' (3G, 300-1500ms),
 * '2g' (>1500ms), or 'offline'.
 *
 * Used by dataCache to decide which caches to sync on slow connections.
 */
export function getConnectionQuality(): ConnectionQuality {
  ensureProbeStarted();
  return _isOnline ? _connectionQuality : 'offline';
}

/**
 * Non-hook accessor for last probe round-trip time in milliseconds.
 * Returns 0 if offline or no probe has completed yet.
 */
export function getLastProbeRTT(): number {
  return _lastProbeRTT;
}

/**
 * React hook that subscribes to connectivity state changes.
 *
 * Combines two signals:
 * 1. Passive browser events (online/offline) for instant transitions
 * 2. Active fetch-based probing (singleton) for ground-truth on Android WebView
 *
 * The probe automatically pauses when the app is in the background
 * and resumes when brought to the foreground (saves battery).
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(_isOnline);

  useEffect(() => {
    ensureProbeStarted();

    // Subscribe to state changes from the singleton
    const listener = (online: boolean) => setIsOnline(online);
    _listeners.add(listener);

    // Sync in case probe already updated before mount
    setIsOnline(_isOnline);

    return () => {
      _listeners.delete(listener);
    };
  }, []);

  return isOnline;
};
