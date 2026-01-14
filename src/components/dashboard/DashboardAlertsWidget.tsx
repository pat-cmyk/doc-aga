import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  AlertTriangle, 
  Syringe, 
  Bug, 
  Baby, 
  ChevronDown, 
  ChevronUp,
  Bell,
  Check,
  Scale,
  HelpCircle,
  Pencil,
  Milk,
  Wheat,
  UserX,
  CalendarX2
} from 'lucide-react';
import { format } from 'date-fns';
import { useUpcomingAlerts, groupAlertsByType, getUrgencyColor, getUrgencyLabel, UpcomingAlert } from '@/hooks/useUpcomingAlerts';
import { useMarkScheduleComplete } from '@/hooks/usePreventiveHealth';
import { useWeightDataCompleteness } from '@/hooks/useWeightDataCompleteness';
import { useAnimalsMissingEntryWeight } from '@/hooks/useAnimalsMissingEntryWeight';
import { useMissingActivityAlerts, MissingActivityAlert } from '@/hooks/useMissingActivityAlerts';
import { useDataGapAlerts, getGapUrgencyColor, DataGapAlert } from '@/hooks/useDataGapAlerts';
import { useNavigate } from 'react-router-dom';
import { useOperationDialogs } from '@/hooks/useOperationDialogs';
import { OperationDialogs } from '@/components/operations/OperationDialogs';

interface DashboardAlertsWidgetProps {
  farmId: string;
}

