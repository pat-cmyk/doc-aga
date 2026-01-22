import { Brush, BrushProps } from "recharts";
import { useResponsiveChartContext } from "./ResponsiveChartContainer";

/**
 * A Brush component that automatically hides on mobile devices.
 * Shows zoom/pan controls only on desktop when data exceeds the threshold.
 * 
 * The visibility is controlled by ResponsiveChartContainer's dataLength and brushThreshold props.
 * 
 * @example
 * <ConditionalBrush dataKey="date" />
 */
export function ConditionalBrush(props: Omit<BrushProps, 'ref'>) {
  const { shouldShowBrush } = useResponsiveChartContext();
  
  if (!shouldShowBrush) return null;
  
  return (
    <Brush
      height={30}
      stroke="hsl(var(--border))"
      fill="hsl(var(--muted))"
      tickFormatter={() => ''}
      {...props}
    />
  );
}
