import { Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useBodyConditionScores } from '@/hooks/useBodyConditionScores';

interface BCSIndicatorProps {
  animalId: string;
  className?: string;
  showLabel?: boolean;
}

export function BCSIndicator({ animalId, className, showLabel = false }: BCSIndicatorProps) {
  const { latestBCS, getBCSStatus } = useBodyConditionScores(animalId);

  if (!latestBCS) {
    return null;
  }

  const status = getBCSStatus(latestBCS.score);

  const colorClasses: Record<string, string> = {
    good: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'gap-1 font-mono',
              colorClasses[status.status],
              className
            )}
          >
            <Scale className="h-3 w-3" />
            BCS {latestBCS.score.toFixed(1)}
            {showLabel && <span className="hidden sm:inline">- {status.label}</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{status.label}</p>
          <p className="text-xs text-muted-foreground">
            Last assessed: {new Date(latestBCS.assessment_date).toLocaleDateString()}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
