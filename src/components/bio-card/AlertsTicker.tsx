import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Calendar, Syringe, Activity } from "lucide-react";
import type { UpcomingAlert } from "@/hooks/useUpcomingAlerts";

interface AlertsTickerProps {
  alerts: UpcomingAlert[];
  maxAlerts?: number;
  className?: string;
}

const alertIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  vaccination: Syringe,
  deworming: Activity,
  heat: Calendar,
  default: AlertTriangle,
};

const alertColors: Record<string, string> = {
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
  urgent: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  upcoming: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
  default: 'bg-muted text-muted-foreground border-border',
};

export function AlertsTicker({ alerts, maxAlerts = 3, className }: AlertsTickerProps) {
  if (alerts.length === 0) {
    return null;
  }

  const displayAlerts = alerts.slice(0, maxAlerts);
  const remainingCount = Math.max(0, alerts.length - maxAlerts);

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs text-muted-foreground font-medium">
        Alerts <span className="text-muted-foreground/70">(Mga Babala)</span>
      </p>
      
      <div className="flex flex-wrap gap-1.5">
        {displayAlerts.map((alert, index) => {
          const Icon = alertIcons[alert.alert_type] || alertIcons.default;
          const colorClass = alertColors[alert.urgency] || alertColors.default;

          return (
            <Badge
              key={`${alert.schedule_id}-${index}`}
              variant="outline"
              className={cn(
                "gap-1 text-xs py-0.5 px-2 border",
                colorClass
              )}
            >
              <Icon className="w-3 h-3" />
              <span className="truncate max-w-[120px]">
                {alert.alert_title || alert.alert_type}
              </span>
              <span className="text-[10px] opacity-80">
                {formatDaysUntil(alert.days_until_due)}
              </span>
            </Badge>
          );
        })}
        
        {remainingCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            +{remainingCount} more
          </Badge>
        )}
      </div>
    </div>
  );
}

function formatDaysUntil(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days}d`;
}
