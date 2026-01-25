/**
 * ReproClock - 21-Day Estrus Cycle Visualization
 * 
 * Circular clock showing current position in the reproductive cycle
 * with breeding window highlighting and pregnancy mode.
 */

import React from "react";
import { cn } from "@/lib/utils";
import type { ReproStatus } from "@/hooks/useBioCardData";

interface ReproClockProps {
  reproStatus: ReproStatus;
  livestockType: string;
  size?: 'sm' | 'md' | 'lg';
  onTap?: () => void;
}

const SIZE_CONFIG = {
  sm: { diameter: 100, strokeWidth: 6, fontSize: 8, dotSize: 6 },
  md: { diameter: 140, strokeWidth: 8, fontSize: 10, dotSize: 8 },
  lg: { diameter: 180, strokeWidth: 10, fontSize: 12, dotSize: 10 },
};

// Standard cattle estrus cycle is 21 days
const CYCLE_LENGTH = 21;
// Optimal breeding window is typically days 0-2 after heat detection
const BREEDING_WINDOW_START = 0;
const BREEDING_WINDOW_END = 2;

export function ReproClock({
  reproStatus,
  livestockType,
  size = 'md',
  onTap,
}: ReproClockProps) {
  const config = SIZE_CONFIG[size];
  const radius = (config.diameter - config.strokeWidth) / 2;
  const center = config.diameter / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate current position on the clock
  const cycleDay = reproStatus.cycleDay ?? 0;
  const cycleProgress = cycleDay / CYCLE_LENGTH;
  
  // Calculate breeding window arc
  const breedingStartAngle = (BREEDING_WINDOW_START / CYCLE_LENGTH) * 360 - 90;
  const breedingEndAngle = (BREEDING_WINDOW_END / CYCLE_LENGTH) * 360 - 90;
  
  // Current day angle (starting from top, clockwise)
  const currentDayAngle = cycleProgress * 360 - 90;
  
  // Calculate marker position
  const markerX = center + radius * Math.cos((currentDayAngle * Math.PI) / 180);
  const markerY = center + radius * Math.sin((currentDayAngle * Math.PI) / 180);
  
  // Create arc path for breeding window
  const createArcPath = (startAngle: number, endAngle: number, r: number) => {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = center + r * Math.cos(startRad);
    const y1 = center + r * Math.sin(startRad);
    const x2 = center + r * Math.cos(endRad);
    const y2 = center + r * Math.sin(endRad);
    
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  // Pregnancy mode - show different visualization
  if (reproStatus.isPregnant && reproStatus.expectedDeliveryDate) {
    const daysToDelivery = Math.ceil(
      (new Date(reproStatus.expectedDeliveryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    const gestationDays = livestockType === 'cattle' || livestockType === 'carabao' ? 283 : 150;
    const gestationProgress = Math.max(0, Math.min(1, 1 - (daysToDelivery / gestationDays)));
    
    return (
      <div 
        className="flex flex-col items-center cursor-pointer"
        onClick={onTap}
        role="button"
        aria-label="Pregnancy status"
      >
        <svg 
          width={config.diameter} 
          height={config.diameter} 
          viewBox={`0 0 ${config.diameter} ${config.diameter}`}
        >
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            className="text-muted opacity-30"
          />
          
          {/* Pregnancy progress arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - gestationProgress)}
            className="text-pink-500 dark:text-pink-400"
            transform={`rotate(-90 ${center} ${center})`}
          />
          
          {/* Center icon */}
          <text
            x={center}
            y={center}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={config.fontSize * 2}
          >
            🤰
          </text>
        </svg>
        
        <div className="text-center mt-2">
          <p className="text-xs font-medium text-pink-600 dark:text-pink-400">
            Buntis / Pregnant
          </p>
          <p className="text-xs text-muted-foreground">
            {daysToDelivery > 0 ? `${daysToDelivery} days to delivery` : 'Due soon'}
          </p>
        </div>
      </div>
    );
  }

  // No cycle data
  if (reproStatus.cycleDay === null && reproStatus.daysSinceLastHeat === null) {
    return (
      <div 
        className="flex flex-col items-center cursor-pointer"
        onClick={onTap}
        role="button"
        aria-label="No heat cycle data"
      >
        <svg 
          width={config.diameter} 
          height={config.diameter} 
          viewBox={`0 0 ${config.diameter} ${config.diameter}`}
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            className="text-muted opacity-30"
            strokeDasharray="4 4"
          />
          <text
            x={center}
            y={center}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={config.fontSize}
            className="fill-muted-foreground"
          >
            No Data
          </text>
        </svg>
        <p className="text-xs text-muted-foreground mt-1">
          Walang Data ng Siklo
        </p>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col items-center cursor-pointer group"
      onClick={onTap}
      role="button"
      aria-label={`Cycle day ${cycleDay} of ${CYCLE_LENGTH}`}
    >
      <svg 
        width={config.diameter} 
        height={config.diameter} 
        viewBox={`0 0 ${config.diameter} ${config.diameter}`}
        className="transition-transform group-hover:scale-105"
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={config.strokeWidth}
          className="text-muted opacity-30"
        />
        
        {/* Day markers */}
        {Array.from({ length: CYCLE_LENGTH }).map((_, i) => {
          const angle = (i / CYCLE_LENGTH) * 360 - 90;
          const markerRadius = radius - config.strokeWidth;
          const x = center + markerRadius * Math.cos((angle * Math.PI) / 180);
          const y = center + markerRadius * Math.sin((angle * Math.PI) / 180);
          const isKeyDay = i === 0 || i === 7 || i === 14;
          
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={isKeyDay ? 2 : 1}
              className={cn(
                "fill-muted-foreground",
                isKeyDay && "fill-foreground"
              )}
            />
          );
        })}
        
        {/* Breeding window arc (green) */}
        <path
          d={createArcPath(breedingStartAngle, breedingEndAngle + 34, radius)}
          fill="none"
          stroke="currentColor"
          strokeWidth={config.strokeWidth + 2}
          strokeLinecap="round"
          className={cn(
            "text-green-500/40 dark:text-green-400/40",
            reproStatus.isInBreedingWindow && "text-green-500 dark:text-green-400 animate-pulse"
          )}
        />
        
        {/* Luteal phase arc (gray) */}
        <path
          d={createArcPath(breedingEndAngle + 34, breedingStartAngle + 340, radius)}
          fill="none"
          stroke="currentColor"
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          className="text-muted-foreground/20"
        />
        
        {/* Current day marker */}
        <circle
          cx={markerX}
          cy={markerY}
          r={config.dotSize}
          className={cn(
            "fill-primary",
            reproStatus.isInBreedingWindow && "fill-green-500 dark:fill-green-400"
          )}
        >
          <animate
            attributeName="r"
            values={`${config.dotSize};${config.dotSize * 1.3};${config.dotSize}`}
            dur="1.5s"
            repeatCount="indefinite"
          />
        </circle>
        
        {/* Center text */}
        <text
          x={center}
          y={center - config.fontSize / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={config.fontSize * 1.8}
          fontWeight="bold"
          className="fill-foreground"
        >
          {cycleDay}
        </text>
        <text
          x={center}
          y={center + config.fontSize}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={config.fontSize * 0.8}
          className="fill-muted-foreground"
        >
          / {CYCLE_LENGTH}
        </text>
      </svg>
      
      {/* Labels */}
      <div className="text-center mt-2">
        <p className="text-xs font-medium">
          {reproStatus.isInBreedingWindow ? (
            <span className="text-green-600 dark:text-green-400">
              🔥 Breeding Window
            </span>
          ) : (
            <span>Cycle Day {cycleDay}</span>
          )}
        </p>
        {reproStatus.daysToNextHeat !== null && reproStatus.daysToNextHeat > 0 && (
          <p className="text-xs text-muted-foreground">
            Next heat: ~{reproStatus.daysToNextHeat} days
          </p>
        )}
      </div>
    </div>
  );
}
