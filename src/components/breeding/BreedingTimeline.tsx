/**
 * BreedingTimeline - Unified reproductive history timeline
 * 
 * Merges breeding_events + heat_records + ai_records into a single
 * deduplicated chronological timeline for an animal.
 */

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNow } from 'date-fns';
import { Heart, Syringe, Baby, CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react';
import type { BreedingEventType } from '@/types/fertility';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getCachedRecords } from '@/lib/dataCache';
import { useToast } from '@/hooks/use-toast';
import { showErrorToastLegacy } from '@/lib/errorHandling';
import { DeleteBreedingEventDialog } from './DeleteBreedingEventDialog';
import MarkAIPerformedDialog from '../MarkAIPerformedDialog';

interface BreedingTimelineProps {
  animalId: string;
  farmId?: string;
  className?: string;
  headerActions?: React.ReactNode;
  readOnly?: boolean;
}

interface TimelineEvent {
  id: string;
  event_type: BreedingEventType;
  event_date: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
}

const EVENT_CONFIG: Record<BreedingEventType, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
}> = {
  heat_detected: { icon: Heart, label: 'Heat Detected', color: 'text-orange-500' },
  ai_scheduled: { icon: Clock, label: 'AI Scheduled', color: 'text-blue-400' },
  ai_performed: { icon: Syringe, label: 'AI Performed', color: 'text-blue-500' },
  non_return: { icon: CheckCircle, label: 'Non-Return', color: 'text-purple-500' },
  pregnancy_check_scheduled: { icon: Clock, label: 'Preg Check Scheduled', color: 'text-purple-400' },
  pregnancy_confirmed: { icon: CheckCircle, label: 'Pregnancy Confirmed', color: 'text-pink-500' },
  pregnancy_failed: { icon: XCircle, label: 'Not Pregnant', color: 'text-red-500' },
  calving: { icon: Baby, label: 'Calved', color: 'text-teal-500' },
  vwp_ended: { icon: CheckCircle, label: 'VWP Ended', color: 'text-green-500' },
  heat_return: { icon: Heart, label: 'Heat Return', color: 'text-orange-400' },
};

