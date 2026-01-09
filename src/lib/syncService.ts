import { supabase } from '@/integrations/supabase/client';
import { 
  getAllPending, 
  updateStatus, 
  incrementRetries,
  setAwaitingConfirmation,
  updateItem,
  type QueueItem 
} from './offlineQueue';
import { processVoiceQueue } from './voiceQueueProcessor';
import { processVoiceFormInput } from './voiceFormQueueProcessor';
import { sendSyncSuccessNotification, sendSyncFailureNotification } from './notificationService';
import { translateError } from './errorMessages';
import { confirmOptimisticRecords, rollbackOptimisticRecords } from './dataCache';
import { generateClientId } from './syncCheckpoint';
import { startSyncSession, completeSyncSession, recordSyncError, type SyncType } from './syncTelemetry';

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
export async function syncQueue(syncType: SyncType = 'manual'): Promise<void> {
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
  const startTime = Date.now();
  console.log(`[SyncQueue] Starting sync at ${new Date(startTime).toISOString()}`);

  // Start telemetry session
  let sessionId: string | undefined;
  let succeeded = 0;
  let failed = 0;
  
  try {
    const pending = await getAllPending();
    console.log(`[SyncQueue] Found ${pending.length} pending items to process`);
  
    if (pending.length === 0) {
      console.log('[SyncQueue] No pending items to sync');
      return;
    }

    // Get farmId from first item for telemetry
    const farmId = pending[0]?.payload?.farmId;
    sessionId = await startSyncSession(farmId, syncType);

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
        } else if (item.type === 'bulk_milk') {
          await syncBulkMilk(item);
        } else if (item.type === 'single_milk') {
          await syncSingleMilk(item);
        } else if (item.type === 'bulk_feed') {
          await syncBulkFeed(item);
        } else if (item.type === 'bulk_health') {
          await syncBulkHealth(item);
        } else if (item.type === 'voice_form_input') {
          await processVoiceFormInput(item);
        }
        
        await updateStatus(item.id, 'completed');
        succeeded++;
        
        // Send success notification
        const details = item.type === 'animal_form'
          ? `${item.payload.formData?.name || 'Animal'} (${item.payload.formData?.ear_tag})`
          : 'Activity logged';
        
        await sendSyncSuccessNotification(item.type, details);
        
      } catch (error: any) {
        console.error(`[SyncQueue] Failed to sync item ${item.id}:`, error);
        failed++;
        
        if (sessionId) {
          await recordSyncError(sessionId, error);
        }
        
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
    
    const endTime = Date.now();
    console.log(`[SyncQueue] Sync completed at ${new Date(endTime).toISOString()}`);
    
    // Complete telemetry session
    if (sessionId) {
      await completeSyncSession(sessionId, {
        itemsProcessed: succeeded + failed,
        itemsSucceeded: succeeded,
        itemsFailed: failed,
        durationMs: endTime - startTime,
      });
    }
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

  // Insert animal with client_generated_id for deduplication
  const { created_by: _createdBy, ...animalInsert } = formData;
  const clientId = formData.client_generated_id || generateClientId();
  
  const { data, error } = await supabase
    .from('animals')
    .insert({ ...animalInsert, client_generated_id: clientId })
    .select()
    .single();

  if (error) {
    // Check if it's a duplicate client_id (already synced)
    if (error.code === '23505' && error.message?.includes('client_generated_id')) {
      console.log('[SyncQueue] Animal already synced (duplicate client_id), skipping...');
      return;
    }
    throw error;
  }

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

  // Create initial weight record if provided
  if (item.payload.initialWeight && data) {
    const weightRecord = {
      animal_id: data.id,
      weight_kg: item.payload.initialWeight.weight_kg,
      measurement_date: item.payload.initialWeight.measurement_date,
      measurement_method: item.payload.initialWeight.type === 'entry' ? 'entry_weight' : 'birth_weight',
      notes: item.payload.initialWeight.type === 'entry' 
        ? 'Initial weight at farm entry' 
        : 'Birth weight',
    };

    const { error: weightError } = await supabase
      .from('weight_records')
      .insert(weightRecord);

    if (weightError) {
      console.error('Failed to create weight record:', weightError);
      // Don't fail the whole sync for weight record failure
    }
  }
}

/**
 * Sync bulk milk records from offline queue to Supabase
 */
