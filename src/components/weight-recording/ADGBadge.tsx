import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ADGResult, ADGStatus } from '@/lib/growthMetrics';

interface ADGBadgeProps {
  adgResult: ADGResult | null;
  showDays?: boolean;
  size?: 'sm' | 'md';
  showStatus?: boolean;
}

const statusConfig: Record<ADGStatus, { color: string; icon: typeof TrendingUp; label: string }> = {
  excellent: {
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
    icon: TrendingUp,
    label: 'Excellent',
  },
  good: {
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    icon: TrendingUp,
    label: 'Good',
  },
  fair: {
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    icon: Minus,
    label: 'Fair',
  },
  poor: {
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
    icon: TrendingDown,
    label: 'Poor',
  },
};

export function ADGBadge({ adgResult, showDays = false, size = 'sm', showStatus = false }: ADGBadgeProps) {
  if (!adgResult) return null;

  const config = statusConfig[adgResult.status];
  const StatusIcon = config.icon;
  const isNegative = adgResult.adgGrams < 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'font-medium cursor-help',
              config.color,
              size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1'
            )}
          >
            <StatusIcon className={cn('mr-1', size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />
            {isNegative ? '' : '+'}
            {adgResult.adgGrams} g/day
            {showDays && (
              <span className="ml-1 opacity-70">({adgResult.daysBetween}d)</span>
            )}
            {showStatus && (
              <span className="ml-1 capitalize">• {config.label}</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1 text-sm">
            <p className="font-medium">Average Daily Gain</p>
            <p>
              {isNegative ? 'Lost' : 'Gained'} {Math.abs(adgResult.totalGainKg)} kg over {adgResult.daysBetween} days
            </p>
            <p className="text-muted-foreground">
              {adgResult.percentOfExpected}% of expected • {config.label}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
