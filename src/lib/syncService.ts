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

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

// Flag to prevent multiple simultaneous syncs
let isSyncing = false;

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
