import { supabase } from '@/integrations/supabase/client';
import type { QueueItem } from './offlineQueue';

/**
 * Process voice activity queue items by transcribing and logging farm activities
 * 
 * Handles the complete voice-to-activity workflow:
 * 1. Uses confirmed transcription or transcribes audio
 * 2. Detects and skips Doc Aga queries (handled separately)
 * 3. Invokes process-farmhand-activity edge function with animal context
 * 4. Handles structured errors (inventory, animal selection needs)
 * 
 * @param item - Queue item containing voice recording and context
 * @throws Error codes: AUDIO_MISSING, FARM_ID_MISSING, TRANSCRIPTION_FAILED, NEEDS_ANIMAL_SELECTION
 */
export async function processVoiceQueue(item: QueueItem): Promise<void> {
  const { audioBlob, farmId, animalId, transcription, transcriptionConfirmed } = item.payload;
  
  if (!farmId) {
    throw new Error('FARM_ID_MISSING');
  }

  let transcribedText: string;

  // Use confirmed transcription if available
  if (transcription && transcriptionConfirmed) {
    transcribedText = transcription;
    console.log('VoiceQueue: Using confirmed transcription');
  } else {
    // Fallback: transcribe audio (shouldn't happen if sync flow is correct)
    if (!audioBlob) {
      throw new Error('AUDIO_MISSING');
    }
    
    const base64Audio = await blobToBase64(audioBlob);
    console.log('VoiceQueue: base64 audio length:', base64Audio?.length || 0);
    
    const { data: transcriptionData, error: transcriptionError } = await supabase.functions
      .invoke('voice-to-text', {
        body: { audio: base64Audio },
      });

    if (transcriptionError) {
      console.error('VoiceQueue: transcriptionError', transcriptionError);
      throw new Error(transcriptionError.message || 'TRANSCRIPTION_FAILED');
    }
    
    transcribedText = transcriptionData?.text;
    console.log('VoiceQueue: transcribedText:', transcribedText);
    if (!transcribedText) {
      throw new Error('TRANSCRIPTION_EMPTY');
    }
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
  // Try to use stored context first, fallback to lookup
  let animalContext = item.payload.animalContext; // Use stored context
  if (!animalContext && animalId) {
    console.log('No stored context, attempting lookup...');
    animalContext = await getAnimalContext(animalId);
  }
  
  console.log('Invoking process-farmhand-activity with:', {
    hasTranscription: !!transcribedText,
    farmId,
    animalId: animalId || null,
    hasAnimalContext: !!animalContext,
    animalName: animalContext?.name || 'unknown',
    animalEarTag: animalContext?.ear_tag || 'unknown'
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
    // Handle structured errors
    if (activityData.error === 'FEED_TYPE_NOT_IN_INVENTORY') {
      throw new Error(`INVENTORY_REQUIRED:${activityData.feed_type}`);
    }
    throw new Error(activityData.message || activityData.error);
  }

  // Check if activity needs animal selection
  const requiresAnimal = ['weight_measurement', 'milking', 'health_observation', 'injection'].includes(activityData.activity_type);
  if (requiresAnimal && !activityData.animal_id && activityData.needs_animal_selection) {
    // This will be handled by QueueStatus component - user needs to select animal
    console.log('Voice activity needs animal selection - will be shown in queue for user selection');
    throw new Error('NEEDS_ANIMAL_SELECTION');
  }

  // Successfully processed - extracted data is in activityData
  console.log('Voice activity processed:', activityData);
}

/**
 * Fetch animal context data from database for voice activity processing
 * 
 * Retrieves essential animal information (name, ear tag, breed, etc.) needed
 * to provide context when processing voice recordings. Used as fallback when
 * animal context wasn't stored with the queue item.
 * 
 * @param animalId - UUID of the animal to look up
 * @returns Promise resolving to animal context object or null if not found/error
 * 
 * @example
 * ```typescript
 * const context = await getAnimalContext('animal-uuid-123');
 * if (context) {
 *   console.log(`Processing activity for ${context.name} (#${context.ear_tag})`);
 * }
 * ```
 */
async function getAnimalContext(animalId: string): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('animals')
      .select('name, ear_tag, gender, breed, birth_date, life_stage')
      .eq('id', animalId)
      .single();

    if (error) {
      console.error('Failed to get animal context:', error);
      throw new Error(`Animal lookup failed: ${error.message}`);
    }

    if (!data) {
      throw new Error(`Animal not found: ${animalId}`);
    }

    return data;
  } catch (error) {
    console.error('Error in getAnimalContext:', error);
    // Don't throw - return null and let edge function handle lookup
    return null;
  }
}

/**
 * Convert audio Blob to base64-encoded string for API transmission
 * 
 * Encodes audio data as base64 to send via JSON payload to edge functions.
 * Strips the data URL prefix (e.g., "data:audio/webm;base64,") to return
 * only the base64 content.
 * 
 * @param blob - Audio Blob object (typically audio/webm or audio/wav format)
 * @returns Promise resolving to base64 string without data URL prefix
 * 
 * @example
 * ```typescript
 * const audioBlob = new Blob([audioData], { type: 'audio/webm' });
 * const base64 = await blobToBase64(audioBlob);
 * 
 * // Send to voice-to-text function
 * await supabase.functions.invoke('voice-to-text', {
 *   body: { audio: base64 }
 * });
 * ```
 */
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
