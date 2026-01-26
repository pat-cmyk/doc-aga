/**
 * useRealtimeTranscription Hook
 * 
 * Wrapper around ElevenLabs useScribe hook for realtime speech-to-text.
 * Provides low-latency transcription with Taglish support.
 * 
 * Features:
 * - Token generation via edge function
 * - VAD (Voice Activity Detection) for natural speech segmentation
 * - Partial + committed transcript handling
 * - Graceful fallback to batch transcription
 */

import { useCallback, useState, useRef } from 'react';
import { useScribe, CommitStrategy } from '@elevenlabs/react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface UseRealtimeTranscriptionOptions {
  /** Callback when partial transcript is available (during speech) */
  onPartialTranscript?: (text: string) => void;
  
  /** Callback when transcript is committed (after pause/stop) */
  onCommittedTranscript?: (text: string) => void;
  
  /** Callback when transcription session ends with all text */
  onComplete?: (fullTranscript: string) => void;
  
  /** Callback on error */
  onError?: (error: Error) => void;
  
  /** Whether to auto-connect on mount (default: false) */
  autoConnect?: boolean;
  
  /** Commit strategy: 'vad' for auto-commit on silence, 'manual' for explicit commit */
  commitStrategy?: 'vad' | 'manual';
  
  /** Enable noise suppression (default: true) */
  noiseSuppression?: boolean;
  
  /** Enable echo cancellation (default: true) */
  echoCancellation?: boolean;
}

export interface UseRealtimeTranscriptionReturn {
  /** Whether the transcription session is active */
  isConnected: boolean;
  
  /** Whether we're in the process of connecting */
  isConnecting: boolean;
  
  /** Current partial transcript (updates during speech) */
  partialTranscript: string;
  
  /** All committed transcript segments */
  committedTranscripts: Array<{ id: string; text: string }>;
  
  /** Full transcript (all committed + current partial) */
  fullTranscript: string;
  
  /** Start the transcription session */
  startSession: () => Promise<void>;
  
  /** End the transcription session */
  endSession: () => Promise<void>;
  
  /** Manually commit current segment (only for manual commit strategy) */
  commit: () => void;
  
  /** Clear all transcripts */
  clearTranscripts: () => void;
  
  /** Last error if any */
  error: Error | null;
}

export function useRealtimeTranscription(
  options: UseRealtimeTranscriptionOptions = {}
): UseRealtimeTranscriptionReturn {
  const {
    onPartialTranscript,
    onCommittedTranscript,
    onComplete,
    onError,
    commitStrategy = 'vad',
    noiseSuppression = true,
    echoCancellation = true,
  } = options;

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fullTranscriptRef = useRef<string>('');

  // Map string to CommitStrategy enum
  const scribeCommitStrategy = commitStrategy === 'vad' 
    ? CommitStrategy.VAD 
    : CommitStrategy.MANUAL;

  // ElevenLabs Scribe hook
  const scribe = useScribe({
    modelId: 'scribe_v2_realtime',
    commitStrategy: scribeCommitStrategy,
    onPartialTranscript: (data) => {
      onPartialTranscript?.(data.text);
    },
    onCommittedTranscript: (data) => {
      fullTranscriptRef.current += (fullTranscriptRef.current ? ' ' : '') + data.text;
      onCommittedTranscript?.(data.text);
    },
  });

  /**
   * Get token and start transcription session
   */
  const startSession = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    fullTranscriptRef.current = '';

    try {
      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get token from edge function
      const { data, error: tokenError } = await supabase.functions.invoke(
        'elevenlabs-scribe-token'
      );

      if (tokenError) {
        throw new Error(tokenError.message || 'Failed to get transcription token');
      }

      if (!data?.token) {
        throw new Error('No token received from server');
      }

      console.log('[useRealtimeTranscription] Token received, connecting to Scribe...');

      // Start the scribe session
      await scribe.connect({
        token: data.token,
        microphone: {
          echoCancellation,
          noiseSuppression,
          autoGainControl: true,
        },
      });

      console.log('[useRealtimeTranscription] Connected successfully');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start transcription');
      console.error('[useRealtimeTranscription] Error:', error);
      setError(error);
      onError?.(error);
      
      // Show user-friendly error
      if (error.message.includes('permission') || error.message.includes('NotAllowed')) {
        toast.error('Microphone access required for voice input');
      } else if (error.message.includes('rate limit') || error.message.includes('429')) {
        toast.error('Too many requests. Please try again in a moment.');
      } else {
        toast.error('Failed to start voice input. Please try again.');
      }
    } finally {
      setIsConnecting(false);
    }
  }, [scribe, echoCancellation, noiseSuppression, onError]);

  /**
   * End transcription session
   */
  const endSession = useCallback(async () => {
    try {
      scribe.disconnect();
      
      // Call onComplete with full transcript
      const fullText = fullTranscriptRef.current + 
        (scribe.partialTranscript ? ' ' + scribe.partialTranscript : '');
      
      if (fullText.trim()) {
        onComplete?.(fullText.trim());
      }
      
      console.log('[useRealtimeTranscription] Session ended. Full transcript:', fullText);
    } catch (err) {
      console.error('[useRealtimeTranscription] Error ending session:', err);
    }
  }, [scribe, onComplete]);

  /**
   * Clear all transcripts
   */
  const clearTranscripts = useCallback(() => {
    fullTranscriptRef.current = '';
    scribe.clearTranscripts();
  }, [scribe]);

  // Compute full transcript including current partial
  const fullTranscript = fullTranscriptRef.current + 
    (scribe.partialTranscript ? ' ' + scribe.partialTranscript : '');

  return {
    isConnected: scribe.isConnected,
    isConnecting,
    partialTranscript: scribe.partialTranscript,
    committedTranscripts: scribe.committedTranscripts,
    fullTranscript: fullTranscript.trim(),
    startSession,
    endSession,
    commit: scribe.commit,
    clearTranscripts,
    error,
  };
}
