import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useGrowthBenchmark } from '@/hooks/useGrowthBenchmark';

interface GrowthBenchmarkCardProps {
  animalId: string;
  animalData: {
    birth_date: string | null;
    gender: string | null;
    life_stage: string | null;
    current_weight_kg: number | null;
    livestock_type: string;
  } | null;
}

export function GrowthBenchmarkCard({ animalId, animalData }: GrowthBenchmarkCardProps) {
  const { benchmark } = useGrowthBenchmark(animalId, animalData);

  if (!benchmark) {
    return null;
  }

  const statusConfig = {
    on_track: {
      icon: TrendingUp,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-950/20',
      badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      label: 'On Track',
    },
    above: {
      icon: TrendingUp,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/20',
      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      label: 'Above Expected',
    },
    below: {
      icon: TrendingDown,
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-50 dark:bg-yellow-950/20',
      badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      label: 'Below Expected',
    },
    critical: {
      icon: AlertTriangle,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950/20',
      badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      label: 'Critical',
    },
  };

  const config = statusConfig[benchmark.status];
  const StatusIcon = config.icon;

  // Calculate progress percentage (clamped to 0-100 for display)
  const progressPercent = Math.min(Math.max(benchmark.percentOfExpected, 0), 150);

  return (
    <Card className={cn('border', config.bg)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <StatusIcon className={cn('h-5 w-5', config.color)} />
            Growth Benchmark
          </CardTitle>
          <Badge variant="outline" className={config.badge}>
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Weight Comparison */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Current Weight</p>
            <p className="text-2xl font-bold">{benchmark.currentWeight} kg</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Expected Weight</p>
            <p className="text-2xl font-bold text-muted-foreground">{Math.round(benchmark.expectedWeight)} kg</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{benchmark.percentOfExpected}% of expected</span>
            {benchmark.expectedRange && (
              <span className="text-muted-foreground">
                Range: {benchmark.expectedRange.min}-{benchmark.expectedRange.max} kg
              </span>
            )}
          </div>
          <Progress
            value={progressPercent > 100 ? 100 : progressPercent}
            className="h-2"
          />
        </div>

        {/* Monthly Growth Rate */}
        {(benchmark.monthlyGainActual !== null || benchmark.monthlyGainExpected !== null) && (
          <div className="flex items-center gap-4 text-sm">
            {benchmark.monthlyGainActual !== null && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Actual gain:</span>
                <span className="font-medium">{benchmark.monthlyGainActual} kg/mo</span>
              </div>
            )}
            {benchmark.monthlyGainExpected !== null && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Expected:</span>
                <span className="font-medium">{benchmark.monthlyGainExpected} kg/mo</span>
              </div>
            )}
          </div>
        )}

        {/* ADG Section */}
        {benchmark.adgActual !== null && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Average Daily Gain</p>
              <p className="text-xl font-bold">{benchmark.adgActual} g/day</p>
              {benchmark.adgStatus && (
                <p className={cn(
                  "text-xs font-medium capitalize",
                  benchmark.adgStatus === 'excellent' && "text-green-600 dark:text-green-400",
                  benchmark.adgStatus === 'good' && "text-blue-600 dark:text-blue-400",
                  benchmark.adgStatus === 'fair' && "text-yellow-600 dark:text-yellow-400",
                  benchmark.adgStatus === 'poor' && "text-red-600 dark:text-red-400"
                )}>
                  {benchmark.adgStatus} ({benchmark.adgPercentOfExpected}% of expected)
                </p>
              )}
            </div>
            {benchmark.adgExpected && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Expected</p>
                <p className="text-lg font-medium text-muted-foreground">
                  {benchmark.adgExpected} g/day
                </p>
              </div>
            )}
          </div>
        )}

        {/* Recommendation */}
        <div className={cn('rounded-lg p-3 text-sm', config.bg)}>
          <p className={cn('font-medium', config.color)}>{benchmark.recommendation}</p>
          <p className="text-muted-foreground mt-1 italic">{benchmark.recommendationTagalog}</p>
        </div>
      </CardContent>
    </Card>
  );
}