export function BreedingTimeline({ animalId, farmId, className, headerActions, readOnly = false }: BreedingTimelineProps) {
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deletingEvent, setDeletingEvent] = useState<TimelineEvent | null>(null);

  const handleDeleteBreedingEvent = async (event: TimelineEvent) => {
    try {
      const { error } = await supabase
        .from('breeding_events')
        .delete()
        .eq('id', event.id);
      if (error) throw error;
      toast({ title: "Breeding event deleted" });
      queryClient.invalidateQueries({ queryKey: ['breeding-timeline', animalId] });
    } catch (error: any) {
      console.error('[DeleteBreedingEvent] Failed:', error);
      showErrorToastLegacy(toast, error, 'deleting breeding event');
    }
  };

  // Fetch breeding_events — with offline cache fallback
  const { data: breedingEvents = [], isLoading: loadingBreeding } = useQuery({
    queryKey: ['breeding-timeline', animalId],
    queryFn: async () => {
      if (!isOnline) {
        // Offline: return cached breeding events from IndexedDB
        const cached = await getCachedRecords(animalId);
        return cached?.breeding || [];
      }
      const { data, error } = await supabase
        .from('breeding_events')
        .select('id, event_type, event_date, notes, metadata, related_heat_record_id, related_ai_record_id')
        .eq('animal_id', animalId)
        .order('event_date', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!animalId,
    staleTime: 5 * 60 * 1000,
  });

  // Always fetch legacy records and merge
  const { data: legacyEvents = [], isLoading: loadingLegacy } = useQuery({
    queryKey: ['breeding-timeline-legacy', animalId],
    queryFn: async () => {
      const [heatResult, aiResult] = await Promise.all([
        supabase
          .from('heat_records')
          .select('id, detected_at, intensity, standing_heat, detection_method')
          .eq('animal_id', animalId)
          .order('detected_at', { ascending: false })
          .limit(50),
        supabase
          .from('ai_records')
          .select('id, scheduled_date, performed_date, pregnancy_confirmed, expected_delivery_date, technician, semen_code, notes')
          .eq('animal_id', animalId)
          .order('scheduled_date', { ascending: false })
          .limit(50),
      ]);

      const combined: TimelineEvent[] = [];

      heatResult.data?.forEach(heat => {
        combined.push({
          id: `heat-${heat.id}`,
          event_type: 'heat_detected',
          event_date: heat.detected_at,
          notes: [
            heat.standing_heat ? 'Standing heat' : null,
            heat.intensity ? `Intensity: ${heat.intensity}` : null,
            heat.detection_method ? `Method: ${heat.detection_method}` : null,
          ].filter(Boolean).join(' · ') || null,
          metadata: { source: 'heat_records', original_id: heat.id },
        });
      });

      // Filter out parentage AI records (from is_father_ai — about the mother's AI, not this animal's breeding)
      aiResult.data?.filter(ai => !ai.notes?.startsWith('[PARENTAGE]')).forEach(ai => {
        // Scheduled but not performed
        if (ai.scheduled_date && !ai.performed_date) {
          combined.push({
            id: `ai-sched-${ai.id}`,
            event_type: 'ai_scheduled',
            event_date: ai.scheduled_date,
            notes: [
              ai.technician ? `Tech: ${ai.technician}` : null,
              ai.semen_code ? `Semen: ${ai.semen_code}` : null,
            ].filter(Boolean).join(' · ') || null,
            metadata: { source: 'ai_records', original_id: ai.id },
          });
        }
        // Performed
        if (ai.performed_date) {
          combined.push({
            id: `ai-perf-${ai.id}`,
            event_type: 'ai_performed',
            event_date: ai.performed_date,
            notes: [
              ai.technician ? `Tech: ${ai.technician}` : null,
              ai.semen_code ? `Semen: ${ai.semen_code}` : null,
              ai.notes || null,
            ].filter(Boolean).join(' · ') || null,
            metadata: { source: 'ai_records', original_id: ai.id },
          });
        }
        // Pregnancy confirmed from AI record
        if (ai.pregnancy_confirmed === true && ai.performed_date) {
          combined.push({
            id: `preg-${ai.id}`,
            event_type: 'pregnancy_confirmed',
            event_date: ai.performed_date,
            notes: ai.expected_delivery_date ? `Due: ${ai.expected_delivery_date}` : null,
            metadata: { source: 'ai_records', original_id: ai.id, expected_delivery_date: ai.expected_delivery_date },
          });
        }
      });

      return combined;
    },
    enabled: !!animalId,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = loadingBreeding || loadingLegacy;

  // Deduplicate: breeding_events with related IDs take priority over legacy
  const relatedHeatIds = new Set(
    breedingEvents
      .filter((e: any) => e.related_heat_record_id)
      .map((e: any) => e.related_heat_record_id)
  );
  const relatedAiIds = new Set(
    breedingEvents
      .filter((e: any) => e.related_ai_record_id)
      .map((e: any) => e.related_ai_record_id)
  );

  const filteredLegacy = legacyEvents.filter(le => {
    const meta = le.metadata as Record<string, unknown> | null;
    const originalId = meta?.original_id as string | undefined;
    if (!originalId) return true;
    const source = meta?.source as string;
    if (source === 'heat_records' && relatedHeatIds.has(originalId)) return false;
    if (source === 'ai_records' && relatedAiIds.has(originalId)) return false;
    return true;
  });

  const allEvents: TimelineEvent[] = [
    ...breedingEvents.map((e: any) => ({
      id: e.id,
      event_type: e.event_type as BreedingEventType,
      event_date: e.event_date,
      notes: e.notes,
      metadata: { ...e.metadata, related_ai_record_id: e.related_ai_record_id },
    })),
    ...filteredLegacy,
  ].sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());

  // Group by month
  const groupedEvents = allEvents.reduce((acc, event) => {
    const key = format(new Date(event.event_date), 'yyyy-MM');
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {} as Record<string, TimelineEvent[]>);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">Breeding Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24 mt-1" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Breeding Timeline</CardTitle>
          {headerActions && <div className="flex gap-2">{headerActions}</div>}
        </div>
      </CardHeader>
      <CardContent>
        {allEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-4">
            No breeding events recorded yet
          </p>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedEvents)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([monthKey, monthEvents]) => (
                <div key={monthKey}>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    {format(new Date(monthKey + '-01'), 'MMMM yyyy')}
                  </h4>
                  <div className="relative pl-6 border-l-2 border-muted space-y-4">
                    {monthEvents.map(event => {
                      const config = EVENT_CONFIG[event.event_type];
                      const Icon = config?.icon || Clock;
                      // Only breeding_events rows are deletable (not legacy heat-/ai-/preg- prefixed IDs)
                      const isBreedingEvent = !event.id.startsWith('heat-') && !event.id.startsWith('ai-') && !event.id.startsWith('preg-');

                      return (
                        <div key={event.id} className="relative">
                          <div className={`absolute -left-[25px] p-1 rounded-full bg-background border-2 ${config?.color || 'text-muted-foreground'}`}>
                            <Icon className="h-3 w-3" />
                          </div>
                          <div className="pb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {config?.label || event.event_type}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {format(new Date(event.event_date), 'MMM d')}
                              </Badge>
                              {!readOnly && isBreedingEvent && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={() => setDeletingEvent(event)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(event.event_date), { addSuffix: true })}
                            </p>
                            {event.notes && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {event.notes}
                              </p>
                            )}
                            {/* Mark as Performed button for ai_scheduled events */}
                            {!readOnly && event.event_type === 'ai_scheduled' && farmId && (() => {
                              const meta = event.metadata as Record<string, unknown> | null;
                              // Legacy record: original_id in metadata; breeding_events row: related_ai_record_id
                              const aiRecordId = (meta?.original_id as string) || (meta?.related_ai_record_id as string);
                              if (!aiRecordId) return null;
                              return (
                                <div className="mt-1">
                                  <MarkAIPerformedDialog
                                    recordId={aiRecordId}
                                    animalId={animalId}
                                    farmId={farmId}
                                    scheduledDate={event.event_date}
                                    onSuccess={() => {
                                      queryClient.invalidateQueries({ queryKey: ['breeding-timeline', animalId] });
                                      queryClient.invalidateQueries({ queryKey: ['breeding-timeline-legacy', animalId] });
                                    }}
                                  />
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>

      {deletingEvent && (
        <DeleteBreedingEventDialog
          open={!!deletingEvent}
          onOpenChange={(open) => !open && setDeletingEvent(null)}
          event={deletingEvent}
          eventLabel={EVENT_CONFIG[deletingEvent.event_type]?.label || deletingEvent.event_type}
          onDelete={handleDeleteBreedingEvent}
        />
      )}
    </Card>
  );
}
