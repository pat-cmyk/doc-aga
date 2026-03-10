/**
 * HealthTimeline - Unified health history timeline
 *
 * Merges health_records + preventive_health_schedules into a single
 * chronological timeline, following the BreedingTimeline pattern.
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Stethoscope, Syringe, Bug, Check, X, Plus, Pencil, Trash2, AlertTriangle, Clock } from 'lucide-react';
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getCachedRecords } from '@/lib/dataCache';
import { showErrorToastLegacy } from '@/lib/errorHandling';
import { useToast } from '@/hooks/use-toast';
import {
  usePreventiveHealthSchedules,
  useMarkScheduleComplete,
  useSkipSchedule,
  type PreventiveHealthSchedule,
} from '@/hooks/usePreventiveHealth';
import { RecordSingleHealthDialog } from '@/components/health-recording/RecordSingleHealthDialog';
import { EditHealthRecordDialog } from '@/components/health-recording/EditHealthRecordDialog';
import { DeleteHealthRecordDialog } from '@/components/health-recording/DeleteHealthRecordDialog';
import { AddPreventiveHealthDialog } from '@/components/preventive-health/AddPreventiveHealthDialog';

// --- Types ---

type HealthTimelineEventType =
  | 'health_visit'
  | 'vaccination_completed'
  | 'deworming_completed'
  | 'vaccination_scheduled'
  | 'deworming_scheduled'
  | 'vaccination_skipped'
  | 'deworming_skipped';

interface HealthTimelineEvent {
  id: string;
  event_type: HealthTimelineEventType;
  event_date: string;
  notes: string | null;
  metadata: {
    source: 'health_records' | 'preventive_health_schedules';
    original_id: string;
    diagnosis?: string | null;
    treatment?: string | null;
    treatment_name?: string;
    schedule_type?: 'vaccination' | 'deworming';
    status?: string;
    scheduled_date?: string;
    completed_date?: string | null;
    recurring_interval_months?: number | null;
    is_overdue?: boolean;
    is_due_today?: boolean;
    is_due_tomorrow?: boolean;
    original_record?: any;
  };
}

// --- Config ---

const EVENT_CONFIG: Record<HealthTimelineEventType, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
}> = {
  health_visit:            { icon: Stethoscope, label: 'Health Visit',           color: 'text-blue-500' },
  vaccination_completed:   { icon: Syringe,     label: 'Vaccination Done',       color: 'text-green-500' },
  deworming_completed:     { icon: Bug,         label: 'Deworming Done',         color: 'text-green-500' },
  vaccination_scheduled:   { icon: Syringe,     label: 'Vaccination Scheduled',  color: 'text-blue-400' },
  deworming_scheduled:     { icon: Bug,         label: 'Deworming Scheduled',    color: 'text-purple-400' },
  vaccination_skipped:     { icon: Syringe,     label: 'Vaccination Skipped',    color: 'text-gray-400' },
  deworming_skipped:       { icon: Bug,         label: 'Deworming Skipped',      color: 'text-gray-400' },
};

// --- Normalization ---

function normalizeHealthEvents(
  healthRecords: any[],
  schedules: PreventiveHealthSchedule[],
): HealthTimelineEvent[] {
  const events: HealthTimelineEvent[] = [];

  for (const r of healthRecords) {
    events.push({
      id: `health-${r.id}`,
      event_type: 'health_visit',
      event_date: r.visit_date,
      notes: r.notes,
      metadata: {
        source: 'health_records',
        original_id: r.id,
        diagnosis: r.diagnosis,
        treatment: r.treatment,
        original_record: r,
      },
    });
  }

  for (const s of schedules) {
    const isVax = s.schedule_type === 'vaccination';
    let event_type: HealthTimelineEventType;
    let event_date: string;

    if (s.status === 'completed') {
      event_type = isVax ? 'vaccination_completed' : 'deworming_completed';
      event_date = s.completed_date || s.scheduled_date;
    } else if (s.status === 'skipped') {
      event_type = isVax ? 'vaccination_skipped' : 'deworming_skipped';
      event_date = s.scheduled_date;
    } else {
      event_type = isVax ? 'vaccination_scheduled' : 'deworming_scheduled';
      event_date = s.scheduled_date;
    }

    const isOverdue = isPast(new Date(s.scheduled_date)) && s.status === 'scheduled';

    events.push({
      id: `prev-${s.id}`,
      event_type,
      event_date,
      notes: s.notes,
      metadata: {
        source: 'preventive_health_schedules',
        original_id: s.id,
        treatment_name: s.treatment_name,
        schedule_type: s.schedule_type as 'vaccination' | 'deworming',
        status: s.status || undefined,
        scheduled_date: s.scheduled_date,
        completed_date: s.completed_date,
        recurring_interval_months: s.recurring_interval_months,
        is_overdue: isOverdue,
        is_due_today: isToday(new Date(s.scheduled_date)),
        is_due_tomorrow: isTomorrow(new Date(s.scheduled_date)),
        original_record: s,
      },
    });
  }

  return events.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
}

// --- Component ---

interface HealthTimelineProps {
  animalId: string;
  animalName?: string;
  earTag?: string | null;
  farmId: string;
  livestockType: string;
  animalFarmEntryDate?: string | null;
  readOnly?: boolean;
}

export function HealthTimeline({
  animalId,
  animalName,
  earTag,
  farmId,
  livestockType,
  animalFarmEntryDate,
  readOnly = false,
}: HealthTimelineProps) {
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  // --- Health records (cache-first, same pattern as HealthRecords.tsx) ---
  const [healthRecords, setHealthRecords] = useState<any[]>([]);
  const [loadingHealth, setLoadingHealth] = useState(true);

  const loadHealthRecords = async () => {
    const cached = await getCachedRecords(animalId);
    if (cached?.health) {
      setHealthRecords(cached.health);
      setLoadingHealth(false);
    }
    if (isOnline) {
      const { data, error } = await supabase
        .from('health_records')
        .select('*')
        .eq('animal_id', animalId)
        .order('visit_date', { ascending: false });
      if (error) {
        console.error('Error loading health records:', error);
        showErrorToastLegacy(toast, error, 'loading health records');
      } else {
        setHealthRecords(data || []);
      }
    }
    setLoadingHealth(false);
  };

  useEffect(() => {
    loadHealthRecords();
    const channel = supabase
      .channel(`health_timeline_${animalId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'health_records',
        filter: `animal_id=eq.${animalId}`,
      }, () => loadHealthRecords())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [animalId]);

  // --- Preventive health schedules (React Query) ---
  const { data: schedules = [], isLoading: loadingSchedules } = usePreventiveHealthSchedules(animalId);
  const markComplete = useMarkScheduleComplete();
  const skipSchedule = useSkipSchedule();

  // --- Dialog state ---
  const [showHealthDialog, setShowHealthDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<any | null>(null);
  const [showPreventiveDialog, setShowPreventiveDialog] = useState(false);
  const [preventiveScheduleType, setPreventiveScheduleType] = useState<'vaccination' | 'deworming'>('vaccination');
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<PreventiveHealthSchedule | null>(null);

  // --- Merge events ---
  const allEvents = useMemo(
    () => normalizeHealthEvents(healthRecords, schedules),
    [healthRecords, schedules],
  );

  // Separate urgent alerts (overdue / due today / due tomorrow)
  const urgentAlerts = useMemo(
    () => allEvents.filter(e =>
      e.metadata.source === 'preventive_health_schedules' &&
      (e.metadata.status === 'scheduled' || e.metadata.status === 'overdue') &&
      (e.metadata.is_overdue || e.metadata.is_due_today || e.metadata.is_due_tomorrow)
    ),
    [allEvents],
  );

  // Group past + non-urgent events by month
  const groupedEvents = useMemo(() => {
    const groups: Record<string, HealthTimelineEvent[]> = {};
    for (const event of allEvents) {
      const key = format(new Date(event.event_date), 'yyyy-MM');
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    }
    return groups;
  }, [allEvents]);

  // --- Action handlers ---
  const handleMarkComplete = (schedule: PreventiveHealthSchedule) => {
    setSelectedSchedule(schedule);
    setCompleteDialogOpen(true);
  };

  const confirmComplete = async (createNext: boolean) => {
    if (!selectedSchedule) return;
    await markComplete.mutateAsync({
      scheduleId: selectedSchedule.id,
      completedDate: format(new Date(), 'yyyy-MM-dd'),
      createNextSchedule: createNext,
    });
    setCompleteDialogOpen(false);
    setSelectedSchedule(null);
  };

  const handleSkip = async (scheduleId: string) => {
    await skipSchedule.mutateAsync({ scheduleId });
  };

  const handleDeleteHealthRecord = async (record: any) => {
    try {
      const { error } = await supabase
        .from('health_records')
        .delete()
        .eq('id', record.id);
      if (error) throw error;
      toast({ title: "Health record deleted" });
      loadHealthRecords();
    } catch (error: any) {
      console.error('[DeleteHealthRecord] Failed:', error);
      showErrorToastLegacy(toast, error, 'deleting health record');
    }
  };

  const isLoading = loadingHealth && loadingSchedules;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Health Timeline</CardTitle>
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
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Health Timeline</CardTitle>
            {!readOnly && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowHealthDialog(true)}>
                    <Stethoscope className="h-4 w-4 mr-2" />
                    Health Record
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setPreventiveScheduleType('vaccination');
                    setShowPreventiveDialog(true);
                  }}>
                    <Syringe className="h-4 w-4 mr-2" />
                    Vaccination Schedule
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setPreventiveScheduleType('deworming');
                    setShowPreventiveDialog(true);
                  }}>
                    <Bug className="h-4 w-4 mr-2" />
                    Deworming Schedule
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Urgent Alerts Section */}
          {urgentAlerts.length > 0 && (
            <div className="mb-6 space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Needs Attention
              </h4>
              {urgentAlerts.map(event => {
                const schedule = event.metadata.original_record as PreventiveHealthSchedule;
                const isOverdue = event.metadata.is_overdue;
                const isDueToday = event.metadata.is_due_today;
                return (
                  <div
                    key={`alert-${event.id}`}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isOverdue
                        ? 'border-destructive/50 bg-destructive/5'
                        : isDueToday
                        ? 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${
                        event.metadata.schedule_type === 'vaccination'
                          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                      }`}>
                        {event.metadata.schedule_type === 'vaccination' ? (
                          <Syringe className="h-4 w-4" />
                        ) : (
                          <Bug className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{event.metadata.treatment_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(event.metadata.scheduled_date!), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOverdue ? (
                        <Badge variant="destructive">Overdue</Badge>
                      ) : isDueToday ? (
                        <Badge className="bg-orange-500">Today</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Tomorrow</Badge>
                      )}
                      {!readOnly && (
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-green-600 hover:bg-green-100 hover:text-green-700"
                            onClick={() => handleMarkComplete(schedule)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:bg-muted"
                            onClick={() => handleSkip(schedule.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Timeline */}
          {allEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-4">
              No health events recorded yet
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
                        const Icon = config.icon;
                        const isScheduled = event.event_type === 'vaccination_scheduled' || event.event_type === 'deworming_scheduled';
                        const isHealthVisit = event.event_type === 'health_visit';

                        return (
                          <div key={event.id} className="relative">
                            <div className={`absolute -left-[25px] p-1 rounded-full bg-background border-2 ${config.color}`}>
                              <Icon className="h-3 w-3" />
                            </div>
                            <div className="pb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">
                                  {isHealthVisit ? 'Health Visit' : event.metadata.treatment_name || config.label}
                                </span>
                                <Badge variant="outline" className="text-[10px]">
                                  {format(new Date(event.event_date), 'MMM d')}
                                </Badge>
                                {/* Status badges for preventive items */}
                                {event.metadata.is_overdue && (
                                  <Badge variant="destructive" className="text-[10px]">Overdue</Badge>
                                )}
                                {event.metadata.status === 'completed' && (
                                  <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Done</Badge>
                                )}
                                {event.metadata.status === 'skipped' && (
                                  <Badge variant="secondary" className="text-[10px] bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">Skipped</Badge>
                                )}
                                {/* Action buttons */}
                                {!readOnly && isHealthVisit && (
                                  <div className="flex gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => setEditingRecord(event.metadata.original_record)}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-destructive hover:text-destructive"
                                      onClick={() => setDeletingRecord(event.metadata.original_record)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                                {!readOnly && isScheduled && (
                                  <div className="flex gap-0.5">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 text-green-600 hover:bg-green-100 hover:text-green-700"
                                      onClick={() => handleMarkComplete(event.metadata.original_record)}
                                    >
                                      <Check className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 text-muted-foreground hover:bg-muted"
                                      onClick={() => handleSkip(event.metadata.original_id)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(event.event_date), { addSuffix: true })}
                              </p>
                              {/* Health visit details */}
                              {isHealthVisit && event.metadata.diagnosis && (
                                <p className="text-xs text-muted-foreground mt-1">Diagnosis: {event.metadata.diagnosis}</p>
                              )}
                              {isHealthVisit && event.metadata.treatment && (
                                <p className="text-xs text-muted-foreground">Treatment: {event.metadata.treatment}</p>
                              )}
                              {event.notes && (
                                <p className="text-xs text-muted-foreground mt-1">{event.notes}</p>
                              )}
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
      </Card>

      {/* Dialogs */}
      {farmId && (
        <RecordSingleHealthDialog
          open={showHealthDialog}
          onOpenChange={setShowHealthDialog}
          animalId={animalId}
          animalName={animalName || earTag || 'Unknown'}
          earTag={earTag}
          farmId={farmId}
          animalFarmEntryDate={animalFarmEntryDate}
          onSuccess={loadHealthRecords}
        />
      )}

      {editingRecord && (
        <EditHealthRecordDialog
          open={!!editingRecord}
          onOpenChange={(open) => !open && setEditingRecord(null)}
          record={editingRecord}
          animalName={animalName || earTag || 'Unknown'}
          onSuccess={loadHealthRecords}
        />
      )}

      {deletingRecord && (
        <DeleteHealthRecordDialog
          open={!!deletingRecord}
          onOpenChange={(open) => !open && setDeletingRecord(null)}
          record={deletingRecord}
          animalName={animalName || earTag || 'Unknown'}
          onDelete={handleDeleteHealthRecord}
        />
      )}

      <AddPreventiveHealthDialog
        animalId={animalId}
        farmId={farmId}
        livestockType={livestockType}
        open={showPreventiveDialog}
        onOpenChange={setShowPreventiveDialog}
        defaultScheduleType={preventiveScheduleType}
      />

      {/* Complete & Schedule Next dialog */}
      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Complete</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedSchedule?.recurring_interval_months ? (
                <>
                  This is a recurring {selectedSchedule.schedule_type}. Would you like to schedule
                  the next one automatically?
                </>
              ) : (
                <>Mark this {selectedSchedule?.schedule_type} as completed?</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {selectedSchedule?.recurring_interval_months ? (
              <>
                <Button variant="outline" onClick={() => confirmComplete(false)}>
                  Complete Only
                </Button>
                <AlertDialogAction onClick={() => confirmComplete(true)}>
                  Complete & Schedule Next
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction onClick={() => confirmComplete(false)}>
                Complete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
