import * as React from "react";
import { XAxis } from "recharts";
import { useResponsiveChartContext } from "./ResponsiveChartContainer";

type XAxisProps = React.ComponentProps<typeof XAxis>;

interface ResponsiveXAxisProps extends Omit<XAxisProps, 'tick'> {
  /** Disable rotation on mobile (useful for short labels) */
  disableRotation?: boolean;
  /** Custom tick props to merge with responsive defaults */
  tickProps?: Record<string, unknown>;
}

/**
 * Pre-configured XAxis that auto-applies mobile optimizations:
 * - Rotated labels (-45°) on mobile to prevent overlap
 * - Responsive font sizing (9px mobile, 11px desktop)
 * - Proper text anchoring and margins
 * 
 * @example
 * <ResponsiveXAxis dataKey="date" />
 * <ResponsiveXAxis dataKey="name" disableRotation /> // For short labels
 */
export function ResponsiveXAxis({ 
  disableRotation = false, 
  tickProps = {},
  ...props 
}: ResponsiveXAxisProps) {
  const { xAxisProps, fontSize } = useResponsiveChartContext();
  
  const tickConfig = {
    fontSize,
    fill: 'hsl(var(--muted-foreground))',
    ...tickProps,
  };
  
  // When rotation is disabled, use standard axis settings
  if (disableRotation) {
    return (
      <XAxis
        tick={tickConfig}
        tickMargin={8}
        height={30}
        interval="preserveStartEnd"
        className="text-muted-foreground"
        {...props}
      />
    );
  }
  
  return (
    <XAxis
      tick={tickConfig}
      tickMargin={xAxisProps.tickMargin}
      angle={xAxisProps.angle}
      textAnchor={xAxisProps.textAnchor}
      height={xAxisProps.height}
      interval={xAxisProps.interval}
      className="text-muted-foreground"
      {...props}
    />
  );
}
