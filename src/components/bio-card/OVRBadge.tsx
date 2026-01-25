import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

export type OVRTier = 'bronze' | 'silver' | 'gold' | 'diamond';
export type OVRTrend = 'up' | 'down' | 'stable';

interface OVRBreakdown {
  production: number;
  health: number;
  fertility: number;
  growth: number;
  bodyCondition: number;
}

interface OVRBadgeProps {
  score: number;
  tier: OVRTier;
  trend: OVRTrend;
  breakdown: OVRBreakdown;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const tierGradients: Record<OVRTier, { from: string; to: string; glow: string }> = {
  bronze: { from: '#CD7F32', to: '#8B4513', glow: 'rgba(205, 127, 50, 0.4)' },
  silver: { from: '#C0C0C0', to: '#808080', glow: 'rgba(192, 192, 192, 0.4)' },
  gold: { from: '#FFD700', to: '#DAA520', glow: 'rgba(255, 215, 0, 0.4)' },
  diamond: { from: '#00CED1', to: '#4169E1', glow: 'rgba(0, 206, 209, 0.5)' },
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

const sizeClasses = {
  sm: { badge: 'w-14 h-16', text: 'text-lg', tier: 'text-[8px]' },
  md: { badge: 'w-20 h-24', text: 'text-2xl', tier: 'text-[10px]' },
  lg: { badge: 'w-28 h-32', text: 'text-3xl', tier: 'text-xs' },
};

export function OVRBadge({
  score,
  tier,
  trend,
  breakdown,
  size = 'md',
  className,
}: OVRBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const gradient = tierGradients[tier];
  const tierLabel = tierLabels[tier];
  const sizes = sizeClasses[size];

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
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
          style={{
            filter: `drop-shadow(0 0 8px ${gradient.glow})`,
          }}
        >
          {/* Hexagon SVG */}
          <svg
            viewBox="0 0 100 115"
            className="absolute inset-0 w-full h-full"
          >
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

          {/* Score */}
          <span className={cn("relative z-10 font-bold text-white", sizes.text)}>
            {Math.round(score)}
          </span>

          {/* Tier Label */}
          <span className={cn("relative z-10 text-white/90 font-medium uppercase tracking-wider", sizes.tier)}>
            {tierLabel.en}
          </span>

          {/* Trend Indicator */}
          <TrendIcon className={cn("absolute -bottom-1 -right-1 w-4 h-4", trendColor)} />

          {/* Expand hint */}
          <ChevronDown className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 text-muted-foreground animate-bounce" />
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Performance Breakdown</span>
            <span className="text-muted-foreground text-sm font-normal">(Detalye ng Pagganap)</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Overall Score */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm text-muted-foreground">Overall Rating</p>
              <p className="text-3xl font-bold">{Math.round(score)}</p>
            </div>
            <div
              className="px-3 py-1 rounded-full text-white font-medium text-sm"
              style={{ background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` }}
            >
              {tierLabel.en} ({tierLabel.tl})
            </div>
          </div>

          {/* Breakdown */}
          <div className="space-y-3">
            {(Object.keys(breakdown) as Array<keyof OVRBreakdown>).map((key) => {
              const value = breakdown[key];
              const label = breakdownLabels[key];
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {label.en} <span className="text-muted-foreground">({label.tl})</span>
                    </span>
                    <span className="font-medium">{Math.round(value)}</span>
                  </div>
                  <Progress value={value} className="h-2" />
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
