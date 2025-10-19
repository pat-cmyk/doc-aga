import { supabase } from '@/integrations/supabase/client';
import type { QueueItem } from './offlineQueue';

export async function processVoiceQueue(item: QueueItem): Promise<void> {
  const { audioBlob, farmId, animalId, timestamp } = item.payload;
  
  if (!audioBlob || !farmId) {
    throw new Error('Missing audio data or farm ID');
  }

  // Convert blob to base64
  const base64Audio = await blobToBase64(audioBlob);
  
  // Step 1: Transcribe audio
  const { data: transcriptionData, error: transcriptionError } = await supabase.functions
    .invoke('voice-to-text', {
      body: { audio: base64Audio },
    });

  if (transcriptionError) throw transcriptionError;
  
  const transcribedText = transcriptionData?.text;
  if (!transcribedText) {
    throw new Error('No transcription result');
  }

  // Check if it's a Doc Aga query (should not be in farmhand activities)
  const isDocAgaQuery = transcribedText.toLowerCase().includes('dok aga') || 
                        transcribedText.toLowerCase().includes('doc aga');
  
  if (isDocAgaQuery) {
    // Skip processing for Doc Aga queries in farmhand context
    console.log('Doc Aga query detected, skipping farmhand processing');
    return;
  }

  // Step 2: Process farmhand activity
  const animalContext = animalId ? await getAnimalContext(animalId) : null;
  
  console.log('Invoking process-farmhand-activity with:', {
    hasTranscription: !!transcribedText,
    farmId,
    animalId: animalId || null,
    hasAnimalContext: !!animalContext
  });
  
  const { data: activityData, error: activityError } = await supabase.functions
    .invoke('process-farmhand-activity', {
      body: {
        transcription: transcribedText,
        farmId,
        animalId: animalId || null,
        animalContext,
      },
    });

  if (activityError) throw activityError;

  if (activityData?.error) {
    throw new Error(activityData.message || activityData.error);
  }

  // Successfully processed - extracted data is in activityData
  console.log('Voice activity processed:', activityData);
}

async function getAnimalContext(animalId: string): Promise<any> {
  const { data, error } = await supabase
    .from('animals')
    .select('name, ear_tag, gender, breed, birth_date, life_stage')
    .eq('id', animalId)
    .single();

  if (error) {
    console.error('Failed to get animal context:', error);
    return null;
  }

  return data;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove data URL prefix (e.g., "data:audio/webm;base64,")
      const base64Data = base64.split(',')[1] || base64;
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
