import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Syringe, Bug, Check, X, Calendar, AlertTriangle } from 'lucide-react';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { usePreventiveHealthSchedules, useMarkScheduleComplete, useSkipSchedule, PreventiveHealthSchedule } from '@/hooks/usePreventiveHealth';
import { AddPreventiveHealthDialog } from './AddPreventiveHealthDialog';
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

interface PreventiveHealthTabProps {
  animalId: string;
  farmId: string;
  livestockType: string;
}

export function PreventiveHealthTab({ animalId, farmId, livestockType }: PreventiveHealthTabProps) {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<PreventiveHealthSchedule | null>(null);

  const { data: schedules = [], isLoading } = usePreventiveHealthSchedules(animalId);
  const markComplete = useMarkScheduleComplete();
  const skipSchedule = useSkipSchedule();

  const upcomingSchedules = schedules.filter(
    (s) => s.status === 'scheduled' || s.status === 'overdue'
  );
  const completedSchedules = schedules.filter(
    (s) => s.status === 'completed' || s.status === 'skipped'
  );

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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Syringe className="h-5 w-5" />
              Preventive Health
            </CardTitle>
            <AddPreventiveHealthDialog
              animalId={animalId}
              farmId={farmId}
              livestockType={livestockType}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upcoming' | 'history')}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="upcoming" className="relative">
                Upcoming
                {upcomingSchedules.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                    {upcomingSchedules.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="space-y-3">
              {upcomingSchedules.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No upcoming schedules</p>
                  <p className="text-xs">Add vaccinations or deworming schedules</p>
                </div>
              ) : (
                upcomingSchedules.map((schedule) => (
                  <ScheduleCard
                    key={schedule.id}
                    schedule={schedule}
                    onComplete={() => handleMarkComplete(schedule)}
                    onSkip={() => handleSkip(schedule.id)}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-3">
              {completedSchedules.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">No completed schedules yet</p>
                </div>
              ) : (
                completedSchedules.map((schedule) => (
                  <ScheduleCard key={schedule.id} schedule={schedule} isHistory />
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

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

interface ScheduleCardProps {
  schedule: PreventiveHealthSchedule;
  onComplete?: () => void;
  onSkip?: () => void;
  isHistory?: boolean;
}

function ScheduleCard({ schedule, onComplete, onSkip, isHistory }: ScheduleCardProps) {
  const isOverdue = isPast(new Date(schedule.scheduled_date)) && schedule.status === 'scheduled';
  const isDueToday = isToday(new Date(schedule.scheduled_date));
  const isDueTomorrow = isTomorrow(new Date(schedule.scheduled_date));

  const getStatusBadge = () => {
    if (schedule.status === 'completed') {
      return <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Completed</Badge>;
    }
    if (schedule.status === 'skipped') {
      return <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">Skipped</Badge>;
    }
    if (isOverdue) {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    if (isDueToday) {
      return <Badge className="bg-orange-500">Today</Badge>;
    }
    if (isDueTomorrow) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Tomorrow</Badge>;
    }
    return <Badge variant="outline">Scheduled</Badge>;
  };

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border ${
        isOverdue
          ? 'border-destructive/50 bg-destructive/5'
          : isDueToday
          ? 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-full ${
            schedule.schedule_type === 'vaccination'
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
              : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
          }`}
        >
          {schedule.schedule_type === 'vaccination' ? (
            <Syringe className="h-4 w-4" />
          ) : (
            <Bug className="h-4 w-4" />
          )}
        </div>
        <div>
          <p className="font-medium text-sm">{schedule.treatment_name}</p>
          <p className="text-xs text-muted-foreground">
            {isHistory && schedule.completed_date
              ? `Completed: ${format(new Date(schedule.completed_date), 'MMM d, yyyy')}`
              : format(new Date(schedule.scheduled_date), 'MMM d, yyyy')}
          </p>
          {schedule.notes && (
            <p className="text-xs text-muted-foreground mt-1">{schedule.notes}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {getStatusBadge()}
        {!isHistory && (
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-green-600 hover:bg-green-100 hover:text-green-700"
              onClick={onComplete}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:bg-muted"
              onClick={onSkip}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
