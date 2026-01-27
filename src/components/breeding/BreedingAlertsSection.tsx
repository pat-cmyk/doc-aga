/**
 * BreedingAlertsSection Component
 * 
 * Displays breeding-specific alerts in the dashboard.
 * Can be used standalone or integrated into DashboardAlertsWidget.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, Calendar, Search, CheckCircle, AlertTriangle, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  useBreedingAlerts, 
  BreedingAlert, 
  BreedingAlertType,
  getBreedingAlertColor,
  groupBreedingAlertsByType 
} from '@/hooks/useBreedingAlerts';

interface BreedingAlertsSectionProps {
  farmId: string;
  onScheduleAI?: (animalId: string) => void;
  onConfirmPregnancy?: (animalId: string) => void;
  maxAlertsPerType?: number;
}

export function BreedingAlertsSection({ 
  farmId, 
  onScheduleAI,
  onConfirmPregnancy,
  maxAlertsPerType = 3 
}: BreedingAlertsSectionProps) {
  const { data: alerts = [], isLoading } = useBreedingAlerts(farmId);
  const navigate = useNavigate();

  if (isLoading || alerts.length === 0) {
    return null;
  }

  const grouped = groupBreedingAlertsByType(alerts);
  const criticalCount = alerts.filter(a => a.urgency === 'critical').length;

  const handleViewAnimal = (animalId: string) => {
    navigate(`/animal/${animalId}`);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-full ${criticalCount > 0 ? 'bg-destructive/10 text-destructive' : 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400'}`}>
          <Heart className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium">Breeding Alerts</span>
        <Badge variant={criticalCount > 0 ? 'destructive' : 'outline'} className="text-xs">
          {alerts.length}
        </Badge>
      </div>

      {/* Alert Groups */}
      <div className="space-y-3 ml-8">
        {/* In Heat - Most Urgent */}
        {grouped.in_heat.length > 0 && (
          <AlertGroup
            title="In Heat Now"
            titleTagalog="May Init Ngayon"
            icon={<Flame className="h-4 w-4" />}
            alerts={grouped.in_heat}
            maxAlerts={maxAlertsPerType}
            iconColor="text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400"
            onViewAnimal={handleViewAnimal}
            onAction={onScheduleAI}
            actionLabel="Schedule AI"
          />
        )}

        {/* Pregnancy Check Due */}
        {grouped.preg_check_due.length > 0 && (
          <AlertGroup
            title="Preg Check Due"
            titleTagalog="Kailangan ng Preg Check"
            icon={<Search className="h-4 w-4" />}
            alerts={grouped.preg_check_due}
            maxAlerts={maxAlertsPerType}
            iconColor="text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400"
            onViewAnimal={handleViewAnimal}
            onAction={onConfirmPregnancy}
            actionLabel="Confirm"
          />
        )}

        {/* Proestrus (Expected Heat Soon) */}
        {grouped.proestrus.length > 0 && (
          <AlertGroup
            title="Heat Expected Soon"
            titleTagalog="Malapit nang Mag-Init"
            icon={<Calendar className="h-4 w-4" />}
            alerts={grouped.proestrus}
            maxAlerts={maxAlertsPerType}
            iconColor="text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
            onViewAnimal={handleViewAnimal}
          />
        )}

        {/* VWP Ending */}
        {grouped.vwp_ending.length > 0 && (
          <AlertGroup
            title="Ready for Breeding"
            titleTagalog="Handa na para Magpalahi"
            icon={<CheckCircle className="h-4 w-4" />}
            alerts={grouped.vwp_ending}
            maxAlerts={maxAlertsPerType}
            iconColor="text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400"
            onViewAnimal={handleViewAnimal}
          />
        )}

        {/* Repeat Breeder */}
        {grouped.repeat_breeder.length > 0 && (
          <AlertGroup
            title="Repeat Breeders"
            titleTagalog="Paulit-ulit na Pagpapalahi"
            icon={<AlertTriangle className="h-4 w-4" />}
            alerts={grouped.repeat_breeder}
            maxAlerts={maxAlertsPerType}
            iconColor="text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400"
            onViewAnimal={handleViewAnimal}
          />
        )}
      </div>
    </div>
  );
}

interface AlertGroupProps {
  title: string;
  titleTagalog: string;
  icon: React.ReactNode;
  alerts: BreedingAlert[];
  maxAlerts: number;
  iconColor: string;
  onViewAnimal: (animalId: string) => void;
  onAction?: (animalId: string) => void;
  actionLabel?: string;
}

function AlertGroup({ 
  title, 
  icon, 
  alerts, 
  maxAlerts,
  iconColor,
  onViewAnimal,
  onAction,
  actionLabel,
}: AlertGroupProps) {
  const displayAlerts = alerts.slice(0, maxAlerts);
  const remainingCount = alerts.length - maxAlerts;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className={`p-1 rounded-full ${iconColor}`}>
          {icon}
        </div>
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        {alerts.length > 1 && (
          <Badge variant="outline" className="text-xs h-5">
            {alerts.length}
          </Badge>
        )}
      </div>
      
      <div className="space-y-1.5">
        {displayAlerts.map((alert) => (
          <BreedingAlertItem
            key={alert.id}
            alert={alert}
            onViewAnimal={onViewAnimal}
            onAction={onAction}
            actionLabel={actionLabel}
          />
        ))}
        {remainingCount > 0 && (
          <p className="text-xs text-muted-foreground pl-2">
            +{remainingCount} more
          </p>
        )}
      </div>
    </div>
  );
}

interface BreedingAlertItemProps {
  alert: BreedingAlert;
  onViewAnimal: (animalId: string) => void;
  onAction?: (animalId: string) => void;
  actionLabel?: string;
}

function BreedingAlertItem({ alert, onViewAnimal, onAction, actionLabel }: BreedingAlertItemProps) {
  const colorClasses = getBreedingAlertColor(alert.urgency);

  return (
    <div className={`flex items-center justify-between p-2.5 rounded-lg border ${colorClasses}`}>
      <button
        onClick={() => onViewAnimal(alert.animalId)}
        className="flex-1 text-left min-h-[40px] active:opacity-70 transition-opacity"
      >
        <p className="text-sm font-medium truncate max-w-[160px]">
          {alert.animalName || alert.animalEarTag || 'Unknown'}
        </p>
        <p className="text-xs opacity-75 mt-0.5 truncate max-w-[180px]">
          {alert.description}
        </p>
      </button>
      {onAction && actionLabel && (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 ml-2 h-8 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onAction(alert.animalId);
          }}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export default BreedingAlertsSection;
