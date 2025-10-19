import { supabase } from '@/integrations/supabase/client';
import { 
  getAllPending, 
  updateStatus, 
  incrementRetries,
  type QueueItem 
} from './offlineQueue';
import { processVoiceQueue } from './voiceQueueProcessor';
import { sendSyncSuccessNotification, sendSyncFailureNotification } from './notificationService';
import { translateError } from './errorMessages';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

export async function syncQueue(): Promise<void> {
  const pending = await getAllPending();
  
  if (pending.length === 0) {
    console.log('No pending items to sync');
    return;
  }

  console.log(`Syncing ${pending.length} pending items...`);

  for (const item of pending) {
    try {
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
      console.error(`Failed to sync item ${item.id}:`, error);
      
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
  
  console.log('Sync completed');
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
  const { data, error } = await supabase
    .from('animals')
    .insert(formData)
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
      created_by: formData.created_by,
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