export function DashboardAlertsWidget({ farmId }: DashboardAlertsWidgetProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { data: alerts = [], isLoading } = useUpcomingAlerts(farmId);
  const { data: weightData } = useWeightDataCompleteness(farmId);
  const { data: animalsMissingWeight = [] } = useAnimalsMissingEntryWeight(farmId, 3);
  const { alerts: activityAlerts } = useMissingActivityAlerts(farmId);
  const { data: gapData } = useDataGapAlerts(farmId);
  const markComplete = useMarkScheduleComplete();
  const navigate = useNavigate();
  const {
    isRecordFeedOpen,
    isRecordMilkOpen,
    openFeedDialog,
    openMilkDialog,
    setRecordFeedOpen,
    setRecordMilkOpen,
  } = useOperationDialogs();

  const groupedAlerts = groupAlertsByType(alerts);
  const overdueCount = alerts.filter((a) => a.urgency === 'overdue').length;
  const urgentCount = alerts.filter((a) => a.urgency === 'urgent').length;
  const urgentActivityAlerts = activityAlerts.filter(a => a.urgency === 'urgent');
  const criticalGapAlerts = gapData?.alerts.filter(a => a.urgency === 'critical') || [];
  
  // Weight data alert
  const missingWeightCount = weightData?.missingEntryWeight || 0;

  const handleQuickComplete = async (alert: UpcomingAlert) => {
    if (alert.alert_type === 'vaccination' || alert.alert_type === 'deworming') {
      await markComplete.mutateAsync({
        scheduleId: alert.schedule_id,
        completedDate: format(new Date(), 'yyyy-MM-dd'),
        createNextSchedule: true,
      });
    }
  };

  const handleViewAnimal = (animalId: string) => {
    navigate(`/?tab=animals&animalId=${animalId}`);
  };

  const handleViewAnimalsWithMissingWeight = () => {
    navigate('/?tab=animals&filter=missing-weight');
  };

  const handleEditAnimalWeight = (animalId: string) => {
    navigate(`/?tab=animals&animalId=${animalId}&editWeight=true`);
  };

  if (isLoading) {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Total alert count includes weight warning, activity alerts, and data gap alerts
  const totalAlertCount = alerts.length + (missingWeightCount > 0 ? 1 : 0) + urgentActivityAlerts.length + criticalGapAlerts.length;
  const hasDataGaps = criticalGapAlerts.length > 0;

  if (totalAlertCount === 0) {
    return null; // Don't show widget if no alerts
  }

  const getActivityAlertIcon = (alertType: MissingActivityAlert['alertType']) => {
    switch (alertType) {
      case 'missing_milking': return <Milk className="h-4 w-4" />;
      case 'no_feeding': return <Wheat className="h-4 w-4" />;
      case 'inactive_farmhand': return <UserX className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getActivityAlertColor = (urgency: MissingActivityAlert['urgency']) => {
    switch (urgency) {
      case 'urgent': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
      case 'warning': return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400';
      default: return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
    }
  };

  return (
    <Card className={`mb-4 ${hasDataGaps ? 'border-destructive/50' : overdueCount > 0 ? 'border-destructive/50' : urgentCount > 0 ? 'border-orange-300 dark:border-orange-800' : ''}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Upcoming Tasks
                <Badge variant="secondary" className="ml-1">
                  {totalAlertCount}
                </Badge>
                {overdueCount > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    {overdueCount} overdue
                  </Badge>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Critical Data Gap Alerts - Show FIRST */}
            {criticalGapAlerts.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-full bg-destructive/10 text-destructive">
                    <CalendarX2 className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">Missing Records</span>
                  <Badge variant="destructive" className="text-xs">
                    Critical
                  </Badge>
                </div>
                <div className="space-y-2 ml-8">
                  {criticalGapAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${getGapUrgencyColor(alert.urgency)}`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="p-1 rounded-full bg-destructive/10 text-destructive">
                          {alert.alertType === 'milking_gap' ? <Milk className="h-4 w-4" /> : <Wheat className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {alert.title}
                          </p>
                          <p className="text-xs opacity-75 truncate">
                            {alert.description}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 ml-2 h-8 text-xs"
                        onClick={alert.alertType === 'milking_gap' ? openMilkDialog : openFeedDialog}
                      >
                        Catch Up
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Activity Alerts */}
            {urgentActivityAlerts.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-full text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">Activity Alerts</span>
                  <Badge variant="destructive" className="text-xs">
                    {urgentActivityAlerts.length}
                  </Badge>
                </div>
                <div className="space-y-2 ml-8">
                  {urgentActivityAlerts.slice(0, 3).map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`p-1 rounded-full ${getActivityAlertColor(alert.urgency)}`}>
                          {getActivityAlertIcon(alert.alertType)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-red-900 dark:text-red-100 truncate">
                            {alert.title}
                          </p>
                          <p className="text-xs text-red-600 dark:text-red-400 truncate">
                            {alert.description}
                          </p>
                        </div>
                      </div>
                      {alert.alertType === 'missing_milking' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 ml-2 h-8 text-xs"
                          onClick={openMilkDialog}
                        >
                          Record
                        </Button>
                      )}
                      {alert.alertType === 'no_feeding' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 ml-2 h-8 text-xs"
                          onClick={openFeedDialog}
                        >
                          Record
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vaccinations */}
            {groupedAlerts.vaccination.length > 0 && (
              <AlertSection
                title="Vaccinations"
                icon={<Syringe className="h-4 w-4" />}
                alerts={groupedAlerts.vaccination}
                onComplete={handleQuickComplete}
                onViewAnimal={handleViewAnimal}
                iconColor="text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
              />
            )}

            {/* Deworming */}
            {groupedAlerts.deworming.length > 0 && (
              <AlertSection
                title="Deworming"
                icon={<Bug className="h-4 w-4" />}
                alerts={groupedAlerts.deworming}
                onComplete={handleQuickComplete}
                onViewAnimal={handleViewAnimal}
                iconColor="text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400"
              />
            )}

            {/* Deliveries */}
            {groupedAlerts.delivery.length > 0 && (
              <AlertSection
                title="Expected Deliveries"
                icon={<Baby className="h-4 w-4" />}
                alerts={groupedAlerts.delivery}
                onViewAnimal={handleViewAnimal}
                iconColor="text-pink-600 bg-pink-100 dark:bg-pink-900/30 dark:text-pink-400"
              />
            )}

            {/* Missing Weight Data Alert */}
            {missingWeightCount > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-full text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400">
                    <Scale className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">Weight Data Incomplete</span>
                  <Badge variant="outline" className="text-xs">
                    {missingWeightCount}
                  </Badge>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-1 rounded-full hover:bg-muted">
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[250px]">
                        <p className="text-xs">
                          Animals with no entry weight recorded and not marked as "Unknown". 
                          Entry weight is needed for accurate feed forecasting and growth tracking.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="space-y-2 ml-8">
                  {/* Show specific animals */}
                  {animalsMissingWeight.map((animal) => (
                    <div
                      key={animal.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30"
                    >
                      <button
                        onClick={() => handleViewAnimal(animal.id)}
                        className="flex-1 text-left min-h-[44px] active:opacity-70 transition-opacity"
                      >
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100 truncate max-w-[180px]">
                          {animal.name || animal.ear_tag || 'Unnamed animal'}
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          Missing entry weight
                        </p>
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-11 w-11 shrink-0 ml-2 active:scale-95 transition-transform text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditAnimalWeight(animal.id);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  {/* Show "more" link if there are additional animals */}
                  {missingWeightCount > 3 && (
                    <button
                      onClick={handleViewAnimalsWithMissingWeight}
                      className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      +{missingWeightCount - 3} more animals
                    </button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      <OperationDialogs
        farmId={farmId}
        isRecordFeedOpen={isRecordFeedOpen}
        onRecordFeedOpenChange={setRecordFeedOpen}
        isRecordMilkOpen={isRecordMilkOpen}
        onRecordMilkOpenChange={setRecordMilkOpen}
      />
    </Card>
  );
}

interface AlertSectionProps {
  title: string;
  icon: React.ReactNode;
  alerts: UpcomingAlert[];
  onComplete?: (alert: UpcomingAlert) => void;
  onViewAnimal: (animalId: string) => void;
  iconColor: string;
}

function AlertSection({ title, icon, alerts, onComplete, onViewAnimal, iconColor }: AlertSectionProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-full ${iconColor}`}>{icon}</div>
        <span className="text-sm font-medium">{title}</span>
        <Badge variant="outline" className="text-xs">
          {alerts.length}
        </Badge>
      </div>
      <div className="space-y-2 ml-8">
        {alerts.slice(0, 3).map((alert) => (
          <AlertItem
            key={alert.schedule_id}
            alert={alert}
            onComplete={onComplete ? () => onComplete(alert) : undefined}
            onViewAnimal={() => onViewAnimal(alert.animal_id)}
          />
        ))}
        {alerts.length > 3 && (
          <p className="text-xs text-muted-foreground">
            +{alerts.length - 3} more
          </p>
        )}
      </div>
    </div>
  );
}

interface AlertItemProps {
  alert: UpcomingAlert;
  onComplete?: () => void;
  onViewAnimal: () => void;
}

function AlertItem({ alert, onComplete, onViewAnimal }: AlertItemProps) {
  const urgencyColor = getUrgencyColor(alert.urgency);
  const urgencyLabel = getUrgencyLabel(alert.urgency, alert.days_until_due);

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${urgencyColor}`}>
      <button
        onClick={onViewAnimal}
        className="flex-1 text-left min-h-[44px] active:opacity-70 transition-opacity"
      >
        <p className="text-sm font-medium truncate max-w-[180px]">
          {alert.animal_name || alert.animal_ear_tag || 'Unknown'}
        </p>
        <p className="text-xs opacity-75 mt-0.5">
          {alert.alert_title} • {urgencyLabel}
        </p>
      </button>
      {onComplete && (
        <Button
          size="icon"
          variant="ghost"
          className="h-11 w-11 shrink-0 ml-2 active:scale-95 transition-transform"
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
        >
          <Check className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
