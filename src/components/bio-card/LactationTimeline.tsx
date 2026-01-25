/**
 * LactationTimeline - Horizontal Lactation Phase Progress Bar
 * 
 * Shows current position in the lactation cycle with
 * phase markers and production trend indicator.
 */

import React from "react";
import { cn } from "@/lib/utils";
import type { SparklineData } from "@/hooks/useBioCardData";

interface LactationTimelineProps {
  milkingStage: string | null;
  daysInMilk: number | null;
  milkSparkline?: SparklineData[];
  livestockType: string;
  size?: 'compact' | 'full';
  onTap?: () => void;
}

// Lactation phases with day ranges (cattle/carabao)
const LACTATION_PHASES = {
  cattle: [
    { name: 'Early', nameFilipino: 'Simula', start: 0, end: 60, color: 'bg-green-500' },
    { name: 'Mid', nameFilipino: 'Gitna', start: 60, end: 150, color: 'bg-emerald-500' },
    { name: 'Late', nameFilipino: 'Huli', start: 150, end: 240, color: 'bg-yellow-500' },
    { name: 'Dry', nameFilipino: 'Pahinga', start: 240, end: 305, color: 'bg-gray-400' },
  ],
  carabao: [
    { name: 'Early', nameFilipino: 'Simula', start: 0, end: 70, color: 'bg-green-500' },
    { name: 'Mid', nameFilipino: 'Gitna', start: 70, end: 170, color: 'bg-emerald-500' },
    { name: 'Late', nameFilipino: 'Huli', start: 170, end: 270, color: 'bg-yellow-500' },
    { name: 'Dry', nameFilipino: 'Pahinga', start: 270, end: 330, color: 'bg-gray-400' },
  ],
  goat: [
    { name: 'Early', nameFilipino: 'Simula', start: 0, end: 45, color: 'bg-green-500' },
    { name: 'Mid', nameFilipino: 'Gitna', start: 45, end: 120, color: 'bg-emerald-500' },
    { name: 'Late', nameFilipino: 'Huli', start: 120, end: 180, color: 'bg-yellow-500' },
    { name: 'Dry', nameFilipino: 'Pahinga', start: 180, end: 220, color: 'bg-gray-400' },
  ],
  sheep: [
    { name: 'Early', nameFilipino: 'Simula', start: 0, end: 40, color: 'bg-green-500' },
    { name: 'Mid', nameFilipino: 'Gitna', start: 40, end: 100, color: 'bg-emerald-500' },
    { name: 'Late', nameFilipino: 'Huli', start: 100, end: 150, color: 'bg-yellow-500' },
    { name: 'Dry', nameFilipino: 'Pahinga', start: 150, end: 200, color: 'bg-gray-400' },
  ],
};

// Map milking_stage values to phase names
const STAGE_MAPPING: Record<string, string> = {
  'early': 'Early',
  'Early Lactation': 'Early',
  'mid': 'Mid',
  'Mid Lactation': 'Mid',
  'late': 'Late',
  'Late Lactation': 'Late',
  'peak': 'Early', // Peak is typically in early lactation
  'Peak Lactation': 'Early',
  'dry': 'Dry',
  'Dry': 'Dry',
};

