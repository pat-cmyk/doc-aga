import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Clock, 
  Milk, 
  Wheat, 
  Stethoscope, 
  Syringe,
  ChevronDown, 
  ChevronUp,
  User,
  Calendar
} from 'lucide-react';
import { format, startOfDay, endOfDay, formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface ActivityTimelineProps {
  farmId: string;
}

interface TimelineActivity {
  id: string;
  type: 'milking' | 'feeding' | 'health' | 'injection';
  timestamp: string;
  description: string;
  performedBy: string | null;
  animalName: string | null;
  details: string | null;
  icon: React.ReactNode;
  iconBg: string;
}

export function ActivityTimeline({ farmId }: ActivityTimelineProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: activities, isLoading } = useQuery<TimelineActivity[]>({
    queryKey: ['activity-timeline', farmId],
    queryFn: async () => {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');

      // Fetch all activity types in parallel
      const [milkingRes, feedingRes, healthRes, injectionRes] = await Promise.all([
        // Milking records
        supabase
          .from('milking_records')
          .select(`
            id,
            created_at,
            session,
            liters,
            animal_id,
            animals!milking_records_animal_id_fkey(name, ear_tag),
            profiles!milking_records_created_by_fkey(full_name)
          `)
          .eq('record_date', todayStr)
          .order('created_at', { ascending: false }),

        // Feeding records
        supabase
          .from('feeding_records')
          .select(`
            id,
            created_at,
            feed_type,
            kilograms,
            animal_id,
            animals!feeding_records_animal_id_fkey(name, ear_tag),
            profiles!feeding_records_created_by_fkey(full_name)
          `)
          .gte('record_datetime', startOfDay(today).toISOString())
          .lte('record_datetime', endOfDay(today).toISOString())
          .order('created_at', { ascending: false }),

        // Health records
        supabase
          .from('health_records')
          .select(`
            id,
            created_at,
            diagnosis,
            treatment,
            animal_id,
            animals!health_records_animal_id_fkey(name, ear_tag),
            profiles!health_records_created_by_fkey(full_name)
          `)
          .eq('visit_date', todayStr)
          .order('created_at', { ascending: false }),

        // Injection records
        supabase
          .from('injection_records')
          .select(`
            id,
            created_at,
            medicine_name,
            dosage,
            animal_id,
            animals!injection_records_animal_id_fkey(name, ear_tag),
            profiles!injection_records_created_by_fkey(full_name)
          `)
          .eq('record_datetime', todayStr)
          .order('created_at', { ascending: false })
      ]);

      const timeline: TimelineActivity[] = [];

      // Process milking records
      (milkingRes.data || []).forEach(record => {
        const animal = record.animals as any;
        const profile = record.profiles as any;
        timeline.push({
          id: `milking-${record.id}`,
          type: 'milking',
          timestamp: record.created_at,
          description: `Milked ${animal?.name || animal?.ear_tag || 'animal'}`,
          performedBy: profile?.full_name || null,
          animalName: animal?.name || animal?.ear_tag || null,
          details: `${record.liters}L (${record.session})`,
          icon: <Milk className="h-4 w-4" />,
          iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
        });
      });

      // Process feeding records
      (feedingRes.data || []).forEach(record => {
        const animal = record.animals as any;
        const profile = record.profiles as any;
        timeline.push({
          id: `feeding-${record.id}`,
          type: 'feeding',
          timestamp: record.created_at,
          description: animal 
            ? `Fed ${animal.name || animal.ear_tag}` 
            : 'Recorded feeding',
          performedBy: profile?.full_name || null,
          animalName: animal?.name || animal?.ear_tag || null,
          details: record.kilograms ? `${record.kilograms}kg ${record.feed_type || ''}`.trim() : record.feed_type || null,
          icon: <Wheat className="h-4 w-4" />,
          iconBg: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
        });
      });

      // Process health records
      (healthRes.data || []).forEach(record => {
        const animal = record.animals as any;
        const profile = record.profiles as any;
        timeline.push({
          id: `health-${record.id}`,
          type: 'health',
          timestamp: record.created_at,
          description: `Health check for ${animal?.name || animal?.ear_tag || 'animal'}`,
          performedBy: profile?.full_name || null,
          animalName: animal?.name || animal?.ear_tag || null,
          details: record.diagnosis || record.treatment || null,
          icon: <Stethoscope className="h-4 w-4" />,
          iconBg: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
        });
      });

      // Process injection records
      (injectionRes.data || []).forEach(record => {
        const animal = record.animals as any;
        const profile = record.profiles as any;
        timeline.push({
          id: `injection-${record.id}`,
          type: 'injection',
          timestamp: record.created_at,
          description: `Gave injection to ${animal?.name || animal?.ear_tag || 'animal'}`,
          performedBy: profile?.full_name || null,
          animalName: animal?.name || animal?.ear_tag || null,
          details: record.medicine_name ? `${record.medicine_name} ${record.dosage || ''}`.trim() : null,
          icon: <Syringe className="h-4 w-4" />,
          iconBg: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
        });
      });

      // Sort by timestamp descending
      timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return timeline;
    },
    enabled: !!farmId,
    staleTime: 30000,
    refetchInterval: 60000
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Today's Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No activities recorded today yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Today's Activity Timeline
                <Badge variant="secondary" className="ml-1">
                  {activities.length}
                </Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <ScrollArea className="h-[300px] pr-4">
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

                <div className="space-y-4">
                  {activities.map((activity, index) => (
                    <div key={activity.id} className="relative flex items-start gap-4 pl-10">
                      {/* Timeline dot */}
                      <div className={`absolute left-0 p-2 rounded-full ${activity.iconBg}`}>
                        {activity.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {activity.description}
                            </p>
                            {activity.details && (
                              <p className="text-xs text-muted-foreground truncate">
                                {activity.details}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-medium">
                              {format(new Date(activity.timestamp), 'h:mm a')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        
                        {activity.performedBy && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{activity.performedBy}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
