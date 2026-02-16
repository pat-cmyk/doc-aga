import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, ChevronDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

// ─── SSOT Types ─────────────────────────────────────────────
export type OVRTier = 'bronze' | 'silver' | 'gold' | 'diamond';
export type OVRTrend = 'up' | 'down' | 'stable';

export interface OVRBreakdown {
  production: number;
  health: number;
  fertility: number;
  growth: number;
  bodyCondition: number;
}

// ─── SSOT Constants ─────────────────────────────────────────
const tierGradients: Record<OVRTier, { from: string; to: string; glow: string }> = {
  bronze: { from: '#CD7F32', to: '#8B4513', glow: 'rgba(205, 127, 50, 0.4)' },
  silver: { from: '#C0C0C0', to: '#808080', glow: 'rgba(192, 192, 192, 0.4)' },
  gold: { from: '#FFD700', to: '#DAA520', glow: 'rgba(255, 215, 0, 0.4)' },
  diamond: { from: '#00CED1', to: '#4169E1', glow: 'rgba(0, 206, 209, 0.5)' },
};

const tierPillStyles: Record<OVRTier, string> = {
  bronze: 'bg-gradient-to-r from-amber-700 to-amber-600 text-white',
  silver: 'bg-gradient-to-r from-slate-400 to-slate-300 text-slate-900',
  gold: 'bg-gradient-to-r from-yellow-500 to-amber-400 text-amber-950',
  diamond: 'bg-gradient-to-r from-cyan-400 to-blue-400 text-blue-950',
};

const tierLabels: Record<OVRTier, { en: string; tl: string }> = {
  bronze: { en: 'Bronze', tl: 'Tanso' },
  silver: { en: 'Silver', tl: 'Pilak' },
  gold: { en: 'Gold', tl: 'Ginto' },
  diamond: { en: 'Diamond', tl: 'Diyamante' },
};

const breakdownLabels: Record<keyof OVRBreakdown, { en: string; tl: string }> = {
  production: { en: 'Production', tl: 'Produksyon' },
  health: { en: 'Health', tl: 'Kalusugan' },
  fertility: { en: 'Fertility', tl: 'Pagpaparami' },
  growth: { en: 'Growth', tl: 'Paglaki' },
  bodyCondition: { en: 'Body Condition', tl: 'Kondisyon ng Katawan' },
};

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
};

// ─── Component Interface ────────────────────────────────────
interface OVRScoreProps {
  score: number;
  tier: OVRTier;
  trend?: OVRTrend;
  variant?: 'pill' | 'hexagon' | 'text';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  breakdown?: OVRBreakdown;
  className?: string;
}

// ─── Pill Variant ───────────────────────────────────────────
const pillSizeStyles = {
  xs: 'text-[10px] px-1.5 py-0 h-5 gap-0.5',
  sm: 'text-xs px-2 py-0.5 h-6 gap-1',
  md: 'text-xs px-2 py-0.5 h-6 gap-1',
  lg: 'text-sm px-2.5 py-1 h-7 gap-1',
};

function PillVariant({ score, tier, trend = 'stable', size = 'xs', className }: OVRScoreProps) {
  const TrendIcon = trendIcons[trend];
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center rounded-full font-semibold shrink-0',
              tierPillStyles[tier],
              pillSizeStyles[size],
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
          <p className="font-medium">OVR: {score} ({tierLabels[tier].en})</p>
          <p className="text-muted-foreground">Overall Performance Rating</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Hexagon Variant ────────────────────────────────────────
const hexSizeClasses = {
  xs: { badge: 'w-10 h-12', text: 'text-sm', tier: 'text-[6px]' },
  sm: { badge: 'w-14 h-16', text: 'text-lg', tier: 'text-[8px]' },
  md: { badge: 'w-20 h-24', text: 'text-2xl', tier: 'text-[10px]' },
  lg: { badge: 'w-28 h-32', text: 'text-3xl', tier: 'text-xs' },
};

function HexagonVariant({ score, tier, trend = 'stable', breakdown, size = 'md', className }: OVRScoreProps) {
  const [isOpen, setIsOpen] = useState(false);
  const gradient = tierGradients[tier];
  const label = tierLabels[tier];
  const sizes = hexSizeClasses[size];

  const TrendIcon = trendIcons[trend];
  const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          className={cn(
            "relative flex flex-col items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95",
            sizes.badge,
            className
          )}
          style={{ filter: `drop-shadow(0 0 8px ${gradient.glow})` }}
        >
          <svg viewBox="0 0 100 115" className="absolute inset-0 w-full h-full">
            <defs>
              <linearGradient id={`ovr-gradient-${tier}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={gradient.from} />
                <stop offset="100%" stopColor={gradient.to} />
              </linearGradient>
            </defs>
            <path
              d="M50 0 L93.3 25 L93.3 75 L50 100 L6.7 75 L6.7 25 Z"
              fill={`url(#ovr-gradient-${tier})`}
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="2"
            />
          </svg>
          <span className={cn("relative z-10 font-bold text-white", sizes.text)}>
            {Math.round(score)}
          </span>
          <span className={cn("relative z-10 text-white/90 font-medium uppercase tracking-wider", sizes.tier)}>
            {label.en}
          </span>
          <TrendIcon className={cn("absolute -bottom-1 -right-1 w-4 h-4", trendColor)} />
          <ChevronDown className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 text-muted-foreground animate-bounce" />
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Performance Breakdown</span>
            <span className="text-muted-foreground text-sm font-normal">(Detalye ng Pagganap)</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm text-muted-foreground">Overall Rating</p>
              <p className="text-3xl font-bold">{Math.round(score)}</p>
            </div>
            <div
              className="px-3 py-1 rounded-full text-white font-medium text-sm"
              style={{ background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` }}
            >
              {label.en} ({label.tl})
            </div>
          </div>

          {breakdown && (
            <div className="space-y-3">
              {(Object.keys(breakdown) as Array<keyof OVRBreakdown>).map((key) => {
                const value = breakdown[key];
                const lbl = breakdownLabels[key];
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {lbl.en} <span className="text-muted-foreground">({lbl.tl})</span>
                      </span>
                      <span className="font-medium">{Math.round(value)}</span>
                    </div>
                    <Progress value={value} className="h-2" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Text Variant ───────────────────────────────────────────
function TextVariant({ score, tier, className }: OVRScoreProps) {
  return (
    <span className={cn("text-sm font-medium", className)}>
      OVR {score}
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────────
export function OVRScore(props: OVRScoreProps) {
  const { variant = 'pill' } = props;

  switch (variant) {
    case 'hexagon':
      return <HexagonVariant {...props} />;
    case 'text':
      return <TextVariant {...props} />;
    case 'pill':
    default:
      return <PillVariant {...props} />;
  }
}
