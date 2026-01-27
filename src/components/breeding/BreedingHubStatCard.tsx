/**
 * BreedingHubStatCard - Summary stat card for Breeding Hub
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface BreedingHubStatCardProps {
  count: number;
  label: string;
  labelTagalog?: string;
  icon: string;
  colorClass: string;
  bgClass: string;
  onClick?: () => void;
  isHighlighted?: boolean;
}

export function BreedingHubStatCard({
  count,
  label,
  labelTagalog,
  icon,
  colorClass,
  bgClass,
  onClick,
  isHighlighted = false,
}: BreedingHubStatCardProps) {
  return (
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
    </button>
  );
}
