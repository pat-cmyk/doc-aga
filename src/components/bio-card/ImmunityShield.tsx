/**
 * ImmunityShield - Gamified Vaccination Status
 * 
 * Shield-shaped visualization showing vaccination compliance
 * with animated states for different protection levels.
 */

import React from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { ImmunityStatus } from "@/hooks/useBioCardData";

interface ImmunityShieldProps {
  immunityStatus: ImmunityStatus;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  onTap?: () => void;
}

const SIZE_CONFIG = {
  sm: { width: 60, height: 72, fontSize: 10 },
  md: { width: 80, height: 96, fontSize: 12 },
  lg: { width: 100, height: 120, fontSize: 14 },
};

const STATUS_CONFIG = {
  full: {
    gradient: ['#22c55e', '#16a34a'], // Green
    emoji: '🛡️',
    label: 'Protected',
    labelFilipino: 'Protektado',
    animation: 'animate-shield-pulse',
  },
  booster_due: {
    gradient: ['#eab308', '#ca8a04'], // Yellow
    emoji: '⚠️',
    label: 'Booster Due',
    labelFilipino: 'Kailangan Booster',
    animation: '',
  },
  overdue: {
    gradient: ['#ef4444', '#dc2626'], // Red
    emoji: '🔴',
    label: 'Overdue',
    labelFilipino: 'Lampas na',
    animation: 'animate-shield-shake',
  },
};

export function ImmunityShield({
  immunityStatus,
  size = 'md',
  showDetails = false,
  onTap,
}: ImmunityShieldProps) {
  const config = SIZE_CONFIG[size];
  const statusConfig = STATUS_CONFIG[immunityStatus.label];
  const fillPercent = immunityStatus.compliancePercent / 100;
  
  // Shield path - classic heraldic shield shape
  const shieldPath = `
    M ${config.width / 2} 0
    C ${config.width * 0.1} 0, 0 ${config.height * 0.15}, 0 ${config.height * 0.35}
    C 0 ${config.height * 0.7}, ${config.width / 2} ${config.height}, ${config.width / 2} ${config.height}
    C ${config.width / 2} ${config.height}, ${config.width} ${config.height * 0.7}, ${config.width} ${config.height * 0.35}
    C ${config.width} ${config.height * 0.15}, ${config.width * 0.9} 0, ${config.width / 2} 0
    Z
  `;
  
  // Create gradient id based on status
  const gradientId = `shield-gradient-${immunityStatus.label}`;
  const clipId = `shield-clip-${size}`;

  return (
    <div 
      className={cn(
        "flex items-center gap-3 cursor-pointer group",
        showDetails && "flex-col"
      )}
      onClick={onTap}
      role="button"
      aria-label={`Immunity status: ${statusConfig.label}`}
    >
      {/* Shield SVG */}
      <div className={cn("relative", statusConfig.animation)}>
        <svg 
          width={config.width} 
          height={config.height}
          viewBox={`0 0 ${config.width} ${config.height}`}
          className="drop-shadow-md transition-transform group-hover:scale-105"
        >
          <defs>
            {/* Shield gradient */}
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={statusConfig.gradient[0]} />
              <stop offset="100%" stopColor={statusConfig.gradient[1]} />
            </linearGradient>
            
            {/* Clip path for shield shape */}
            <clipPath id={clipId}>
              <path d={shieldPath} />
            </clipPath>
          </defs>
          
          {/* Background (empty shield) */}
          <path
            d={shieldPath}
            fill="currentColor"
            className="text-muted opacity-30"
          />
          
          {/* Filled portion based on compliance */}
          <g clipPath={`url(#${clipId})`}>
            <rect
              x={0}
              y={config.height * (1 - fillPercent)}
              width={config.width}
              height={config.height * fillPercent}
              fill={`url(#${gradientId})`}
              className="transition-all duration-500"
            />
          </g>
          
          {/* Shield outline */}
          <path
            d={shieldPath}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className={cn(
              "text-muted-foreground",
              immunityStatus.level === 100 && "text-green-600 dark:text-green-400",
              immunityStatus.level === 50 && "text-yellow-600 dark:text-yellow-400",
              immunityStatus.level === 0 && "text-red-600 dark:text-red-400"
            )}
          />
          
          {/* Percentage text */}
          <text
            x={config.width / 2}
            y={config.height * 0.45}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={config.fontSize * 1.4}
            fontWeight="bold"
            className="fill-white drop-shadow-sm"
          >
            {immunityStatus.compliancePercent}%
          </text>
        </svg>
        
        {/* Status emoji badge */}
        <div className={cn(
          "absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-sm bg-background shadow-sm border",
          immunityStatus.level === 100 && "border-green-500",
          immunityStatus.level === 50 && "border-yellow-500",
          immunityStatus.level === 0 && "border-red-500"
        )}>
          {statusConfig.emoji}
        </div>
      </div>
      
      {/* Status info */}
      <div className={cn(
        "flex-1",
        showDetails && "text-center"
      )}>
        <p className={cn(
          "font-medium text-sm",
          immunityStatus.level === 100 && "text-green-600 dark:text-green-400",
          immunityStatus.level === 50 && "text-yellow-600 dark:text-yellow-400",
          immunityStatus.level === 0 && "text-red-600 dark:text-red-400"
        )}>
          {statusConfig.label}
        </p>
        <p className="text-xs text-muted-foreground">
          {statusConfig.labelFilipino}
        </p>
        
        {showDetails && (
          <div className="mt-2 space-y-1">
            {/* Overdue vaccines */}
            {immunityStatus.overdueVaccines.length > 0 && (
              <div className="text-xs">
                <p className="text-destructive font-medium">
                  Overdue ({immunityStatus.overdueVaccines.length}):
                </p>
                <ul className="text-muted-foreground">
                  {immunityStatus.overdueVaccines.slice(0, 3).map((v, i) => (
                    <li key={i} className="truncate">• {v}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Upcoming vaccines */}
            {immunityStatus.upcomingVaccines.length > 0 && (
              <div className="text-xs">
                <p className="text-muted-foreground font-medium">
                  Upcoming:
                </p>
                <ul>
                  {immunityStatus.upcomingVaccines.slice(0, 2).map((v, i) => (
                    <li key={i} className="text-muted-foreground truncate">
                      • {v.name} ({v.daysUntil}d)
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Next due date */}
            {immunityStatus.nextDueDate && (
              <p className="text-xs text-muted-foreground">
                Next: {format(new Date(immunityStatus.nextDueDate), 'MMM d')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
