/**
 * BreedingTimeline - Individual animal reproductive history timeline
 * 
 * Shows the complete breeding lifecycle events for a single animal
 * with visual timeline and key metrics.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNow } from 'date-fns';
import { Heart, Syringe, Baby, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { BreedingEventType } from '@/types/fertility';

interface BreedingTimelineProps {
  animalId: string;
  className?: string;
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
  labelTagalog: string;
  color: string;
}> = {
  heat_detected: {
    icon: Heart,
    label: 'Heat Detected',
    labelTagalog: 'Nakitaan ng Init',
    color: 'text-orange-500',
  },
  ai_scheduled: {
    icon: Clock,
    label: 'AI Scheduled',
    labelTagalog: 'Naka-iskedyul ang AI',
    color: 'text-blue-400',
  },
  ai_performed: {
    icon: Syringe,
    label: 'AI Performed',
    labelTagalog: 'Natapos ang AI',
    color: 'text-blue-500',
  },
  non_return: {
    icon: CheckCircle,
    label: 'Non-Return',
    labelTagalog: 'Walang Bumalik na Init',
    color: 'text-purple-500',
  },
  pregnancy_check_scheduled: {
    icon: Clock,
    label: 'Preg Check Scheduled',
    labelTagalog: 'Naka-iskedyul ang Tsek',
    color: 'text-purple-400',
  },
  pregnancy_confirmed: {
    icon: CheckCircle,
    label: 'Pregnancy Confirmed',
    labelTagalog: 'Nakumpirma ang Pagbubuntis',
    color: 'text-pink-500',
  },
  pregnancy_failed: {
    icon: XCircle,
    label: 'Not Pregnant',
    labelTagalog: 'Hindi Buntis',
    color: 'text-red-500',
  },
  calving: {
    icon: Baby,
    label: 'Calved',
    labelTagalog: 'Nanganak',
    color: 'text-teal-500',
  },
  vwp_ended: {
    icon: CheckCircle,
    label: 'VWP Ended',
    labelTagalog: 'Tapos ang Panahon ng Pagpapahinga',
    color: 'text-green-500',
  },
  heat_return: {
    icon: Heart,
    label: 'Heat Return',
    labelTagalog: 'Bumalik ang Init',
    color: 'text-orange-400',
  },
};

export function BreedingTimeline({ animalId, className }: BreedingTimelineProps) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['breeding-timeline', animalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('breeding_events')
        .select('id, event_type, event_date, notes, metadata')
        .eq('animal_id', animalId)
        .order('event_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as TimelineEvent[];
    },
    enabled: !!animalId,
    staleTime: 5 * 60 * 1000,
  });

  // Also fetch legacy heat records and AI records for backwards compatibility
  const { data: legacyEvents = [] } = useQuery({
    queryKey: ['breeding-timeline-legacy', animalId],
    queryFn: async () => {
      const [heatResult, aiResult] = await Promise.all([
        supabase
          .from('heat_records')
          .select('id, detected_at, intensity, standing_heat')
          .eq('animal_id', animalId)
          .order('detected_at', { ascending: false })
          .limit(20),
        supabase
          .from('ai_records')
          .select('id, performed_date, pregnancy_confirmed, expected_delivery_date')
          .eq('animal_id', animalId)
          .order('performed_date', { ascending: false })
          .limit(20),
      ]);

      const combined: TimelineEvent[] = [];

      // Convert heat records
      heatResult.data?.forEach(heat => {
        combined.push({
          id: `heat-${heat.id}`,
          event_type: 'heat_detected',
          event_date: heat.detected_at,
          notes: heat.standing_heat ? 'Standing heat' : heat.intensity || null,
          metadata: null,
        });
      });

      // Convert AI records
      aiResult.data?.forEach(ai => {
        if (ai.performed_date) {
          combined.push({
            id: `ai-${ai.id}`,
            event_type: 'ai_performed',
            event_date: ai.performed_date,
            notes: null,
            metadata: null,
          });
        }
        if (ai.pregnancy_confirmed === true) {
          combined.push({
            id: `preg-${ai.id}`,
            event_type: 'pregnancy_confirmed',
            event_date: ai.performed_date || '',
            notes: ai.expected_delivery_date ? `Due: ${ai.expected_delivery_date}` : null,
            metadata: { expected_delivery_date: ai.expected_delivery_date },
          });
        }
      });

      return combined;
    },
    enabled: !!animalId && events.length === 0,
    staleTime: 5 * 60 * 1000,
  });

  const allEvents = events.length > 0 ? events : legacyEvents;

  // Group events by year/month
  const groupedEvents = allEvents.reduce((acc, event) => {
    const date = new Date(event.event_date);
    const key = format(date, 'yyyy-MM');
    if (!acc[key]) {
      acc[key] = [];
    }
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

  if (allEvents.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">Breeding Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic text-center py-4">
            No breeding events recorded yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">Breeding Timeline</CardTitle>
      </CardHeader>
      <CardContent>
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

                    return (
                      <div key={event.id} className="relative">
                        {/* Timeline dot */}
                        <div className={`absolute -left-[25px] p-1 rounded-full bg-background border-2 ${config?.color || 'text-muted-foreground'}`}>
                          <Icon className="h-3 w-3" />
                        </div>

                        {/* Event content */}
                        <div className="pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {config?.label || event.event_type}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {format(new Date(event.event_date), 'MMM d')}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(event.event_date), { addSuffix: true })}
                          </p>
                          {event.notes && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {event.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
