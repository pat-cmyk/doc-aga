import { Brush } from "recharts";
import { useResponsiveChartContext } from "./ResponsiveChartContainer";

interface ConditionalBrushProps {
  dataKey: string;
  height?: number;
  stroke?: string;
  fill?: string;
  travellerWidth?: number;
  tickFormatter?: (value: any, index: number) => string;
}

/**
 * A Brush component that automatically hides on mobile devices.
 * Shows zoom/pan controls only on desktop when data exceeds the threshold.
 * 
 * The visibility is controlled by ResponsiveChartContainer's dataLength and brushThreshold props.
 * 
 * @example
 * <ConditionalBrush dataKey="date" />
 */
export function ConditionalBrush({
  dataKey,
  height = 30,
  stroke = "hsl(var(--border))",
  fill = "hsl(var(--muted))",
  travellerWidth,
  tickFormatter = () => '',
}: ConditionalBrushProps) {
  const { shouldShowBrush } = useResponsiveChartContext();
  
  if (!shouldShowBrush) return null;
  
  return (
    <Brush
      dataKey={dataKey}
      height={height}
      stroke={stroke}
      fill={fill}
      travellerWidth={travellerWidth}
      tickFormatter={tickFormatter}
    />
  );
}
