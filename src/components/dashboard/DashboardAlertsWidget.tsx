import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  AlertTriangle, 
  Syringe, 
  Bug, 
  Baby, 
  ChevronDown, 
  ChevronUp,
  Bell,
  Check,
  Scale
} from 'lucide-react';
import { format } from 'date-fns';
import { useUpcomingAlerts, groupAlertsByType, getUrgencyColor, getUrgencyLabel, UpcomingAlert } from '@/hooks/useUpcomingAlerts';
import { useMarkScheduleComplete } from '@/hooks/usePreventiveHealth';
import { useWeightDataCompleteness } from '@/hooks/useWeightDataCompleteness';
import { useNavigate } from 'react-router-dom';

interface DashboardAlertsWidgetProps {
  farmId: string;
}

export function DashboardAlertsWidget({ farmId }: DashboardAlertsWidgetProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { data: alerts = [], isLoading } = useUpcomingAlerts(farmId);
  const { data: weightData } = useWeightDataCompleteness(farmId);
  const markComplete = useMarkScheduleComplete();
  const navigate = useNavigate();

  const groupedAlerts = groupAlertsByType(alerts);
  const overdueCount = alerts.filter((a) => a.urgency === 'overdue').length;
  const urgentCount = alerts.filter((a) => a.urgency === 'urgent').length;
  
  // Weight data alert
  const missingWeightCount = (weightData?.missingEntryWeight || 0) + (weightData?.unknownEntryWeight || 0);

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
    navigate(`/?animalId=${animalId}`);
  };

  const handleViewAnimalsWithMissingWeight = () => {
    navigate('/?filter=missing-weight');
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

  const totalAlertCount = alerts.length + (missingWeightCount > 0 ? 1 : 0);

  if (totalAlertCount === 0) {
    return null; // Don't show widget if no alerts
  }

  return (
    <Card className={`mb-4 ${overdueCount > 0 ? 'border-destructive/50' : urgentCount > 0 ? 'border-orange-300 dark:border-orange-800' : ''}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Upcoming Tasks
                <Badge variant="secondary" className="ml-1">
                  {alerts.length}
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
                </div>
                <div className="ml-8">
                  <button
                    onClick={handleViewAnimalsWithMissingWeight}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-left active:opacity-70 transition-opacity"
                  >
                    <div>
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        {missingWeightCount} animals missing weight data
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                        Affects feed forecast accuracy
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
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
