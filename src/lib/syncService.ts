import { supabase } from '@/integrations/supabase/client';
import { 
  getAllPending, 
  updateStatus, 
  incrementRetries,
  setAwaitingConfirmation,
  type QueueItem 
} from './offlineQueue';
import { processVoiceQueue } from './voiceQueueProcessor';
import { sendSyncSuccessNotification, sendSyncFailureNotification } from './notificationService';
import { translateError } from './errorMessages';

/**
 * Maximum number of retry attempts for failed sync operations
 * 
 * After 3 failures, item is marked as permanently failed and requires manual intervention.
 */
const MAX_RETRIES = 3;

/**
 * Exponential backoff delays (milliseconds) for retry attempts
 * 
 * - 1st retry: 1 second delay
 * - 2nd retry: 2 seconds delay  
 * - 3rd retry: 4 seconds delay
 * 
 * Reduces server load and gives transient errors time to resolve.
 */
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

/**
 * Flag to prevent multiple simultaneous sync operations
 * 
 * Ensures only one sync process runs at a time to avoid race conditions
 * and duplicate processing of queue items.
 */
let isSyncing = false;

/**
 * Transcribe audio from a queue item using voice-to-text edge function
 * 
 * Converts audio blob to base64 and sends to Supabase function for transcription.
 * Sets item to 'awaiting_confirmation' status so user can review/correct transcription
 * before processing.
 * 
 * @param item - Queue item containing audio blob to transcribe
 * @returns Promise that resolves when transcription is saved
 * @throws Error with specific codes: AUDIO_MISSING, TRANSCRIPTION_FAILED, TRANSCRIPTION_EMPTY
 * 
 * @example
 * ```typescript
 * try {
 *   await transcribeItem(queueItem);
 *   // Item now has transcription and awaits user confirmation
 * } catch (error) {
 *   if (error.message === 'AUDIO_MISSING') {
 *     console.error('No audio found in queue item');
 *   }
 * }
 * ```
 */
async function transcribeItem(item: QueueItem): Promise<void> {
  const { audioBlob } = item.payload;
  
  if (!audioBlob) {
    throw new Error('AUDIO_MISSING');
  }

  // Convert blob to base64
  const base64Audio = await blobToBase64(audioBlob);
  
  // Call voice-to-text
  const { data: transcriptionData, error: transcriptionError } = await supabase.functions
    .invoke('voice-to-text', {
      body: { audio: base64Audio },
    });

  if (transcriptionError) {
    throw new Error(transcriptionError.message || 'TRANSCRIPTION_FAILED');
  }
  
  const transcribedText = transcriptionData?.text;
  if (!transcribedText) {
    throw new Error('TRANSCRIPTION_EMPTY');
  }

  // Save transcription and set to awaiting confirmation
  await setAwaitingConfirmation(item.id, transcribedText);
}

/**
 * Convert audio Blob to base64-encoded string
 * 
 * Used for sending audio data to edge functions via JSON payload.
 * Removes data URL prefix to get just the base64 data.
 * 
 * @param blob - Audio Blob object (typically audio/webm or audio/wav)
 * @returns Promise resolving to base64 string (without data URL prefix)
 * 
 * @example
 * ```typescript
 * const audioBlob = new Blob([audioData], { type: 'audio/webm' });
 * const base64 = await blobToBase64(audioBlob);
 * 
 * // Send to edge function
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
      const base64Data = base64.split(',')[1] || base64;
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Main sync function - processes all pending offline queue items
 * 
 * Orchestrates the complete offline-to-online sync workflow:
 * 1. Checks authentication and prevents concurrent syncs
 * 2. Retrieves all pending queue items
 * 3. For voice activities: transcribes if needed, waits for confirmation
 * 4. Processes each item (form submission or voice activity)
 * 5. Implements retry logic with exponential backoff
 * 6. Sends success/failure notifications
 * 
 * Called automatically when app goes online or manually via sync button.
 * Skips items awaiting user confirmation until they're confirmed.
 * 
 * @returns Promise that resolves when sync is complete (or skipped if already syncing)
 * 
 * @example
 * ```typescript
 * // Automatic sync when online
 * useEffect(() => {
 *   if (isOnline) {
 *     syncQueue();
 *   }
 * }, [isOnline]);
 * 
 * // Manual sync button
 * <Button onClick={syncQueue}>
 *   Sync Now
 * </Button>
 * ```
 */
