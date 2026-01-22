import * as React from "react";
import { YAxis } from "recharts";
import { useResponsiveChartContext } from "./ResponsiveChartContainer";

type YAxisProps = React.ComponentProps<typeof YAxis>;

interface ResponsiveYAxisProps extends Omit<YAxisProps, 'tick'> {
  /** Custom tick props to merge with responsive defaults */
  tickProps?: Record<string, unknown>;
}

/**
 * Pre-configured YAxis with responsive font sizing.
 * 
 * @example
 * <ResponsiveYAxis />
 * <ResponsiveYAxis width={50} tickFormatter={(v) => `${v}%`} />
 */
export function ResponsiveYAxis({ 
  tickProps = {},
  width = 40,
  ...props 
}: ResponsiveYAxisProps) {
  const { fontSize } = useResponsiveChartContext();
  
  const tickConfig = {
    fontSize,
    fill: 'hsl(var(--muted-foreground))',
    ...tickProps,
  };
  
  return (
    <YAxis
      tick={tickConfig}
      width={width}
      className="text-muted-foreground"
      {...props}
    />
  );
}
