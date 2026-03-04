import { supabase } from '@/integrations/supabase/client';
import {
  getAllPending,
  updateStatus,
  incrementRetries,
  setAwaitingConfirmation,
  updateItem,
  cleanupExpiredItems,
  type QueueItem
} from './offlineQueue';
import { processVoiceQueue } from './voiceQueueProcessor';
import { processVoiceFormInput } from './voiceFormQueueProcessor';
import { sendSyncSuccessNotification, sendSyncFailureNotification } from './notificationService';
import { translateError } from './errorMessages';
import { confirmOptimisticRecords, rollbackOptimisticRecords, rollbackMilkInventoryDeduction } from './dataCache';
import { REVENUE_SOURCE_KEYS } from './revenueCategories';
import { insertBreedingEvent } from './breedingEventBridge';
import { generateClientId, updateSyncCheckpoint } from './syncCheckpoint';
import { invokeWithTimeout } from './sttService';
import { startSyncSession, completeSyncSession, recordSyncError, type SyncType } from './syncTelemetry';
import { detectConflict, recordConflict } from './conflictDetection';

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
 * Check if a conflict exists for an UPDATE operation and handle it
 * 
 * For INSERT-only operations this is a no-op. When edit operations are added
 * to the offline queue, this framework activates automatically.
 * 
 * @returns true if a conflict was detected (caller should skip the write), false otherwise
 */
async function checkAndHandleConflict(
  item: QueueItem,
  tableName: string,
  recordId: string,
  clientData: Record<string, any>,
  farmId: string
): Promise<boolean> {
  const clientTimestamp = item.clientTimestamp || new Date(item.createdAt).toISOString();

  const conflictInfo = await detectConflict(tableName, recordId, clientTimestamp, clientData);

  if (!conflictInfo.hasConflict) return false;

  // Error case: conflict check RPC failed (serverData is null).
  // Skip the write and let retry logic handle it on next sync cycle.
  if (!conflictInfo.serverData) {
    console.warn(`[SyncService] Conflict check failed for ${tableName}/${recordId}, will retry`);
    return true;
  }

  console.warn(`[SyncService] Conflict detected for ${tableName}/${recordId}`);

  // Record conflict for UI resolution
  await recordConflict(
    farmId,
    tableName,
    recordId,
    clientData,
    conflictInfo.serverData
  );

  // Mark queue item as conflict
  await updateItem(item.id, {
    status: 'conflict' as QueueItem['status'],
    conflictData: conflictInfo.serverData,
  });

  return true;
}

/**
 * Validate that referenced parent records still exist on the server.
 * Prevents orphan mutations when a parent record (e.g., animal) was
 * deleted on another device while this device was offline.
 * 
 * @param animalIds - Array of animal IDs to check
 * @returns Set of animal IDs that no longer exist
 */
async function validateAnimalsExist(animalIds: string[]): Promise<Set<string>> {
  if (animalIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from('animals')
    .select('id')
    .in('id', animalIds)
    .eq('is_deleted', false);

  if (error) {
    console.error('[SyncService] Failed to validate animal existence:', error);
    return new Set(); // On error, allow writes (fail-open)
  }

  const existingIds = new Set((data ?? []).map(r => r.id));
  return new Set(animalIds.filter(id => !existingIds.has(id)));
}

/**
 * Check for stale sync queue items on other devices
 * 
 * Called once after login to warn the user if another device
 * has unsynced items that may be lost.
 */
export async function checkForStaleQueueOnOtherDevices(): Promise<{
  hasStaleItems: boolean;
  count: number;
  oldestTimestamp: string | null;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { hasStaleItems: false, count: 0, oldestTimestamp: null };

    const clientId = generateClientId();

    const { data, error } = await supabase.rpc('check_stale_sync_items', {
      p_user_id: user.id,
      p_client_id: clientId,
    });

    if (error) {
      console.error('[SyncService] Failed to check stale items:', error);
      return { hasStaleItems: false, count: 0, oldestTimestamp: null };
    }

    const result = data as { count?: number; oldest_timestamp?: string } | null;
    const count = result?.count ?? 0;

    return {
      hasStaleItems: count > 0,
      count,
      oldestTimestamp: result?.oldest_timestamp ?? null,
    };
  } catch (err) {
    console.error('[SyncService] Stale check error:', err);
    return { hasStaleItems: false, count: 0, oldestTimestamp: null };
  }
}

