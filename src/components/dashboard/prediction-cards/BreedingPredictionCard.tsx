import { Heart, Calendar, Baby } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { BreedingPrediction } from '@/hooks/usePredictiveInsights';
import { format } from 'date-fns';

interface BreedingPredictionCardProps {
  prediction: BreedingPrediction;
}

export function BreedingPredictionCard({ prediction }: BreedingPredictionCardProps) {
  const hasDeliveries = prediction.deliveryAlerts.length > 0;
  const hasHeatPredictions = prediction.nextHeatPredictions.length > 0;

  return (
    <div className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-full bg-pink-100 dark:bg-pink-900/30">
          <Heart className="h-4 w-4 text-pink-600 dark:text-pink-400" />
        </div>
        <span className="font-medium text-sm">Breeding & Reproduction</span>
      </div>

      <div className="space-y-3">
        {/* Success Rate */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">AI Success Rate</span>
          <Badge variant={prediction.successRateForecast >= 60 ? 'default' : 'secondary'}>
            {prediction.successRateForecast}%
          </Badge>
        </div>

        {/* Upcoming Deliveries */}
        {hasDeliveries && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <Baby className="h-3.5 w-3.5 text-primary" />
              <span>Upcoming Deliveries</span>
            </div>
            <div className="space-y-1">
              {prediction.deliveryAlerts.slice(0, 2).map((alert, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1"
                >
                  <span className="text-muted-foreground truncate max-w-[100px]">
                    {alert.animalId.slice(0, 8)}...
                  </span>
                  <span className={`font-medium ${alert.daysUntil <= 7 ? 'text-orange-500' : ''}`}>
                    {alert.daysUntil <= 0 ? 'Due now!' : `${alert.daysUntil}d`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Heat Predictions */}
        {hasHeatPredictions && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <Calendar className="h-3.5 w-3.5 text-orange-500" />
              <span>Predicted Heat</span>
            </div>
            <div className="space-y-1">
              {prediction.nextHeatPredictions.slice(0, 2).map((heat, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1"
                >
                  <span className="text-muted-foreground truncate max-w-[80px]">
                    {heat.animalId.slice(0, 8)}...
                  </span>
                  <span className="font-medium">
                    {format(new Date(heat.predictedDate), 'MMM d')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasDeliveries && !hasHeatPredictions && (
          <p className="text-xs text-muted-foreground italic">
            No upcoming breeding events predicted
          </p>
        )}

        <p className="text-xs text-muted-foreground leading-relaxed">
          {prediction.explanation}
        </p>
      </div>
    </div>
  );
}
