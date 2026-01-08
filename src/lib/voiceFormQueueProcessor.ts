/**
 * Voice Form Queue Processor
 * 
 * Handles processing of queued voice form inputs when back online.
 * Transcribes audio and runs extractors to populate form data.
 */

import { supabase } from '@/integrations/supabase/client';
import { runExtractor, type ExtractorType, type ExtractorContext, type ExtractedData } from './voiceFormExtractors';
import { emitVoiceFormResult } from '@/hooks/useVoiceFormResult';
import type { QueueItem } from './offlineQueue';

/**
 * Convert audio Blob to base64 string
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
 * Process a voice form input queue item
 * 
 * 1. Transcribes the audio
 * 2. Runs the appropriate extractor
 * 3. Emits the result to listening form dialogs
 */
export async function processVoiceFormInput(item: QueueItem): Promise<ExtractedData> {
  const { voiceFormInput } = item.payload;
  
  if (!voiceFormInput) {
    throw new Error('No voice form input data in queue item');
  }

  const { audioBlob, extractorType, extractorContext, formType } = voiceFormInput;

  if (!audioBlob) {
    throw new Error('No audio blob in voice form input');
  }

  // 1. Transcribe audio
  console.log(`[VoiceFormQueue] Transcribing audio for ${formType}...`);
  const transcription = await transcribeAudio(audioBlob);
  console.log(`[VoiceFormQueue] Transcription: ${transcription}`);

  // 2. Run extractor
  const extractedData = runExtractor(
    transcription,
    extractorType as ExtractorType,
    extractorContext as ExtractorContext
  );
  console.log(`[VoiceFormQueue] Extracted data:`, extractedData);

  // 3. Emit result to listening dialogs
  emitVoiceFormResult({
    formType: formType || extractorType,
    queueId: item.id,
    data: extractedData,
    transcription
  });

  return extractedData;
}
