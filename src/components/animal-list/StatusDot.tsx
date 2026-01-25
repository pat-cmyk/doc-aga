import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type StatusDotType = 'green' | 'yellow' | 'red';

interface StatusDotProps {
  status: StatusDotType;
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

const statusStyles: Record<StatusDotType, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

const statusLabels: Record<StatusDotType, { en: string; tl: string }> = {
  green: { en: 'Healthy', tl: 'Malusog' },
  yellow: { en: 'Needs Attention', tl: 'Kailangang Pansin' },
  red: { en: 'Critical', tl: 'Kritikal' },
};

const sizeStyles = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
};

export function StatusDot({
  status,
  size = 'sm',
  pulse = true,
  className,
}: StatusDotProps) {
  const shouldPulse = pulse && (status === 'yellow' || status === 'red');
  
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-block rounded-full shrink-0',
              statusStyles[status],
              sizeStyles[size],
              shouldPulse && 'animate-pulse',
              className
            )}
            aria-label={statusLabels[status].en}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium">{statusLabels[status].en}</p>
          <p className="text-muted-foreground">{statusLabels[status].tl}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
