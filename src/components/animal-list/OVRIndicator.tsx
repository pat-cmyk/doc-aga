import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type OVRTier = 'bronze' | 'silver' | 'gold' | 'diamond';
export type OVRTrend = 'up' | 'down' | 'stable';

interface OVRIndicatorProps {
  score: number;
  tier: OVRTier;
  trend?: OVRTrend;
  size?: 'xs' | 'sm';
  className?: string;
}

const tierStyles: Record<OVRTier, string> = {
  bronze: 'bg-gradient-to-r from-amber-700 to-amber-600 text-white',
  silver: 'bg-gradient-to-r from-slate-400 to-slate-300 text-slate-900',
  gold: 'bg-gradient-to-r from-yellow-500 to-amber-400 text-amber-950',
  diamond: 'bg-gradient-to-r from-cyan-400 to-blue-400 text-blue-950',
};

const sizeStyles = {
  xs: 'text-[10px] px-1.5 py-0 h-5 gap-0.5',
  sm: 'text-xs px-2 py-0.5 h-6 gap-1',
};

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
};

const tierLabels: Record<OVRTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  diamond: 'Diamond',
};

export function OVRIndicator({
  score,
  tier,
  trend = 'stable',
  size = 'xs',
  className,
}: OVRIndicatorProps) {
  const TrendIcon = trendIcons[trend];
  
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center rounded-full font-semibold shrink-0',
              tierStyles[tier],
              sizeStyles[size],
              className
            )}
          >
            <span>{score}</span>
            <TrendIcon className={cn(
              'shrink-0',
              size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3',
              trend === 'up' && 'text-green-600',
              trend === 'down' && 'text-red-600'
            )} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium">OVR: {score} ({tierLabels[tier]})</p>
          <p className="text-muted-foreground">Overall Performance Rating</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