export async function syncQueue(): Promise<void> {
  // Prevent multiple simultaneous syncs
  if (isSyncing) {
    console.log('[SyncQueue] Sync already in progress, skipping...');
    return;
  }

  // Check if user is authenticated
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.log('[SyncQueue] Not authenticated - skipping sync');
    return;
  }

  isSyncing = true;
  const startTime = new Date().toISOString();
  console.log(`[SyncQueue] Starting sync at ${startTime}`);

  try {
    const pending = await getAllPending();
    console.log(`[SyncQueue] Found ${pending.length} pending items to process`);
  
    if (pending.length === 0) {
      console.log('[SyncQueue] No pending items to sync');
      return;
    }

    console.log(`[SyncQueue] Syncing ${pending.length} pending items...`);

    for (const item of pending) {
      try {
        // Skip if awaiting confirmation or already has unconfirmed transcription
        if (item.type === 'voice_activity') {
          if (item.status === 'awaiting_confirmation' || 
              (item.payload.transcription && !item.payload.transcriptionConfirmed)) {
            console.log(`[SyncQueue] Item ${item.id} awaiting user confirmation, skipping...`);
            continue;
          }
          
          // If no transcription yet, transcribe first
          if (!item.payload.transcription) {
            console.log(`[SyncQueue] Transcribing item ${item.id}...`);
            await transcribeItem(item);
            continue; // Don't process yet, wait for confirmation
          }
        }
        
        await updateStatus(item.id, 'processing');
        
        if (item.type === 'animal_form') {
          await syncAnimalForm(item);
        } else if (item.type === 'voice_activity') {
          await processVoiceQueue(item);
        }
        
        await updateStatus(item.id, 'completed');
        
        // Send success notification
        const details = item.type === 'animal_form'
          ? `${item.payload.formData?.name || 'Animal'} (${item.payload.formData?.ear_tag})`
          : 'Activity logged';
        
        await sendSyncSuccessNotification(item.type, details);
        
      } catch (error: any) {
        console.error(`[SyncQueue] Failed to sync item ${item.id}:`, error);
        
        const retries = await incrementRetries(item.id);
        
        if (retries >= MAX_RETRIES) {
          await updateStatus(item.id, 'failed', translateError(error));
          await sendSyncFailureNotification(1, item.id);
        } else {
          // Retry with exponential backoff
          const delay = RETRY_DELAYS[retries - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
          await new Promise(resolve => setTimeout(resolve, delay));
          await updateStatus(item.id, 'pending');
        }
      }
    }
    
    const endTime = new Date().toISOString();
    console.log(`[SyncQueue] Sync completed at ${endTime}`);
  } finally {
    isSyncing = false;
  }
}

/**
 * Sync animal form data from offline queue to Supabase
 * 
 * Handles the complete flow for submitting animal forms that were created offline:
 * 1. Checks for duplicate ear tags
 * 2. Inserts animal record into database
 * 3. Creates associated AI record if animal was conceived via artificial insemination
 * 
 * @param item - Queue item containing animal form data and optional AI info
 * @returns Promise that resolves when animal is created
 * @throws Error if duplicate ear tag found or database insertion fails
 * 
 * @example
 * ```typescript
 * // Typically called by syncQueue(), but can be used standalone
 * const queueItem: QueueItem = {
 *   type: 'animal_form',
 *   payload: {
 *     formData: {
 *       name: 'New Calf',
 *       ear_tag: '123',
 *       farm_id: 'farm-abc',
 *       // ... other animal fields
 *     },
 *     aiInfo: {
 *       ai_bull_brand: 'Alta Genetics',
 *       ai_bull_reference: 'BG-42',
 *       ai_bull_breed: 'Holstein',
 *       birth_date: '2024-10-01'
 *     }
 *   },
 *   // ... other queue fields
 * };
 * 
 * await syncAnimalForm(queueItem);
 * ```
 */
async function syncAnimalForm(item: QueueItem): Promise<void> {
  const { formData } = item.payload;
  
  if (!formData) {
    throw new Error('No form data in queue item');
  }

  // Check for duplicate ear tag
  if (formData.ear_tag) {
    const { data: existing } = await supabase
      .from('animals')
      .select('id')
      .eq('farm_id', formData.farm_id)
      .eq('ear_tag', formData.ear_tag)
      .eq('is_deleted', false)
      .maybeSingle();
    
    if (existing) {
      throw new Error('duplicate ear tag');
    }
  }

  // Insert animal
  const { created_by: _createdBy, ...animalInsert } = formData;
  const { data, error } = await supabase
    .from('animals')
    .insert(animalInsert)
    .select()
    .single();

  if (error) throw error;

  // If AI was used, create AI record
  if (item.payload.aiInfo && data) {
    const aiRecord = {
      animal_id: data.id,
      performed_date: item.payload.aiInfo.birth_date,
      technician: `${item.payload.aiInfo.ai_bull_brand || ''} ${item.payload.aiInfo.ai_bull_reference || ''}`.trim() || 'Unknown',
      pregnancy_confirmed: true,
      confirmed_at: new Date().toISOString(),
      notes: `Bull Brand: ${item.payload.aiInfo.ai_bull_brand || 'N/A'}, Reference: ${item.payload.aiInfo.ai_bull_reference || 'N/A'}, Breed: ${item.payload.aiInfo.ai_bull_breed || 'N/A'}`,
    };

    const { error: aiError } = await supabase
      .from('ai_records')
      .insert(aiRecord);

    if (aiError) {
      console.error('Failed to create AI record:', aiError);
      // Don't fail the whole sync for AI record failure
    }
  }
}
