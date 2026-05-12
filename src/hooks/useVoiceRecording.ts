/**
 * useVoiceRecording Hook
 * 
 * Unified voice recording hook that abstracts provider selection
 * (ElevenLabs Scribe vs Gemini) and manages the recording lifecycle.
 * 
 * Supports offline mode: queues audio for later transcription when offline.
 */

import { useReducer, useRef, useCallback, useEffect } from 'react';
import { useRealtimeTranscription } from './useRealtimeTranscription';
import { useOnlineStatus, getIsOnline } from './useOnlineStatus';
import { invokeWithTimeout } from '@/lib/sttService';
import { toast } from 'sonner';
import { hapticImpact, hapticNotification } from '@/lib/haptics';
import { queueOfflineAudio, type AudioQueueMetadata } from '@/lib/offlineAudioQueue';
import { compressAudio } from '@/lib/audioCompression';
import { Capacitor } from '@capacitor/core';
import {
  voiceReducer,
  createInitialState,
  canStop,
  isActiveSession,
  isProcessing,
  getStateLabel,
  getStateColor,
  type VoiceState,
  type VoiceStateData,
} from '@/lib/voiceStateMachine';
import {
  useVoiceSessionTracking,
  type VoiceRecordType,
  type VoiceCancelReason,
} from './useVoiceSessionTracking';

export interface UseVoiceRecordingOptions {
  /** Prefer realtime transcription (ElevenLabs Scribe). Default: true */
  preferRealtime?: boolean;

  /** Callback when transcription is complete */
  onTranscription?: (text: string) => void;

  /** Callback for partial transcripts (realtime mode only) */
  onPartialTranscript?: (text: string) => void;

  /** Callback on error */
  onError?: (error: Error) => void;

  /** Callback when audio is queued offline */
  onOfflineQueued?: (queueId: string) => void;

  /** Enable echo cancellation. Default: true */
  echoCancellation?: boolean;

  /** Enable noise suppression. Default: true */
  noiseSuppression?: boolean;

  /** Offline queue metadata for form-specific recordings */
  offlineMetadata?: Partial<AudioQueueMetadata>;

  /**
   * Voice attempt tracking — when set, every recording attempt is logged to
   * voice_session_attempts so admins can monitor voice abandonment.
   * Omit (or pass null) for voice flows we don't want to track (e.g. AI chat input).
   */
  trackingContext?: {
    recordType: VoiceRecordType;
    farmId?: string | null;
  } | null;
}

export interface UseVoiceRecordingReturn {
  // State
  state: VoiceState;
  stateData: VoiceStateData;
  partialTranscript: string;
  finalTranscript: string;
  error: Error | null;
  offlineQueueId: string | null;

  /** voice_session_attempts.id for the in-flight attempt, if tracking is enabled. */
  sessionId: string | null;

  // Actions
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  /** Cancel current recording. Optional reason describes why (defaults to 'user_cancelled'). */
  cancelRecording: (reason?: VoiceCancelReason) => void;
  confirmTranscription: () => void;
  retryRecording: () => void;
  reset: () => void;

  // Helpers
  isRecording: boolean;
  isProcessingAudio: boolean;
  canStopRecording: boolean;
  isOffline: boolean;
  stateLabel: string;
  stateColor: string;

  // Audio visualization
  mediaStream: MediaStream | null;
}

