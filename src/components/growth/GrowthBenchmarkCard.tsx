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
      color: 'text-success',
      bg: 'bg-success-soft/60',
      badge: 'bg-success-soft text-success',
      label: 'On Track',
    },
    above: {
      icon: TrendingUp,
      color: 'text-info',
      bg: 'bg-info-soft/60',
      badge: 'bg-info-soft text-info',
      label: 'Above Expected',
    },
    below: {
      icon: TrendingDown,
      color: 'text-warning',
      bg: 'bg-warning-soft/60',
      badge: 'bg-warning-soft text-warning',
      label: 'Below Expected',
    },
    critical: {
      icon: AlertTriangle,
      color: 'text-destructive',
      bg: 'bg-destructive/5',
      badge: 'bg-destructive/10 text-destructive',
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
                  benchmark.adgStatus === 'excellent' && "text-success",
                  benchmark.adgStatus === 'good' && "text-info",
                  benchmark.adgStatus === 'fair' && "text-warning",
                  benchmark.adgStatus === 'poor' && "text-destructive"
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
