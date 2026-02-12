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
 */
export async function insertBreedingEvent(params: InsertBreedingEventParams): Promise<void> {
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
    }
  } catch (err) {
    console.error(`[BreedingEventBridge] Unexpected error inserting ${params.eventType}:`, err);
  }
}