async function syncBulkMilk(item: QueueItem): Promise<void> {
  const { milkRecords, farmId } = item.payload;
  
  if (!milkRecords || milkRecords.length === 0 || !farmId) {
    throw new Error('No milk records in queue item');
  }

  const { data: { user } } = await supabase.auth.getUser();

  const records = milkRecords.map((record, index) => ({
    animal_id: record.animalId,
    record_date: record.recordDate,
    liters: record.liters,
    session: record.session,
    created_by: user?.id,
    is_sold: false,
    client_generated_id: `${item.optimisticId}_milk_${index}`,
  }));

  const { data: insertedRecords, error } = await supabase
    .from('milking_records')
    .insert(records)
    .select();

  if (error) {
    // Check if it's a duplicate (already synced)
    if (error.code === '23505' && error.message?.includes('client_generated_id')) {
      console.log('[SyncQueue] Milk records already synced, skipping...');
      return;
    }
    throw error;
  }

  // Confirm optimistic records with server data
  if (item.optimisticId && insertedRecords) {
    await confirmOptimisticRecords(item.optimisticId, insertedRecords);
    await updateItem(item.id, { serverResponse: insertedRecords });
    
    // Reconcile milk inventory cache with server data
    // The database trigger has already created milk_inventory rows
    if (farmId) {
      try {
        const { getCachedMilkInventory } = await import('./dataCache');
        const cached = await getCachedMilkInventory(farmId);
        
        if (cached) {
          // Update optimistic items with real server IDs
          const updatedItems = cached.items.map(cacheItem => {
            // Check if this optimistic item matches any inserted record by client_generated_id
            const matchedServer = insertedRecords.find((r: any) => 
              cacheItem.milking_record_id === r.client_generated_id
            );
            
            if (matchedServer) {
              return {
                ...cacheItem,
                id: matchedServer.id,
                milking_record_id: matchedServer.id,
                syncStatus: 'synced' as const,
              };
            }
            return cacheItem;
          });
          
          // Remove duplicates and update cache
          const uniqueItems = updatedItems.filter((item, index, self) => 
            index === self.findIndex(i => i.id === item.id)
          );
          
          const { updateMilkInventoryCache, recalculateMilkInventorySummary } = await import('./dataCache');
          const newSummary = recalculateMilkInventorySummary(uniqueItems);
          await updateMilkInventoryCache(farmId, uniqueItems, newSummary);
          
          console.log('[SyncService] Milk inventory cache reconciled after sync');
        }
      } catch (cacheError) {
        console.error('[SyncService] Failed to reconcile milk inventory cache:', cacheError);
        // Don't fail the sync for cache reconciliation errors
      }
    }
  }
}

/**
 * Sync single milk record from offline queue to Supabase (from animal profile)
 */
async function syncSingleMilk(item: QueueItem): Promise<void> {
  const { singleMilk, farmId } = item.payload;
  
  if (!singleMilk || !farmId) {
    throw new Error('No single milk data in queue item');
  }

  const { data: { user } } = await supabase.auth.getUser();
  const clientId = `${item.optimisticId}_milk_0`;

  const { data: insertedRecord, error } = await supabase
    .from('milking_records')
    .insert({
      animal_id: singleMilk.animalId,
      record_date: singleMilk.recordDate,
      liters: singleMilk.liters,
      session: singleMilk.session,
      created_by: user?.id,
      is_sold: false,
      client_generated_id: clientId,
    })
    .select()
    .single();

  if (error) {
    // Check if it's a duplicate (already synced)
    if (error.code === '23505' && error.message?.includes('client_generated_id')) {
      console.log('[SyncQueue] Single milk record already synced, skipping...');
      return;
    }
    throw error;
  }

  // Confirm optimistic records and reconcile cache
  if (item.optimisticId && insertedRecord) {
    await confirmOptimisticRecords(item.optimisticId, [insertedRecord]);
    await updateItem(item.id, { serverResponse: insertedRecord });
    
    // Reconcile milk inventory cache
    try {
      const { getCachedMilkInventory } = await import('./dataCache');
      const cached = await getCachedMilkInventory(farmId);
      
      if (cached) {
        const updatedItems = cached.items.map(cacheItem => {
          if (cacheItem.milking_record_id === clientId) {
            return {
              ...cacheItem,
              id: insertedRecord.id,
              milking_record_id: insertedRecord.id,
              syncStatus: 'synced' as const,
            };
          }
          return cacheItem;
        });
        
        const uniqueItems = updatedItems.filter((item, index, self) => 
          index === self.findIndex(i => i.id === item.id)
        );
        
        const { updateMilkInventoryCache, recalculateMilkInventorySummary } = await import('./dataCache');
        const newSummary = recalculateMilkInventorySummary(uniqueItems);
        await updateMilkInventoryCache(farmId, uniqueItems, newSummary);
        
        console.log('[SyncService] Single milk inventory cache reconciled after sync');
      }
    } catch (cacheError) {
      console.error('[SyncService] Failed to reconcile single milk inventory cache:', cacheError);
    }
  }
}