export function LactationTimeline({
  milkingStage,
  daysInMilk,
  milkSparkline = [],
  livestockType,
  size = 'compact',
  onTap,
}: LactationTimelineProps) {
  // Get phases for this livestock type
  const phases = LACTATION_PHASES[livestockType as keyof typeof LACTATION_PHASES] || LACTATION_PHASES.cattle;
  const totalDays = phases[phases.length - 1].end;
  
  // Determine current phase
  const normalizedStage = milkingStage ? STAGE_MAPPING[milkingStage] || milkingStage : null;
  const currentPhaseIndex = phases.findIndex(p => p.name === normalizedStage);
  
  // Calculate position from days in milk if available
  let position = 0;
  let currentPhase = phases[0];
  
  if (daysInMilk !== null) {
    position = Math.min(daysInMilk, totalDays);
    currentPhase = phases.find(p => daysInMilk >= p.start && daysInMilk < p.end) || phases[phases.length - 1];
  } else if (currentPhaseIndex >= 0) {
    currentPhase = phases[currentPhaseIndex];
    // Estimate position as middle of current phase
    position = (currentPhase.start + currentPhase.end) / 2;
  }
  
  const progressPercent = (position / totalDays) * 100;
  
  // Calculate days to next phase
  const daysToNextPhase = currentPhase.end - position;
  
  // Calculate trend from sparkline
  const trend = React.useMemo(() => {
    if (milkSparkline.length < 3) return null;
    const recent = milkSparkline.slice(-5);
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    const firstAvg = firstHalf.reduce((s, d) => s + d.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, d) => s + d.value, 0) / secondHalf.length;
    const diff = secondAvg - firstAvg;
    if (diff > 0.5) return 'up';
    if (diff < -0.5) return 'down';
    return 'stable';
  }, [milkSparkline]);

  // Not in lactation
  if (!milkingStage || normalizedStage === 'Dry' || milkingStage === 'Dry') {
    if (size === 'compact') {
      return (
        <div 
          className="text-center py-2 cursor-pointer"
          onClick={onTap}
        >
          <span className="text-sm text-muted-foreground">
            🌙 Dry Period (Pahinga)
          </span>
        </div>
      );
    }
  }

  return (
    <div 
      className={cn(
        "cursor-pointer",
        size === 'full' && "space-y-3"
      )}
      onClick={onTap}
      role="button"
      aria-label={`Lactation phase: ${currentPhase.name}, Day ${position}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="text-lg">🥛</span>
          <span className="font-medium">
            {currentPhase.name}
            <span className="text-xs text-muted-foreground ml-1">
              ({currentPhase.nameFilipino})
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {daysInMilk !== null && (
            <span className="text-xs text-muted-foreground">
              Day {daysInMilk}
            </span>
          )}
          {trend && (
            <span className={cn(
              "text-xs",
              trend === 'up' && "text-green-600 dark:text-green-400",
              trend === 'down' && "text-red-600 dark:text-red-400",
              trend === 'stable' && "text-muted-foreground"
            )}>
              {trend === 'up' ? '📈' : trend === 'down' ? '📉' : '→'}
            </span>
          )}
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="relative h-3 rounded-full overflow-hidden bg-muted">
        {/* Phase segments */}
        <div className="absolute inset-0 flex">
          {phases.map((phase, i) => {
            const width = ((phase.end - phase.start) / totalDays) * 100;
            const isActive = currentPhase.name === phase.name;
            
            return (
              <div
                key={phase.name}
                className={cn(
                  "h-full transition-opacity",
                  phase.color,
                  !isActive && "opacity-30"
                )}
                style={{ width: `${width}%` }}
              />
            );
          })}
        </div>
        
        {/* Current position marker */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-foreground rounded-full shadow-md transition-all duration-300"
          style={{ left: `calc(${progressPercent}% - 2px)` }}
        >
          {/* Tooltip bubble */}
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-foreground text-background text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
            Day {Math.round(position)}
          </div>
        </div>
      </div>
      
      {/* Phase labels (full size only) */}
      {size === 'full' && (
        <div className="flex text-[10px] text-muted-foreground">
          {phases.map((phase, i) => {
            const width = ((phase.end - phase.start) / totalDays) * 100;
            
            return (
              <div
                key={phase.name}
                className="text-center"
                style={{ width: `${width}%` }}
              >
                <span className={cn(
                  currentPhase.name === phase.name && "font-medium text-foreground"
                )}>
                  {phase.name}
                </span>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Days to next phase */}
      {size === 'full' && daysToNextPhase > 0 && currentPhase.name !== 'Dry' && (
        <p className="text-xs text-muted-foreground text-center">
          ~{Math.round(daysToNextPhase)} days until {
            phases[phases.indexOf(currentPhase) + 1]?.name || 'Dry'
          } phase
        </p>
      )}
    </div>
  );
}
