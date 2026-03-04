/**
 * BreedingHubStatCard - Summary stat card for Breeding Hub
 */

import React from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BreedingHubStatCardProps {
  count: number;
  label: string;
  labelTagalog?: string;
  description?: string;
  descriptionTagalog?: string;
  icon: string;
  colorClass: string;
  bgClass: string;
  onClick?: () => void;
  isHighlighted?: boolean;
  badge?: string;
}

export function BreedingHubStatCard({
  count,
  label,
  labelTagalog,
  description,
  descriptionTagalog,
  icon,
  colorClass,
  bgClass,
  onClick,
  isHighlighted = false,
  badge,
}: BreedingHubStatCardProps) {
  const card = (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center p-3 rounded-lg border transition-all',
        'hover:shadow-md hover:scale-105',
        isHighlighted && 'ring-2 ring-primary ring-offset-2',
        bgClass
      )}
      disabled={!onClick}
    >
      <span className="text-2xl">{icon}</span>
      <span className={cn('text-2xl font-bold', colorClass)}>
        {count}
      </span>
      <span className="text-xs text-muted-foreground text-center leading-tight">
        {label}
      </span>
      {labelTagalog && (
        <span className="text-[10px] text-muted-foreground/70 text-center">
          {labelTagalog}
        </span>
      )}
      {badge && (
        <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400 mt-0.5 text-center leading-tight">
          {badge}
        </span>
      )}
    </button>
  );

  if (!description) return card;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent className="max-w-xs text-sm">
          <p className="font-medium">{label}</p>
          <p>{description}</p>
          {descriptionTagalog && (
            <p className="text-muted-foreground text-xs mt-1">{descriptionTagalog}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