/**
 * Extract all animal IDs referenced by a queue item
 */
function extractAnimalIds(item: QueueItem): string[] {
  const ids: string[] = [];
  const p = item.payload;
  
  if (p.animalId) ids.push(p.animalId);
  if (p.singleMilk?.animalId) ids.push(p.singleMilk.animalId);
  if (p.singleFeed?.animalId) ids.push(p.singleFeed.animalId);
  if (p.singleHealth?.animalId) ids.push(p.singleHealth.animalId);
  if (p.singleWeight?.animalId) ids.push(p.singleWeight.animalId);
  if (p.aiRecord?.animalId) ids.push(p.aiRecord.animalId);
  if (p.pregnancyConfirm?.animalId) ids.push(p.pregnancyConfirm.animalId);
  if (p.milkRecords) ids.push(...p.milkRecords.map(r => r.animalId));
  if (p.feedRecords) ids.push(...p.feedRecords.map(r => r.animalId));
  if (p.healthRecords) ids.push(...p.healthRecords.map(r => r.animalId));
  if (p.bcsRecords) ids.push(...p.bcsRecords.map(r => r.animalId));
  
  return [...new Set(ids)];
}

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
  
  // Call voice-to-text (with 30s timeout)
  const { data: transcriptionData, error: transcriptionError } = await invokeWithTimeout('voice-to-text', {
    audio: base64Audio,
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

    // Batch orphan check: collect all animal IDs across pending items
    const allAnimalIds = pending.flatMap(extractAnimalIds);
    const deletedAnimalIds = await validateAnimalsExist(allAnimalIds);
    if (deletedAnimalIds.size > 0) {
      console.warn(`[SyncService] Found ${deletedAnimalIds.size} deleted animals referenced by queue items`);
    }

    console.log(`[SyncQueue] Syncing ${pending.length} pending items...`);

    for (const item of pending) {
      try {
        // Skip conflict items (handled via SyncConflictResolution UI)
        if (item.status === 'conflict') {
          console.log(`[SyncQueue] Item ${item.id} has conflict, skipping (resolve in UI)...`);
          continue;
        }

        // Orphan check: fail items referencing deleted animals
        const itemAnimalIds = extractAnimalIds(item);
        const orphanedIds = itemAnimalIds.filter(id => deletedAnimalIds.has(id));
        if (orphanedIds.length > 0) {
          const msg = `PARENT_DELETED: Animal(s) ${orphanedIds.join(', ')} were deleted on another device`;
          console.error(`[SyncService] ${msg}`);
          await updateStatus(item.id, 'failed', msg);
          failed++;
          continue;
        }

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
        } else if (item.type === 'single_feed') {
          await syncSingleFeed(item);
        } else if (item.type === 'bulk_health') {
          await syncBulkHealth(item);
        } else if (item.type === 'single_health') {
          await syncSingleHealth(item);
        } else if (item.type === 'single_weight') {
          await syncSingleWeight(item);
        } else if (item.type === 'voice_form_input') {
          await processVoiceFormInput(item);
        } else if (item.type === 'bulk_bcs') {
          await syncBulkBCS(item);
        } else if (item.type === 'ai_record') {
          await syncAIRecord(item);
        } else if (item.type === 'pregnancy_confirm') {
          await syncPregnancyConfirm(item);
        } else if (item.type === 'barn_create') {
          await syncBarnCreate(item);
        } else if (item.type === 'barn_update') {
          await syncBarnUpdate(item);
        } else if (item.type === 'barn_assign') {
          await syncBarnAssign(item);
        } else if (item.type === 'barn_remove') {
          await syncBarnRemove(item);
        } else if (item.type === 'milk_feeding') {
          await syncMilkFeeding(item);
        } else if (item.type === 'milk_sale') {
          await syncMilkSale(item);
        } else if (item.type === 'breeding_event') {
          await syncBreedingEvent(item);
        }
        
        // After parent record syncs, process any linked photos
        if (item.payload.pendingPhotoIds && item.payload.pendingPhotoIds.length > 0) {
          await syncPendingPhotos(item);
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
          // Rollback optimistic records from data cache to remove ghost entries
          if (item.optimisticId) {
            await rollbackOptimisticRecords(item.optimisticId);
          }
          // Rollback milk inventory deductions on permanent failure
          if (item.type === 'milk_feeding' && item.payload.milkFeeding?.deductions && item.payload.farmId) {
            await rollbackMilkInventoryDeduction(item.payload.farmId, item.payload.milkFeeding.deductions);
          }
          if (item.type === 'milk_sale' && item.payload.milkSale?.deductions && item.payload.farmId) {
            await rollbackMilkInventoryDeduction(item.payload.farmId, item.payload.milkSale.deductions);
          }
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
    // Record sync checkpoint if items were successfully synced
    if (farmId && succeeded > 0) {
      try {
        await updateSyncCheckpoint(farmId, 'offline_queue', new Date().toISOString(), succeeded);
      } catch (cpErr) {
        console.warn('[SyncQueue] Failed to update sync checkpoint:', cpErr);
      }
    }

    // Clean up old completed/failed items (72h TTL)
    try {
      await cleanupExpiredItems();
    } catch (cleanupErr) {
      console.warn('[SyncQueue] Queue cleanup error:', cleanupErr);
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
    milk_quality: record.milkQuality || 'good',
    milk_quality_rejection_reason: record.rejectionReason || null,
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
      milk_quality: singleMilk.milkQuality || 'good',
      milk_quality_rejection_reason: singleMilk.rejectionReason || null,
    } as any)
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

  // NOTE: Per-animal feed costs are tracked in feeding_records.cost_per_kg_at_time (SSOT).
  // farm_expenses is only for actual cash purchases, NOT per-animal feeding allocations.
}

/**
 * Sync single feed record from offline queue to Supabase (from animal profile)
 */
async function syncSingleFeed(item: QueueItem): Promise<void> {
  const { singleFeed, farmId } = item.payload;
  
  if (!singleFeed || !farmId) {
    throw new Error('No single feed data in queue item');
  }

  const { data: { user } } = await supabase.auth.getUser();
  const clientId = `${item.optimisticId}_feed_0`;

  const { data: insertedRecord, error } = await supabase
    .from('feeding_records')
    .insert({
      animal_id: singleFeed.animalId,
      record_datetime: singleFeed.recordDate,
      kilograms: singleFeed.kilograms,
      feed_type: singleFeed.feedType,
      notes: singleFeed.notes || null,
      created_by: user?.id,
      client_generated_id: clientId,
    })
    .select()
    .single();

  if (error) {
    // Check if it's a duplicate (already synced)
    if (error.code === '23505' && error.message?.includes('client_generated_id')) {
      console.log('[SyncQueue] Single feed record already synced, skipping...');
      return;
    }
    throw error;
  }

  // Confirm optimistic records
  if (item.optimisticId && insertedRecord) {
    await confirmOptimisticRecords(item.optimisticId, [insertedRecord]);
    await updateItem(item.id, { serverResponse: insertedRecord });
  }

  // Update inventory if applicable
  if (singleFeed.feedInventoryId) {
    const { data: currentInventory } = await supabase
      .from('feed_inventory')
      .select('quantity_kg')
      .eq('id', singleFeed.feedInventoryId)
      .single();

    if (currentInventory) {
      const newQuantity = Math.max(0, currentInventory.quantity_kg - singleFeed.kilograms);

      await supabase
        .from('feed_inventory')
        .update({ quantity_kg: newQuantity, last_updated: new Date().toISOString() })
        .eq('id', singleFeed.feedInventoryId);

      // Create transaction record
      await supabase.from('feed_stock_transactions').insert({
        feed_inventory_id: singleFeed.feedInventoryId,
        transaction_type: 'consumption',
        quantity_change_kg: -singleFeed.kilograms,
        balance_after: newQuantity,
        notes: `Offline sync: Single feeding ${singleFeed.animalName || 'Animal'}`,
        created_by: user?.id,
      });
    }
  }

  // NOTE: Per-animal feed costs are tracked in feeding_records.cost_per_kg_at_time (SSOT).
  // farm_expenses is only for actual cash purchases, NOT per-animal feeding allocations.
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

/**
 * Sync single health record from offline queue to Supabase (from animal profile)
 */
async function syncSingleHealth(item: QueueItem): Promise<void> {
  const { singleHealth, farmId } = item.payload;
  
  if (!singleHealth || !farmId) {
    throw new Error('No single health data in queue item');
  }

  const { data: { user } } = await supabase.auth.getUser();
  const clientId = `${item.optimisticId}_health_0`;

  const { data: insertedRecord, error } = await supabase
    .from('health_records')
    .insert({
      animal_id: singleHealth.animalId,
      visit_date: singleHealth.visitDate,
      diagnosis: singleHealth.diagnosis,
      treatment: singleHealth.treatment || null,
      notes: singleHealth.notes || null,
      created_by: user?.id,
      client_generated_id: clientId,
    })
    .select()
    .single();

  if (error) {
    // Check if it's a duplicate (already synced)
    if (error.code === '23505' && error.message?.includes('client_generated_id')) {
      console.log('[SyncQueue] Single health record already synced, skipping...');
      return;
    }
    throw error;
  }

  // Confirm optimistic records
  if (item.optimisticId && insertedRecord) {
    await confirmOptimisticRecords(item.optimisticId, [insertedRecord]);
    await updateItem(item.id, { serverResponse: insertedRecord });
  }
}

/**
 * Sync single weight record from offline queue to Supabase (from animal profile)
 */
async function syncSingleWeight(item: QueueItem): Promise<void> {
  const { singleWeight, farmId } = item.payload;
  
  if (!singleWeight || !farmId) {
    throw new Error('No single weight data in queue item');
  }

  const { data: { user } } = await supabase.auth.getUser();
  const clientId = `${item.optimisticId}_weight_0`;

  const { data: insertedRecord, error } = await supabase
    .from('weight_records')
    .insert({
      animal_id: singleWeight.animalId,
      weight_kg: singleWeight.weightKg,
      measurement_date: singleWeight.measurementDate,
      measurement_method: singleWeight.measurementMethod,
      notes: singleWeight.notes || null,
      recorded_by: user?.id,
      client_generated_id: clientId,
    })
    .select()
    .single();

  if (error) {
    // Check if it's a duplicate (already synced)
    if (error.code === '23505' && error.message?.includes('client_generated_id')) {
      console.log('[SyncQueue] Single weight record already synced, skipping...');
      return;
    }
    throw error;
  }

  // Confirm optimistic records
  if (item.optimisticId && insertedRecord) {
    await confirmOptimisticRecords(item.optimisticId, [insertedRecord]);
    await updateItem(item.id, { serverResponse: insertedRecord });
  }
}

/**
 * Sync bulk BCS records from offline queue to Supabase
 */
async function syncBulkBCS(item: QueueItem): Promise<void> {
  const { bcsRecords, farmId } = item.payload;
  
  if (!bcsRecords || bcsRecords.length === 0 || !farmId) {
    throw new Error('No BCS records in queue item');
  }

  const { data: { user } } = await supabase.auth.getUser();

  const records = bcsRecords.map((record, index) => ({
    animal_id: record.animalId,
    farm_id: farmId,
    score: record.score,
    assessment_date: record.assessmentDate,
    assessor_id: user?.id,
    notes: record.notes || null,
    client_generated_id: `${item.optimisticId}_bcs_${index}`,
  }));

  const { data: insertedRecords, error } = await supabase
    .from('body_condition_scores')
    .insert(records)
    .select();

  if (error) {
    // Check if it's a duplicate (already synced)
    if (error.code === '23505' && error.message?.includes('client_generated_id')) {
      console.log('[SyncQueue] BCS records already synced, skipping...');
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

/**
 * Sync AI record from offline queue to Supabase
 */
async function syncAIRecord(item: QueueItem): Promise<void> {
  const { aiRecord, farmId } = item.payload;
  
  if (!aiRecord || !farmId) {
    throw new Error('No AI record data in queue item');
  }

  const { data: { user } } = await supabase.auth.getUser();
  const clientId = `${item.optimisticId}_ai_0`;

  const { data: insertedRecord, error } = await supabase
    .from('ai_records')
    .insert({
      animal_id: aiRecord.animalId,
      performed_date: aiRecord.performedDate,
      scheduled_date: aiRecord.scheduledDate || null,
      semen_code: aiRecord.semenCode || null,
      technician: aiRecord.technician || null,
      notes: aiRecord.notes || null,
      created_by: user?.id,
      client_generated_id: clientId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505' && error.message?.includes('client_generated_id')) {
      console.log('[SyncQueue] AI record already synced, skipping...');
      return;
    }
    throw error;
  }

  if (item.optimisticId && insertedRecord) {
    await confirmOptimisticRecords(item.optimisticId, [insertedRecord]);
    await updateItem(item.id, { serverResponse: insertedRecord });
  }
}

/**
 * Sync pregnancy confirmation from offline queue to Supabase
 */
async function syncPregnancyConfirm(item: QueueItem): Promise<void> {
  const { pregnancyConfirm, farmId } = item.payload;
  
  if (!pregnancyConfirm || !farmId) {
    throw new Error('No pregnancy confirmation data in queue item');
  }

  // Update the ai_record
  const { error: updateError } = await supabase
    .from('ai_records')
    .update({
      pregnancy_confirmed: true,
      expected_delivery_date: pregnancyConfirm.expectedDeliveryDate,
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', pregnancyConfirm.recordId);

  if (updateError) throw updateError;

  // Bridge to breeding_events state machine
  const { insertBreedingEvent } = await import('./breedingEventBridge');
  await insertBreedingEvent({
    animalId: pregnancyConfirm.animalId,
    farmId,
    eventType: 'pregnancy_confirmed',
    eventDate: new Date().toISOString(),
    relatedAiRecordId: pregnancyConfirm.recordId,
    metadata: {
      expected_delivery_date: pregnancyConfirm.expectedDeliveryDate,
      gestation_days: pregnancyConfirm.gestationDays,
    },
  });
}

/**
 * Sync pending photos linked to a parent queue item
 * 
 * Photos are uploaded to storage AFTER the parent record succeeds.
 * Avatar photos update animals.avatar_url.
 * Health record photos create animal_photos rows.
 */
async function syncPendingPhotos(item: QueueItem): Promise<void> {
  const { pendingPhotoIds, farmId } = item.payload;
  if (!pendingPhotoIds || pendingPhotoIds.length === 0 || !farmId) return;

  const { getPhoto, updatePhotoStatus, removePhoto } = await import('./offlinePhotoQueue');

  for (const photoId of pendingPhotoIds) {
    const photo = await getPhoto(photoId);
    if (!photo || photo.status !== 'pending') continue;

    try {
      await updatePhotoStatus(photoId, 'uploading');

      // Determine storage path based on target
      let filePath: string;
      if (photo.target === 'avatar') {
        filePath = `${farmId}/avatars/${photo.fileName}`;
      } else {
        filePath = `${farmId}/health/${photo.fileName}`;
      }

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('animal-photos')
        .upload(filePath, photo.blob, {
          contentType: photo.mimeType,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('animal-photos')
        .getPublicUrl(filePath);

      // Handle based on target type
      if (photo.target === 'avatar') {
        const { error: updateError } = await supabase
          .from('animals')
          .update({ avatar_url: publicUrl })
          .eq('id', photo.animalId);

        if (updateError) throw updateError;
      } else {
        // Health record photo - create animal_photos row
        const { error: photoRecordError } = await supabase
          .from('animal_photos')
          .insert({
            animal_id: photo.animalId,
            photo_path: publicUrl,
            label: 'Health Record (offline)',
          });

        if (photoRecordError) {
          console.error('[SyncService] Failed to create photo record:', photoRecordError);
        }
      }

      await removePhoto(photoId);
      console.log(`[SyncService] Photo synced: ${photoId}`);
    } catch (error: any) {
      console.error(`[SyncService] Failed to sync photo ${photoId}:`, error);
      await updatePhotoStatus(photoId, 'failed', error.message);
    }
  }
}

// ============= BARN SYNC PROCESSORS =============

/**
 * Sync barn creation from offline queue
 */
async function syncBarnCreate(item: QueueItem): Promise<void> {
  const { farmId, barnData, barnId } = item.payload;
  if (!farmId || !barnData) throw new Error('No barn data in queue item');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const clientId = `barn_${barnId || item.optimisticId}`;

  // Check for duplicate via client_generated_id pattern (name + farm_id)
  const { data: existing } = await supabase
    .from('barns')
    .select('id')
    .eq('farm_id', farmId)
    .eq('name', barnData.name)
    .eq('is_active', true)
    .maybeSingle();

  if (existing) {
    console.log('[SyncService] Barn already exists, skipping create:', barnData.name);
    return;
  }

  const { error } = await supabase
    .from('barns')
    .insert({
      farm_id: farmId,
      name: barnData.name,
      barn_type: barnData.barn_type,
      description: barnData.description || null,
      capacity: barnData.capacity || null,
      created_by: user.id,
    });

  if (error) throw error;
  console.log('[SyncService] Barn created:', barnData.name);
}

/**
 * Sync barn update from offline queue (uses conflict detection)
 */
async function syncBarnUpdate(item: QueueItem): Promise<void> {
  const { barnId, barnData } = item.payload;
  if (!barnId || !barnData) throw new Error('No barn update data in queue item');

  const farmId = item.payload.farmId || '';

  // Conflict detection for UPDATE operations
  const conflicted = await checkAndHandleConflict(
    item,
    'barns',
    barnId,
    barnData as Record<string, any>,
    farmId
  );
  if (conflicted) return;

  const updates: Record<string, any> = {};
  if (barnData.name) updates.name = barnData.name;
  if (barnData.barn_type) updates.barn_type = barnData.barn_type;
  if (barnData.description !== undefined) updates.description = barnData.description;
  if (barnData.capacity !== undefined) updates.capacity = barnData.capacity;

  const { error } = await supabase
    .from('barns')
    .update(updates)
    .eq('id', barnId);

  if (error) throw error;
  console.log('[SyncService] Barn updated:', barnId);
}

/**
 * Sync barn assignment from offline queue
 * Server-side trigger (trg_barn_assignment_insert) handles animals.current_barn_id
 */
async function syncBarnAssign(item: QueueItem): Promise<void> {
  const { farmId, barnId, barnAnimalId } = item.payload;
  if (!farmId || !barnId || !barnAnimalId) throw new Error('No barn assignment data in queue item');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Dedup check: is this animal already assigned to this barn?
  const { data: existing } = await supabase
    .from('barn_assignments')
    .select('id')
    .eq('barn_id', barnId)
    .eq('animal_id', barnAnimalId)
    .is('removed_at', null)
    .maybeSingle();

  if (existing) {
    console.log('[SyncService] Animal already assigned to barn, skipping');
    return;
  }

  const { error } = await supabase
    .from('barn_assignments')
    .insert({
      barn_id: barnId,
      animal_id: barnAnimalId,
      farm_id: farmId,
      assigned_by: user.id,
    });

  if (error) throw error;
  console.log('[SyncService] Animal assigned to barn:', barnAnimalId, '->', barnId);
}

/**
 * Sync barn animal removal from offline queue
 * Server-side trigger (trg_barn_assignment_removal) handles animals.current_barn_id cleanup
 */
async function syncBarnRemove(item: QueueItem): Promise<void> {
  const { barnAssignmentId } = item.payload;
  if (!barnAssignmentId) throw new Error('No barn assignment ID for removal');

  const { error } = await supabase
    .from('barn_assignments')
    .update({ removed_at: new Date().toISOString() })
    .eq('id', barnAssignmentId);

  if (error) throw error;
  console.log('[SyncService] Barn assignment removed:', barnAssignmentId);
}

/**
 * Sync offline milk feeding (good or rejected milk fed to animal via FIFO).
 *
 * Steps:
 * 1. Insert feeding_record with milk_inventory_id and cost_per_kg_at_time
 * 2. Update each milk_inventory row (FIFO deduction)
 * 3. Confirm optimistic records
 */
async function syncMilkFeeding(item: QueueItem): Promise<void> {
  const { milkFeeding, farmId } = item.payload;

  if (!milkFeeding || !farmId) {
    throw new Error('No milk feeding data in queue item');
  }

  const { data: { user } } = await supabase.auth.getUser();
  const clientId = `${item.optimisticId}_milkfeed_0`;

  // Step 1: Insert feeding record
  const { data: insertedRecord, error: insertError } = await supabase
    .from('feeding_records')
    .insert({
      animal_id: milkFeeding.animalId,
      record_datetime: milkFeeding.recordDatetime,
      kilograms: milkFeeding.totalLiters, // 1L ≈ 1kg
      feed_type: milkFeeding.feedType,
      cost_per_kg_at_time: milkFeeding.pricePerLiter,
      milk_inventory_id: milkFeeding.milkInventoryId,
      notes: milkFeeding.notes,
      created_by: user?.id,
      client_generated_id: clientId,
    })
    .select()
    .single();

  if (insertError) {
    // Duplicate check — if already synced, skip inventory updates
    if (insertError.code === '23505' && insertError.message?.includes('client_generated_id')) {
      console.log('[SyncService] Milk feeding already synced, skipping...');
      return;
    }
    throw insertError;
  }

  // Step 2: Update milk_inventory rows (FIFO deductions)
  for (const deduction of milkFeeding.deductions) {
    // Read current server value for idempotency
    const { data: current } = await supabase
      .from('milk_inventory')
      .select('liters_remaining')
      .eq('id', deduction.id)
      .single();

    if (current) {
      const newRemaining = Math.max(0, current.liters_remaining - deduction.litersUsed);
      const isFullyConsumed = newRemaining < 0.05;

      await supabase
        .from('milk_inventory')
        .update({
          liters_remaining: newRemaining,
          is_available: !isFullyConsumed,
        })
        .eq('id', deduction.id);
    }
  }

  // Step 3: Confirm optimistic records
  if (item.optimisticId && insertedRecord) {
    await confirmOptimisticRecords(item.optimisticId, [insertedRecord]);
    await updateItem(item.id, { serverResponse: insertedRecord });
  }

  console.log(`[SyncService] Milk feeding synced: ${milkFeeding.totalLiters}L ${milkFeeding.feedType} to ${milkFeeding.animalName || milkFeeding.animalId}`);
}

async function syncMilkSale(item: QueueItem): Promise<void> {
  const { milkSale, farmId } = item.payload;

  if (!milkSale || !farmId) {
    throw new Error('No milk sale data in queue item');
  }

  const { data: { user } } = await supabase.auth.getUser();

  // Step 1: Update milk_inventory rows (FIFO deductions)
  for (const deduction of milkSale.deductions) {
    const { data: current } = await supabase
      .from('milk_inventory')
      .select('liters_remaining')
      .eq('id', deduction.id)
      .single();

    if (current) {
      const newRemaining = Math.max(0, current.liters_remaining - deduction.litersUsed);
      const isFullyConsumed = newRemaining < 0.05;

      await supabase
        .from('milk_inventory')
        .update({
          liters_remaining: newRemaining,
          is_available: !isFullyConsumed,
        })
        .eq('id', deduction.id);

      // If fully consumed, mark the milking_record as sold
      if (isFullyConsumed) {
        const saleAmount = deduction.litersOriginal * milkSale.pricePerLiter;
        await supabase
          .from('milking_records')
          .update({
            is_sold: true,
            price_per_liter: milkSale.pricePerLiter,
            sale_amount: saleAmount,
          })
          .eq('id', deduction.milkingRecordId);
      }
    }
  }

  // Step 2: Create revenue record (idempotent via linked_milk_log_id unique index)
  const { data: existingRevenue } = await supabase
    .from('farm_revenues')
    .select('id')
    .eq('linked_milk_log_id', milkSale.linkedMilkLogId)
    .eq('is_deleted', false)
    .maybeSingle();

  if (!existingRevenue) {
    const { error: revenueError } = await supabase
      .from('farm_revenues')
      .insert({
        farm_id: farmId,
        amount: milkSale.totalAmount,
        source: REVENUE_SOURCE_KEYS.MILK_SALE,
        transaction_date: milkSale.saleDate,
        linked_milk_log_id: milkSale.linkedMilkLogId,
        notes: milkSale.notes,
        user_id: user?.id || '',
      });

    if (revenueError) {
      // Duplicate check — if already synced, skip
      if (revenueError.code === '23505') {
        console.log('[SyncService] Milk sale revenue already synced, skipping...');
      } else {
        throw revenueError;
      }
    }
  }

  console.log(`[SyncService] Milk sale synced: ${milkSale.totalLiters}L ${milkSale.species} for ₱${milkSale.totalAmount}`);
}

/**
 * Sync a queued breeding event using the SSOT bridge
 */
async function syncBreedingEvent(item: QueueItem): Promise<void> {
  const { breedingEvent } = item.payload;

  if (!breedingEvent) {
    throw new Error('No breeding event data in queue item');
  }

  await insertBreedingEvent({
    animalId: breedingEvent.animalId,
    farmId: breedingEvent.farmId,
    eventType: breedingEvent.eventType as any,
    eventDate: breedingEvent.eventDate,
    notes: breedingEvent.notes,
    metadata: breedingEvent.metadata,
  });

  console.log(`[SyncService] Breeding event synced: ${breedingEvent.eventType} for animal ${breedingEvent.animalId}`);
}
