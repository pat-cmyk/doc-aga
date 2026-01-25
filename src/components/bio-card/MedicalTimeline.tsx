/**
 * MedicalTimeline - Vertical Health Event Timeline
 * 
 * Aggregates and displays health records, vaccinations,
 * deworming, and treatments in a chronological timeline.
 */

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, isThisWeek, isThisMonth } from "date-fns";
import { Syringe, Pill, Stethoscope, Activity, Scale, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TimelineEvent {
  id: string;
  type: 'vaccination' | 'deworming' | 'health' | 'injection' | 'weight' | 'bcs';
  date: string;
  title: string;
  subtitle?: string;
  status?: 'completed' | 'scheduled' | 'overdue';
}

interface MedicalTimelineProps {
  animalId: string;
  farmId: string;
  maxItems?: number;
  onEventClick?: (event: TimelineEvent) => void;
}

const TYPE_CONFIG = {
  vaccination: {
    icon: Syringe,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    label: 'Vaccination',
  },
  deworming: {
    icon: Pill,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    label: 'Deworming',
  },
  health: {
    icon: Stethoscope,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    label: 'Health Check',
  },
  injection: {
    icon: Activity,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    label: 'Treatment',
  },
  weight: {
    icon: Scale,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    label: 'Weight',
  },
  bcs: {
    icon: Activity,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    label: 'BCS',
  },
};

export function MedicalTimeline({
  animalId,
  farmId,
  maxItems = 5,
  onEventClick,
}: MedicalTimelineProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  // Fetch all medical events
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['medical-timeline', animalId],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const dateStr = sixMonthsAgo.toISOString().split('T')[0];
      
      // Fetch all data sources in parallel
      const [
        { data: healthRecords },
        { data: injectionRecords },
        { data: preventiveSchedules },
        { data: weightRecords },
        { data: bcsRecords },
      ] = await Promise.all([
        supabase
          .from('health_records')
          .select('id, visit_date, diagnosis, treatment')
          .eq('animal_id', animalId)
          .gte('visit_date', dateStr)
          .order('visit_date', { ascending: false })
          .limit(10),
        supabase
          .from('injection_records')
          .select('id, record_datetime, medicine_name, dosage')
          .eq('animal_id', animalId)
          .gte('record_datetime', sixMonthsAgo.toISOString())
          .order('record_datetime', { ascending: false })
          .limit(10),
        supabase
          .from('preventive_health_schedules')
          .select('id, scheduled_date, treatment_name, schedule_type, status, completed_date')
          .eq('animal_id', animalId)
          .or(`scheduled_date.gte.${dateStr},completed_date.gte.${dateStr}`)
          .order('scheduled_date', { ascending: false })
          .limit(10),
        supabase
          .from('weight_records')
          .select('id, measurement_date, weight_kg')
          .eq('animal_id', animalId)
          .gte('measurement_date', dateStr)
          .order('measurement_date', { ascending: false })
          .limit(5),
        supabase
          .from('body_condition_scores')
          .select('id, assessment_date, score')
          .eq('animal_id', animalId)
          .gte('assessment_date', dateStr)
          .order('assessment_date', { ascending: false })
          .limit(5),
      ]);
      
      // Transform to unified timeline events
      const timelineEvents: TimelineEvent[] = [];
      
      // Health records
      healthRecords?.forEach(r => {
        timelineEvents.push({
          id: r.id,
          type: 'health',
          date: r.visit_date,
          title: r.diagnosis || 'Health Check',
          subtitle: r.treatment || undefined,
          status: 'completed',
        });
      });
      
      // Injection records
      injectionRecords?.forEach(r => {
        timelineEvents.push({
          id: r.id,
          type: 'injection',
          date: r.record_datetime.split('T')[0],
          title: r.medicine_name || 'Treatment',
          subtitle: r.dosage || undefined,
          status: 'completed',
        });
      });
      
      // Preventive health (vaccinations/deworming)
      preventiveSchedules?.forEach(r => {
        const isOverdue = r.status === 'scheduled' && new Date(r.scheduled_date) < new Date();
        timelineEvents.push({
          id: r.id,
          type: r.schedule_type === 'vaccination' ? 'vaccination' : 'deworming',
          date: r.completed_date || r.scheduled_date,
          title: r.treatment_name,
          status: r.status === 'completed' ? 'completed' : isOverdue ? 'overdue' : 'scheduled',
        });
      });
      
      // Weight records
      weightRecords?.forEach(r => {
        timelineEvents.push({
          id: r.id,
          type: 'weight',
          date: r.measurement_date,
          title: `${Number(r.weight_kg).toFixed(1)} kg`,
          status: 'completed',
        });
      });
      
      // BCS records
      bcsRecords?.forEach(r => {
        timelineEvents.push({
          id: r.id,
          type: 'bcs',
          date: r.assessment_date,
          title: `BCS ${Number(r.score).toFixed(1)}`,
          status: 'completed',
        });
      });
      
      // Sort by date descending
      return timelineEvents.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    },
    enabled: !!animalId,
    staleTime: 5 * 60 * 1000,
  });
  
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <Skeleton className="w-6 h-6 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  if (events.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        <Stethoscope className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No medical records</p>
        <p className="text-xs">Walang rekord ng kalusugan</p>
      </div>
    );
  }
  
  const visibleEvents = isExpanded ? events : events.slice(0, maxItems);
  const hasMore = events.length > maxItems;
  
  // Group by date period
  const groupEvents = (eventList: TimelineEvent[]) => {
    const groups: { label: string; events: TimelineEvent[] }[] = [];
    let currentGroup: { label: string; events: TimelineEvent[] } | null = null;
    
    eventList.forEach(event => {
      const eventDate = new Date(event.date);
      let groupLabel = 'Earlier';
      
      if (isToday(eventDate)) {
        groupLabel = 'Today';
      } else if (isThisWeek(eventDate)) {
        groupLabel = 'This Week';
      } else if (isThisMonth(eventDate)) {
        groupLabel = 'This Month';
      }
      
      if (!currentGroup || currentGroup.label !== groupLabel) {
        currentGroup = { label: groupLabel, events: [] };
        groups.push(currentGroup);
      }
      currentGroup.events.push(event);
    });
    
    return groups;
  };
  
  const groupedEvents = groupEvents(visibleEvents);

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-1">
        Medical History
        <span className="text-xs text-muted-foreground">(Kasaysayan)</span>
      </h4>
      
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
          
          {/* Events */}
          <div className="space-y-3">
            {groupedEvents.map((group, gi) => (
              <div key={gi}>
                {/* Group label */}
                <p className="text-xs text-muted-foreground pl-8 mb-1">
                  {group.label}
                </p>
                
                {group.events.map((event, ei) => {
                  const config = TYPE_CONFIG[event.type];
                  const Icon = config.icon;
                  
                  return (
                    <div
                      key={event.id}
                      className={cn(
                        "relative flex gap-2 pl-1 cursor-pointer hover:bg-muted/50 rounded-md py-1 transition-colors",
                        event.status === 'overdue' && "opacity-80"
                      )}
                      onClick={() => onEventClick?.(event)}
                    >
                      {/* Icon node */}
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center z-10",
                        config.bgColor
                      )}>
                        <Icon className={cn("w-3 h-3", config.color)} />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={cn(
                            "text-sm font-medium truncate",
                            event.status === 'overdue' && "text-destructive"
                          )}>
                            {event.title}
                          </p>
                          {event.status === 'scheduled' && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                              Scheduled
                            </span>
                          )}
                          {event.status === 'overdue' && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                              Overdue
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{format(new Date(event.date), 'MMM d')}</span>
                          {event.subtitle && (
                            <>
                              <span>•</span>
                              <span className="truncate">{event.subtitle}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        
        {/* Show more button */}
        {hasMore && (
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-xs"
            >
              <ChevronDown className={cn(
                "w-4 h-4 mr-1 transition-transform",
                isExpanded && "rotate-180"
              )} />
              {isExpanded ? 'Show Less' : `Show ${events.length - maxItems} More`}
            </Button>
          </CollapsibleTrigger>
        )}
        
        <CollapsibleContent />
      </Collapsible>
    </div>
  );
}
