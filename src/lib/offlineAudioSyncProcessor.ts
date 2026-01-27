/**
 * Offline Audio Sync Processor
 * 
 * Handles transcription of queued audio recordings when connectivity is restored.
 * Processes items one at a time, runs extractors, and emits results to listening forms.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  getPendingAudio,
  markTranscribing,
  markTranscribed,
  markFailed,
  removeAudioItem,
  type AudioQueueItem,
} from './offlineAudioQueue';
import { runExtractor, type ExtractorType, type ExtractorContext } from './voiceFormExtractors';
import { emitVoiceFormResult } from '@/hooks/useVoiceFormResult';
import { toast } from 'sonner';

const MAX_RETRIES = 3;

/**
 * Convert audio Blob to base64 string for API transmission
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      const base64Data = base64.split(',')[1] || base64;
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Transcribe audio using voice-to-text edge function
 */
async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const base64Audio = await blobToBase64(audioBlob);
  
  const { data, error } = await supabase.functions.invoke('voice-to-text', {
    body: { audio: base64Audio }
  });

  if (error) {
    throw new Error(error.message || 'Transcription failed');
  }

  if (!data?.text) {
    throw new Error('No transcription returned');
  }

  return data.text;
}

/**
 * Process a single audio queue item
 */
async function processAudioItem(item: AudioQueueItem): Promise<boolean> {
  console.log(`[OfflineAudioSync] Processing: ${item.id} (${item.metadata.source})`);
  
  try {
    // Mark as transcribing
    await markTranscribing(item.id);
    
    // Transcribe audio
    const transcript = await transcribeAudio(item.audioBlob);
    console.log(`[OfflineAudioSync] Transcribed: "${transcript.substring(0, 50)}..."`);
    
    // Mark as transcribed
    await markTranscribed(item.id, transcript);
    
    // If form-specific, run extractor and emit result
    if (item.metadata.extractorType) {
      const extractedData = runExtractor(
        transcript,
        item.metadata.extractorType as ExtractorType,
        item.metadata.extractorContext as ExtractorContext
      );
      
      console.log(`[OfflineAudioSync] Extracted data:`, extractedData);
      
      // Emit to listening form dialogs
      emitVoiceFormResult({
        formType: item.metadata.source || item.metadata.extractorType,
        queueId: item.id,
        data: extractedData,
        transcription: transcript,
      });
    }
    
    // Show success toast
    const previewText = transcript.length > 40 
      ? transcript.substring(0, 40) + '...' 
      : transcript;
    toast.success(`Transcribed: "${previewText}"`, {
      description: `From offline recording (${item.metadata.source})`,
    });
    
    // Remove the item after successful processing
    await removeAudioItem(item.id);
    
    return true;
  } catch (error: any) {
    console.error(`[OfflineAudioSync] Failed to process ${item.id}:`, error);
    
    const errorMessage = error.message || 'Unknown error';
    
    if (item.retries >= MAX_RETRIES - 1) {
      // Max retries reached, mark as failed permanently
      await markFailed(item.id, errorMessage);
      toast.error(`Failed to transcribe offline recording after ${MAX_RETRIES} attempts`, {
        description: errorMessage,
      });
    } else {
      // Increment retry counter
      await markFailed(item.id, errorMessage);
    }
    
    return false;
  }
}

/**
 * Sync all pending offline audio recordings
 * 
 * Called automatically when connectivity is restored.
 * Processes items sequentially to avoid overwhelming the transcription service.
 */
export async function syncOfflineAudio(): Promise<{ processed: number; failed: number }> {
  const pending = await getPendingAudio();
  
  if (pending.length === 0) {
    console.log('[OfflineAudioSync] No pending audio to sync');
    return { processed: 0, failed: 0 };
  }
  
  console.log(`[OfflineAudioSync] Starting sync of ${pending.length} audio items...`);
  
  let processed = 0;
  let failed = 0;
  
  for (const item of pending) {
    // Check if still online before each item
    if (!navigator.onLine) {
      console.log('[OfflineAudioSync] Lost connectivity, stopping sync');
      break;
    }
    
    const success = await processAudioItem(item);
    if (success) {
      processed++;
    } else {
      failed++;
    }
    
    // Small delay between items to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`[OfflineAudioSync] Sync complete: ${processed} processed, ${failed} failed`);
  
  return { processed, failed };
}

/**
 * Retry all failed audio items
 */
export async function retryFailedAudio(): Promise<number> {
  const { getFailedAudio, resetForRetry } = await import('./offlineAudioQueue');
  const failed = await getFailedAudio();
  
  for (const item of failed) {
    await resetForRetry(item.id);
  }
  
  if (failed.length > 0 && navigator.onLine) {
    // Trigger sync after resetting
    setTimeout(() => syncOfflineAudio(), 100);
  }
  
  return failed.length;
}
