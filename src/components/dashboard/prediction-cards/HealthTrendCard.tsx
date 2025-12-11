import { Activity, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { HealthPrediction } from '@/hooks/usePredictiveInsights';

interface HealthTrendCardProps {
  prediction: HealthPrediction;
}

export function HealthTrendCard({ prediction }: HealthTrendCardProps) {
  const riskConfig = {
    low: {
      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      icon: CheckCircle,
      label: 'Low Risk'
    },
    medium: {
      color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      icon: AlertTriangle,
      label: 'Medium Risk'
    },
    high: {
      color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      icon: AlertCircle,
      label: 'High Risk'
    }
  };

  const config = riskConfig[prediction.riskLevel];
  const RiskIcon = config.icon;

  return (
    <div className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <span className="font-medium text-sm">Health Trends</span>
      </div>

      <div className="space-y-3">
        {/* Risk Level Badge */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Overall Risk</span>
          <Badge className={config.color}>
            <RiskIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </div>

        {/* Overdue Count */}
        {prediction.overdueCount > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Overdue Vaccinations</span>
            <span className="font-medium text-orange-500">{prediction.overdueCount}</span>
          </div>
        )}

        {/* Potential Issues */}
        {prediction.potentialIssues.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium">Watch For:</span>
            <ul className="space-y-1">
              {prediction.potentialIssues.slice(0, 3).map((issue, idx) => (
                <li 
                  key={idx}
                  className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 flex items-start gap-1.5"
                >
                  <AlertTriangle className="h-3 w-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendation */}
        <div className="pt-1 border-t">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Tip: </span>
            {prediction.recommendation}
          </p>
        </div>
      </div>
    </div>
  );
}
