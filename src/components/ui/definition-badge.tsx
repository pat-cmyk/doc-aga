import * as React from "react";
import { Badge, BadgeProps } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface DefinitionBadgeProps extends BadgeProps {
  label: string;
  description: string;
}

/**
 * A Badge component wrapped with a Tooltip that displays a definition on hover.
 * Used throughout the dashboard to provide contextual help for priority/severity terms.
 */
export const DefinitionBadge = ({
  label,
  description,
  variant = "default",
  className,
  ...props
}: DefinitionBadgeProps) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={variant}
          className={cn("cursor-help", className)}
          {...props}
        >
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-sm">
        <p>{description}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
