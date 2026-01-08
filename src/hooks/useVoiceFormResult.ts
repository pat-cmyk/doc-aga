import { useState, useEffect, useCallback } from 'react';
import { getPendingCount } from '@/lib/offlineQueue';

/**
 * Event name for voice form results
 */
export const VOICE_FORM_RESULT_EVENT = 'voiceFormResult';

/**
 * Payload for voice form result events
 */
export interface VoiceFormResultPayload<T = Record<string, any>> {
  formType: string;
  queueId: string;
  data: T;
  transcription: string;
}

/**
 * Emit a voice form result event
 */
export function emitVoiceFormResult<T>(payload: VoiceFormResultPayload<T>) {
  const event = new CustomEvent(VOICE_FORM_RESULT_EVENT, { detail: payload });
  window.dispatchEvent(event);
}

/**
 * Hook for dialogs to receive processed voice results from offline queue
 * 
 * @param formType - The type of form to listen for (e.g., 'milk', 'feed', 'bcs')
 * @returns Object with pendingResult, queuedCount, and clearResult function
 */
export function useVoiceFormResult<T = Record<string, any>>(formType: string) {
  const [pendingResult, setPendingResult] = useState<T | null>(null);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);

  // Listen for voice form results
  useEffect(() => {
    const handleResult = (event: CustomEvent<VoiceFormResultPayload<T>>) => {
      if (event.detail.formType === formType) {
        setPendingResult(event.detail.data);
        setTranscription(event.detail.transcription);
      }
    };

    window.addEventListener(VOICE_FORM_RESULT_EVENT, handleResult as EventListener);
    return () => window.removeEventListener(VOICE_FORM_RESULT_EVENT, handleResult as EventListener);
  }, [formType]);

  // Refresh queued count periodically
  useEffect(() => {
    const refreshCount = async () => {
      try {
        const count = await getPendingCount();
        setQueuedCount(count);
      } catch {
        // Silently handle if queue not available
      }
    };

    refreshCount();
    
    // Refresh every 5 seconds when online
    const interval = setInterval(refreshCount, 5000);
    return () => clearInterval(interval);
  }, []);

  const clearResult = useCallback(() => {
    setPendingResult(null);
    setTranscription(null);
  }, []);

  return { 
    pendingResult, 
    transcription,
    queuedCount, 
    clearResult 
  };
}
