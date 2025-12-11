import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendIndicatorProps {
  current: number;
  previous: number;
  /** Whether higher values are good (true) or bad (false) */
  positiveIsGood?: boolean;
  /** Format type for display */
  format?: "percent" | "number";
  className?: string;
}

/**
 * Displays trend arrow and percentage change between current and previous values
 */
export const TrendIndicator = ({
  current,
  previous,
  positiveIsGood = true,
  format = "percent",
  className
}: TrendIndicatorProps) => {
  // Handle edge cases
  if (previous === 0 && current === 0) {
    return (
      <span className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <Minus className="h-3 w-3" />
        <span>No change</span>
      </span>
    );
  }

  // Calculate percentage change
  let percentChange: number;
  if (previous === 0) {
    percentChange = current > 0 ? 100 : 0;
  } else {
    percentChange = ((current - previous) / previous) * 100;
  }

  const isPositive = percentChange > 0;
  const isNeutral = percentChange === 0;
  
  // Determine if this trend is good or bad
  const isGood = positiveIsGood ? isPositive : !isPositive;

  // Format the display value
  const displayValue = format === "percent"
    ? `${Math.abs(percentChange).toFixed(0)}%`
    : `${isPositive ? "+" : ""}${(current - previous).toFixed(1)}`;

  if (isNeutral) {
    return (
      <span className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <Minus className="h-3 w-3" />
        <span>No change</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs font-medium",
        isGood ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
        className
      )}
    >
      {isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      <span>{displayValue}</span>
    </span>
  );
};