export function useVoiceRecording(
  options: UseVoiceRecordingOptions = {}
): UseVoiceRecordingReturn {
  const {
    preferRealtime = true,
    onTranscription,
    onPartialTranscript,
    onError,
    onOfflineQueued,
    echoCancellation = true,
    noiseSuppression = true,
    offlineMetadata,
    trackingContext,
  } = options;

  const isOnline = useOnlineStatus();

  const [stateData, dispatch] = useReducer(voiceReducer, createInitialState());

  // Refs for batch mode
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Track if we're using realtime mode
  const isUsingRealtimeRef = useRef(false);

  // Voice session tracking — only emits events when trackingContext is provided.
  const tracking = useVoiceSessionTracking();
  const sessionIdRef = useRef<string | null>(null);

  // ElevenLabs Scribe hook for realtime mode
  const realtime = useRealtimeTranscription({
    onPartialTranscript: (text) => {
      dispatch({ type: 'PARTIAL_TRANSCRIPT', text });
      onPartialTranscript?.(text);
    },
    onComplete: (fullText) => {
      console.log('[useVoiceRecording] Realtime complete:', fullText);
      dispatch({ type: 'PROCESSING_COMPLETE', transcript: fullText });
      // Mark the attempt as having reached the preview/confirmation step.
      if (sessionIdRef.current) {
        tracking.preview(sessionIdRef.current, {
          transcriptPreview: fullText,
          modelProvider: 'elevenlabs',
        });
      }
      onTranscription?.(fullText);
    },
    onError: (error) => {
      console.error('[useVoiceRecording] Realtime error:', error);
      // Fall back to batch mode
      dispatch({ type: 'ERROR', error });
      if (sessionIdRef.current) {
        tracking.markError(sessionIdRef.current, error.message);
        sessionIdRef.current = null;
      }
      onError?.(error);
    },
    echoCancellation,
    noiseSuppression,
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupStream();
      if (realtime.isConnected) {
        realtime.endSession();
      }
    };
  }, []);

  // Handle realtime connection state changes
  useEffect(() => {
    if (isUsingRealtimeRef.current) {
      if (realtime.isConnected && stateData.state === 'connecting') {
        dispatch({ type: 'CONNECT_SUCCESS' });
        hapticImpact('medium');
      }
    }
  }, [realtime.isConnected, stateData.state]);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  }, []);

  /**
   * Start recording - tries realtime first, falls back to batch
   */
  const startRecording = useCallback(async () => {
    if (stateData.state !== 'idle' && stateData.state !== 'error') {
      console.warn('[useVoiceRecording] Cannot start from state:', stateData.state);
      return;
    }

    dispatch({ type: 'REQUEST_MIC' });

    // Begin voice attempt tracking (best-effort; never block the recording flow).
    if (trackingContext) {
      tracking
        .start({
          recordType: trackingContext.recordType,
          farmId: trackingContext.farmId ?? null,
          modelProvider: preferRealtime ? 'elevenlabs' : 'gemini',
        })
        .then((id) => {
          sessionIdRef.current = id;
        })
        .catch((err) => console.warn('[useVoiceRecording] tracking.start failed:', err));
    }

    try {
      // Request microphone access directly - getUserMedia is more reliable than permissions.query
      // on Android WebView, and must be called within user gesture context
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation,
          noiseSuppression,
        } 
      });
      
      if (preferRealtime) {
        // Try realtime mode (ElevenLabs Scribe)
        console.log('[useVoiceRecording] Starting realtime transcription...');
        isUsingRealtimeRef.current = true;
        dispatch({ type: 'SET_PROVIDER', provider: 'elevenlabs' });
        dispatch({ type: 'CONNECT_START' });
        
        // Stop the permission check stream - realtime will create its own
        stream.getTracks().forEach(track => track.stop());
        
        try {
          await realtime.startSession();
          // Connection state will be handled by the effect above
        } catch (error) {
          console.warn('[useVoiceRecording] Realtime failed, falling back to batch:', error);
          isUsingRealtimeRef.current = false;
          await startBatchRecording();
        }
      } else {
        // Use batch mode directly
        streamRef.current = stream;
        await startBatchRecording();
      }
    } catch (error: any) {
      console.error('[useVoiceRecording] Microphone access error:', error);
      const micError = new Error(
        error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError'
          ? 'Microphone access denied'
          : 'Failed to access microphone'
      );
      dispatch({ type: 'MIC_DENIED', error: micError });
      // Tracking: log permission failure or error before resetting.
      if (sessionIdRef.current) {
        if (micError.message.includes('denied') && trackingContext) {
          tracking.cancel(sessionIdRef.current, trackingContext.recordType, 'permission_denied');
        } else {
          tracking.markError(sessionIdRef.current, micError.message);
        }
        sessionIdRef.current = null;
      }
      onError?.(micError);
    }
  }, [stateData.state, preferRealtime, realtime, onError, trackingContext, tracking]);

  /**
   * Start batch recording (fallback mode using Gemini)
   */
  const startBatchRecording = useCallback(async () => {
    console.log('[useVoiceRecording] Starting batch recording...');
    dispatch({ type: 'SET_PROVIDER', provider: 'gemini' });
    
    try {
      // Get stream if not already available
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      const stream = streamRef.current;
      
      // Determine supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        cleanupStream();
        await processBatchAudio(audioBlob);
      };

      mediaRecorder.onerror = (event) => {
        console.error('[useVoiceRecording] MediaRecorder error:', event);
        dispatch({ type: 'ERROR', error: new Error('Recording failed') });
        cleanupStream();
      };

      mediaRecorder.start();
      dispatch({ type: 'RECORDING_START' });
      hapticImpact('medium');
    } catch (error: any) {
      console.error('[useVoiceRecording] Batch recording error:', error);
      dispatch({ type: 'ERROR', error: new Error('Failed to start recording') });
      cleanupStream();
    }
  }, [cleanupStream]);

  /**
   * Process batch audio using Gemini voice-to-text
   * Falls back to offline queue if not connected
   */
  const processBatchAudio = useCallback(async (blob: Blob) => {
    // Check if offline - queue audio for later
    if (!getIsOnline()) {
      console.log('[useVoiceRecording] Offline - queueing audio for later transcription');
      
      try {
        const metadata: AudioQueueMetadata = {
          source: offlineMetadata?.source || 'general',
          extractorType: offlineMetadata?.extractorType,
          extractorContext: offlineMetadata?.extractorContext,
          farmId: offlineMetadata?.farmId,
        };
        
        const queueId = await queueOfflineAudio(blob, metadata);
        
        dispatch({ type: 'OFFLINE_QUEUED', queueId });
        onOfflineQueued?.(queueId);
        
        toast.info('Recording saved offline', {
          description: 'Will transcribe when you\'re back online.',
          duration: 4000,
        });
        
        hapticNotification('success');
        return;
      } catch (error: any) {
        console.error('[useVoiceRecording] Failed to queue audio:', error);
        dispatch({ type: 'ERROR', error: new Error(error.message || 'Failed to save recording') });
        onError?.(error);
        hapticNotification('error');
        return;
      }
    }
    
    // Online - proceed with transcription
    dispatch({ type: 'PROCESSING_START' });
    
    try {
      // Convert blob to base64
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      console.log('[useVoiceRecording] Sending audio for transcription...');

      const { data, error } = await invokeWithTimeout('voice-to-text', {
        audio: base64Audio,
      });

      if (error) {
        throw new Error(error.message || 'Transcription failed');
      }

      const transcript = data?.text;
      if (!transcript) {
        throw new Error('No speech detected');
      }

      console.log('[useVoiceRecording] Batch transcription:', transcript);
      dispatch({ type: 'PROCESSING_COMPLETE', transcript });
      if (sessionIdRef.current) {
        tracking.preview(sessionIdRef.current, {
          transcriptPreview: transcript,
          modelProvider: 'gemini',
        });
      }
      onTranscription?.(transcript);
      hapticNotification('success');
    } catch (error: any) {
      console.error('[useVoiceRecording] Batch processing error:', error);
      const processingError = new Error(error.message || 'Failed to process audio');
      dispatch({ type: 'ERROR', error: processingError });
      if (sessionIdRef.current) {
        tracking.markError(sessionIdRef.current, processingError.message);
        sessionIdRef.current = null;
      }
      onError?.(processingError);
      hapticNotification('error');
    }
  }, [onTranscription, onError, onOfflineQueued, offlineMetadata, tracking]);

  /**
   * Stop recording - works for both realtime and batch modes
   */
  const stopRecording = useCallback(() => {
    console.log('[useVoiceRecording] Stop requested. State:', stateData.state, 'Realtime:', isUsingRealtimeRef.current);
    
    if (!canStop(stateData.state)) {
      console.warn('[useVoiceRecording] Cannot stop from state:', stateData.state);
      return;
    }

    dispatch({ type: 'STOP_REQUESTED' });
    hapticImpact('light');

    if (isUsingRealtimeRef.current) {
      // Stop realtime session
      console.log('[useVoiceRecording] Stopping realtime session...');
      realtime.endSession();
      isUsingRealtimeRef.current = false;
    } else if (mediaRecorderRef.current) {
      // Stop batch recording
      console.log('[useVoiceRecording] Stopping batch recording...');
      mediaRecorderRef.current.stop();
    } else {
      // No active recording, just reset
      console.log('[useVoiceRecording] No active recording, resetting...');
      dispatch({ type: 'RESET' });
    }
  }, [stateData.state, realtime]);

  /**
   * Cancel recording without processing. Optional reason describes why
   * (defaults to 'user_cancelled'; the dialog's preview-toast "Cancel" button
   * passes this in to distinguish user-cancel from auto-timeout).
   */
  const cancelRecording = useCallback((reason: VoiceCancelReason = 'user_cancelled') => {
    console.log('[useVoiceRecording] Cancelling recording. reason=', reason);

    if (isUsingRealtimeRef.current) {
      realtime.endSession();
      isUsingRealtimeRef.current = false;
    }

    // Tracking: log cancellation so admins can correlate "voice → cancel → manual".
    if (sessionIdRef.current && trackingContext) {
      tracking.cancel(
        sessionIdRef.current,
        trackingContext.recordType,
        reason,
        stateData.finalTranscript || undefined,
      );
      sessionIdRef.current = null;
    }

    cleanupStream();
    dispatch({ type: 'RESET' });
    hapticImpact('light');
  }, [realtime, cleanupStream, trackingContext, tracking, stateData.finalTranscript]);

  /**
   * Confirm transcription (from preview state).
   * Note: commit() linkage is called by the record-entry dialog, not here,
   * since only the dialog knows the final_record_id.
   */
  const confirmTranscription = useCallback(() => {
    dispatch({ type: 'PREVIEW_CONFIRM' });
    // sessionIdRef is intentionally NOT cleared here — the dialog's submit handler
    // reads it to call tracking.commit() with the new record id.
  }, []);

  /**
   * Retry recording after error
   */
  const retryRecording = useCallback(() => {
    dispatch({ type: 'RETRY' });
    startRecording();
  }, [startRecording]);

  /**
   * Reset to initial state.
   * If a tracked attempt is still mid-flight (preview shown but never confirmed
   * or explicitly cancelled), mark it as 'timeout' so we don't leave 'pending' rows.
   */
  const reset = useCallback(() => {
    if (isUsingRealtimeRef.current) {
      realtime.endSession();
      isUsingRealtimeRef.current = false;
    }
    if (sessionIdRef.current) {
      // If we were in preview state and got reset (e.g. auto-reset from showPreview=false flow),
      // the attempt was effectively confirmed by something downstream; if not in preview,
      // treat as a timeout.
      if (stateData.state === 'preview') {
        // Leave it pending — caller (record dialog) is expected to call commit().
      } else {
        tracking.markTimeout(sessionIdRef.current);
        sessionIdRef.current = null;
      }
    }
    cleanupStream();
    dispatch({ type: 'RESET' });
  }, [realtime, cleanupStream, tracking, stateData.state]);

  return {
    // State
    state: stateData.state,
    stateData,
    partialTranscript: stateData.partialTranscript || realtime.partialTranscript,
    finalTranscript: stateData.finalTranscript,
    error: stateData.error,
    offlineQueueId: stateData.offlineQueueId,
    sessionId: sessionIdRef.current,

    // Actions
    startRecording,
    stopRecording,
    cancelRecording,
    confirmTranscription,
    retryRecording,
    reset,
    
    // Helpers
    isRecording: isActiveSession(stateData.state),
    isProcessingAudio: isProcessing(stateData.state),
    canStopRecording: canStop(stateData.state),
    isOffline: !isOnline,
    stateLabel: getStateLabel(stateData.state, isUsingRealtimeRef.current),
    stateColor: getStateColor(stateData.state),
    
    // Audio visualization
    mediaStream: streamRef.current,
  };
}
