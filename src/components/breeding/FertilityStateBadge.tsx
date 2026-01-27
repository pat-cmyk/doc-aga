/**
 * FertilityStateBadge - Visual indicator for animal fertility status
 * 
 * Shows the current fertility state with icon, color coding,
 * and optional expanded details.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { FertilityStatus } from '@/types/fertility';
import { FERTILITY_STATUS_CONFIG } from '@/types/fertility';

interface FertilityStateBadgeProps {
  status: FertilityStatus | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showTooltip?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2 py-1',
  lg: 'text-base px-3 py-1.5',
};

export function FertilityStateBadge({
  status,
  size = 'md',
  showLabel = true,
  showTooltip = true,
  className,
}: FertilityStateBadgeProps) {
  const config = status ? FERTILITY_STATUS_CONFIG[status] : null;

  if (!config) {
    return (
      <Badge variant="outline" className={cn(SIZE_CLASSES[size], 'text-muted-foreground', className)}>
        ⚪ Unknown
      </Badge>
    );
  }

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        SIZE_CLASSES[size],
        config.bgColor,
        config.color,
        'border-0 font-medium',
        className
      )}
    >
      <span className="mr-1">{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center">
            <p className="font-medium">{config.label}</p>
            <p className="text-xs text-muted-foreground">{config.labelTagalog}</p>
            <p className="text-xs mt-1">{config.description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
