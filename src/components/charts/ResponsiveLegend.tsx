import { Legend, LegendProps } from "recharts";
import { useResponsiveChartContext } from "./ResponsiveChartContainer";

/**
 * Pre-configured Legend with responsive sizing.
 * - Smaller font and icons on mobile
 * - Proper padding for mobile layouts
 * 
 * @example
 * <ResponsiveLegend />
 * <ResponsiveLegend verticalAlign="top" />
 */
export function ResponsiveLegend(props: Omit<LegendProps, 'ref'>) {
  const { legendProps } = useResponsiveChartContext();
  
  return (
    <Legend
      wrapperStyle={legendProps.wrapperStyle}
      iconSize={legendProps.iconSize}
      {...props}
    />
  );
}
