/**
 * Breeding Event Bridge
 * 
 * Utility to insert breeding_events rows alongside legacy table writes.
 * This bridges existing dialogs (heat_records, ai_records) to the
 * fertility state machine trigger on breeding_events.
 * 
 * The DB trigger `update_animal_fertility_status` handles all status transitions
 * based on event_type. See fertility.ts for valid BreedingEventType values.
 */

import { supabase } from '@/integrations/supabase/client';
import type { BreedingEventType } from '@/types/fertility';
import { GESTATION_DAYS } from '@/types/fertility';
import { addDays } from 'date-fns';

interface InsertBreedingEventParams {
  animalId: string;
  farmId: string;
  eventType: BreedingEventType;
  eventDate: string; // ISO date string
  relatedHeatRecordId?: string;
  relatedAiRecordId?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Insert a breeding_events row to trigger the fertility state machine.
 * Should be called AFTER the legacy table write succeeds.
 * Failures are logged but do not throw — the legacy write already succeeded.
 *
 * Returns { success, error } so callers where the breeding_event IS the
 * primary write (e.g. calving) can gate downstream steps on success.
 */
export async function insertBreedingEvent(params: InsertBreedingEventParams): Promise<{ success: boolean; error?: any }> {
  try {
    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from('breeding_events').insert([{
      animal_id: params.animalId,
      farm_id: params.farmId,
      event_type: params.eventType,
      event_date: params.eventDate,
      related_heat_record_id: params.relatedHeatRecordId || null,
      related_ai_record_id: params.relatedAiRecordId || null,
      notes: params.notes || null,
      metadata: params.metadata as any || null,
      created_by: userData?.user?.id || null,
    }]);

    if (error) {
      console.error(`[BreedingEventBridge] Failed to insert ${params.eventType} event:`, error);
      return { success: false, error };
    }

    // Data hygiene: clear ai_records pregnancy when pregnancy ends
    if (params.eventType === 'pregnancy_failed' || params.eventType === 'heat_return') {
      await supabase
        .from('ai_records')
        .update({ pregnancy_confirmed: false, expected_delivery_date: null })
        .eq('animal_id', params.animalId)
        .eq('pregnancy_confirmed', true);
    }

    return { success: true };
  } catch (err) {
    console.error(`[BreedingEventBridge] Unexpected error inserting ${params.eventType}:`, err);
    return { success: false, error: err };
  }
}

/**
 * Confirm pregnancy with full ai_records sync.
 * Updates ai_records (expected_delivery_date, pregnancy_confirmed) AND
 * inserts breeding_event to trigger the fertility state machine.
 * Use this instead of raw insertBreedingEvent for pregnancy_confirmed.
 */
export async function confirmPregnancyWithAISync(params: {
  animalId: string;
  farmId: string;
  notes?: string;
  livestockType?: string;
}): Promise<void> {
  // Get latest performed AI record
  const { data: aiRecord } = await supabase
    .from('ai_records')
    .select('id, performed_date')
    .eq('animal_id', params.animalId)
    .not('performed_date', 'is', null)
    .order('performed_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const gestationDays = GESTATION_DAYS[params.livestockType || 'cattle'] || 283;
  let expectedDeliveryDate: string | null = null;

  if (aiRecord?.performed_date) {
    expectedDeliveryDate = addDays(new Date(aiRecord.performed_date), gestationDays)
      .toISOString().split('T')[0];

    // Sync ai_records (matches legacy ConfirmPregnancyDialog behavior)
    await supabase
      .from('ai_records')
      .update({
        pregnancy_confirmed: true,
        expected_delivery_date: expectedDeliveryDate,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', aiRecord.id);
  }

  // Insert breeding_event (triggers DB state machine → confirmed_pregnant)
  await insertBreedingEvent({
    animalId: params.animalId,
    farmId: params.farmId,
    eventType: 'pregnancy_confirmed',
    eventDate: new Date().toISOString(),
    relatedAiRecordId: aiRecord?.id || undefined,
    notes: params.notes,
    metadata: expectedDeliveryDate
      ? { expected_delivery_date: expectedDeliveryDate, gestation_days: gestationDays }
      : undefined,
  });
}
