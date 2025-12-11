import { Milk, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { MilkPrediction } from '@/hooks/usePredictiveInsights';

interface MilkPredictionCardProps {
  prediction: MilkPrediction;
}

export function MilkPredictionCard({ prediction }: MilkPredictionCardProps) {
  const TrendIcon = prediction.trend === 'up' 
    ? TrendingUp 
    : prediction.trend === 'down' 
      ? TrendingDown 
      : Minus;

  const trendColor = prediction.trend === 'up' 
    ? 'text-green-500' 
    : prediction.trend === 'down' 
      ? 'text-red-500' 
      : 'text-muted-foreground';

  const trendLabel = prediction.trend === 'up' 
    ? 'Increasing' 
    : prediction.trend === 'down' 
      ? 'Decreasing' 
      : 'Stable';

  return (
    <div className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
          <Milk className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <span className="font-medium text-sm">Milk Production</span>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{prediction.forecast7Days}L</span>
            <span className="text-xs text-muted-foreground">next 7 days</span>
          </div>
          <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
            <TrendIcon className="h-4 w-4" />
            <span>{trendLabel}</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Confidence</span>
            <span className="font-medium">{prediction.confidence}%</span>
          </div>
          <Progress value={prediction.confidence} className="h-1.5" />
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {prediction.explanation}
        </p>
      </div>
    </div>
  );
}
