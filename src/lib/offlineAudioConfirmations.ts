/**
 * Offline Audio Confirmations
 *
 * Pre-caches TTS audio snippets for offline confirmation feedback.
 * When a farmhand saves data offline, they hear spoken confirmation
 * instead of relying on visual-only toast notifications.
 *
 * Reuses: text-to-speech edge function pattern from DocAga.tsx:360
 */

import { supabase } from '@/integrations/supabase/client';

// ==================== TYPES ====================

type ConfirmationType = 'save' | 'queue' | 'sync';

interface CachedConfirmation {
  type: ConfirmationType;
  base64Audio: string;
  cachedAt: number;
}

// ==================== CONSTANTS ====================

const STORAGE_KEY = 'offline_audio_confirmations';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const CONFIRMATION_PHRASES: Record<ConfirmationType, string> = {
  save: 'Nai-save na offline.',
  queue: 'Na-queue na ang record.',
  sync: 'Ise-sync kapag may internet.',
};

// ==================== CACHE OPERATIONS ====================

function getCachedConfirmations(): Record<string, CachedConfirmation> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

function saveCachedConfirmations(data: Record<string, CachedConfirmation>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('[OfflineAudioConfirm] Failed to save cache:', error);
  }
}

/**
 * Pre-cache confirmation audio phrases via TTS edge function.
 * Call once when the app first comes online.
 */
export async function cacheOfflineConfirmations(): Promise<void> {
  // Guard: only call TTS when user is authenticated
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return;
  }

  const existing = getCachedConfirmations();
  const now = Date.now();

  // Skip if cache is fresh
  const anyEntry = Object.values(existing)[0];
  if (anyEntry && now - anyEntry.cachedAt < CACHE_MAX_AGE_MS) {
    return;
  }

  const updated: Record<string, CachedConfirmation> = {};

  for (const [type, phrase] of Object.entries(CONFIRMATION_PHRASES)) {
    try {
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: phrase },
      });

      if (!error && data?.audioContent) {
        updated[type] = {
          type: type as ConfirmationType,
          base64Audio: data.audioContent,
          cachedAt: now,
        };
      }
    } catch (err) {
      console.warn(`[OfflineAudioConfirm] Failed to cache "${type}":`, err);
    }
  }

  if (Object.keys(updated).length > 0) {
    saveCachedConfirmations({ ...existing, ...updated });
    console.log(`[OfflineAudioConfirm] Cached ${Object.keys(updated).length} confirmation phrases`);
  }
}

/**
 * Play a pre-cached offline confirmation audio.
 * Graceful no-op if cache is missing (falls back to existing toast/haptic).
 */
export function playOfflineConfirmation(type: ConfirmationType = 'save'): void {
  try {
    const cached = getCachedConfirmations();
    const entry = cached[type];
    if (!entry?.base64Audio) return;

    const audioBytes = Uint8Array.from(atob(entry.base64Audio), (c) => c.charCodeAt(0));
    const blob = new Blob([audioBytes], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);

    const audio = new Audio(url);
    audio.volume = 0.7;
    audio.onended = () => URL.revokeObjectURL(url);
    audio.onerror = () => URL.revokeObjectURL(url);
    audio.play().catch(() => {
      // Autoplay blocked — graceful no-op
      URL.revokeObjectURL(url);
    });
  } catch {
    // Graceful no-op — existing toast/haptic feedback still works
  }
}