/**
 * Sync bulk feed records from offline queue to Supabase
 */
async function syncBulkFeed(item: QueueItem): Promise<void> {
  const { feedRecords, feedType, feedInventoryId, totalKg, recordDate, farmId } = item.payload;
  
  if (!feedRecords || feedRecords.length === 0 || !farmId || !feedType) {
    throw new Error('No feed records in queue item');
  }

  const { data: { user } } = await supabase.auth.getUser();
  const dateTime = recordDate || new Date().toISOString();

  // Create feeding records
  const records = feedRecords.map((record, index) => ({
    animal_id: record.animalId,
    record_datetime: dateTime,
    kilograms: record.kilograms,
    feed_type: feedType,
    created_by: user?.id,
    client_generated_id: `${item.optimisticId}_feed_${index}`,
  }));

  const { data: insertedRecords, error: insertError } = await supabase
    .from('feeding_records')
    .insert(records)
    .select();
    
  if (insertError) {
    // Check if it's a duplicate (already synced)
    if (insertError.code === '23505' && insertError.message?.includes('client_generated_id')) {
      console.log('[SyncQueue] Feed records already synced, skipping...');
      return;
    }
    throw insertError;
  }

  // Confirm optimistic records with server data
  if (item.optimisticId && insertedRecords) {
    await confirmOptimisticRecords(item.optimisticId, insertedRecords);
    await updateItem(item.id, { serverResponse: insertedRecords });
  }

  // Update inventory if applicable
  if (feedInventoryId && totalKg) {
    const { data: currentInventory } = await supabase
      .from('feed_inventory')
      .select('quantity_kg')
      .eq('id', feedInventoryId)
      .single();

    if (currentInventory) {
      const newQuantity = Math.max(0, currentInventory.quantity_kg - totalKg);
      
      await supabase
        .from('feed_inventory')
        .update({ quantity_kg: newQuantity, last_updated: new Date().toISOString() })
        .eq('id', feedInventoryId);

      // Create transaction record
      await supabase.from('feed_stock_transactions').insert({
        feed_inventory_id: feedInventoryId,
        transaction_type: 'consumption',
        quantity_change_kg: -totalKg,
        balance_after: newQuantity,
        notes: `Offline sync: Bulk feeding ${feedRecords.length} animals`,
        created_by: user?.id,
      });
    }
  }

  // Create expense records if costs are provided
  const expenseRecords = feedRecords
    .filter(record => record.cost && record.cost > 0)
    .map((record) => ({
      animal_id: record.animalId,
      farm_id: farmId,
      user_id: user?.id,
      category: 'Feed & Supplements',
      amount: record.cost!,
      description: `${feedType} feeding: ${record.kilograms.toFixed(2)} kg`,
      expense_date: recordDate?.split('T')[0] || new Date().toISOString().split('T')[0],
      allocation_type: 'Operational',
      linked_feed_inventory_id: feedInventoryId || null,
    }));

  if (expenseRecords.length > 0 && user?.id) {
    await supabase.from('farm_expenses').insert(expenseRecords);
  }
}

/**
 * Sync bulk health records from offline queue to Supabase
 */
async function syncBulkHealth(item: QueueItem): Promise<void> {
  const { healthRecords, diagnosis, treatment, notes, recordDate, farmId } = item.payload;
  
  if (!healthRecords || healthRecords.length === 0 || !diagnosis || !farmId) {
    throw new Error('No health records in queue item');
  }

  const { data: { user } } = await supabase.auth.getUser();
  const dateStr = recordDate?.split('T')[0] || new Date().toISOString().split('T')[0];

  const records = healthRecords.map((record, index) => ({
    animal_id: record.animalId,
    visit_date: dateStr,
    diagnosis: diagnosis,
    treatment: treatment || null,
    notes: notes || null,
    created_by: user?.id,
    client_generated_id: `${item.optimisticId}_health_${index}`,
  }));

  const { data: insertedRecords, error } = await supabase
    .from('health_records')
    .insert(records)
    .select();

  if (error) {
    // Check if it's a duplicate (already synced)
    if (error.code === '23505' && error.message?.includes('client_generated_id')) {
      console.log('[SyncQueue] Health records already synced, skipping...');
      return;
    }
    throw error;
  }

  // Confirm optimistic records with server data
  if (item.optimisticId && insertedRecords) {
    await confirmOptimisticRecords(item.optimisticId, insertedRecords);
    await updateItem(item.id, { serverResponse: insertedRecords });
  }
}
