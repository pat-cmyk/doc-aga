import * as React from "react";
import { createContext, useContext, ReactElement } from "react";
import { ChartContainer, ChartConfig } from "@/components/ui/chart";
import { useResponsiveChart } from "@/hooks/useResponsiveChart";
import { cn } from "@/lib/utils";

type ChartSize = 'small' | 'medium' | 'large';

interface ResponsiveChartContextValue {
  isMobile: boolean;
  height: number;
  heightClass: string;
  fontSize: number;
  legendProps: {
    wrapperStyle: { fontSize: string; paddingTop: string };
    iconSize: number;
  };
  xAxisProps: {
    angle: number;
    textAnchor: "start" | "middle" | "end";
    height: number;
    tickMargin: number;
    interval: number | "preserveStartEnd";
  };
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  shouldShowBrush: boolean;
}

const ResponsiveChartContext = createContext<ResponsiveChartContextValue | null>(null);

export function useResponsiveChartContext() {
  const context = useContext(ResponsiveChartContext);
  if (!context) {
    throw new Error("useResponsiveChartContext must be used within ResponsiveChartContainer");
  }
  return context;
}

interface ResponsiveChartContainerProps {
  config: ChartConfig;
  size?: ChartSize;
  dataLength?: number;
  brushThreshold?: number;
  className?: string;
  children: ReactElement;
}

/**
 * A wrapper component that automatically applies all centralized chart configurations.
 * Reduces chart boilerplate from ~20 lines to ~5 lines while maintaining flexibility.
 * 
 * @example
 * <ResponsiveChartContainer config={config} size="medium" dataLength={data.length}>
 *   <AreaChart data={data}>
 *     <ResponsiveXAxis dataKey="date" />
 *     <ResponsiveYAxis />
 *     <ResponsiveLegend />
 *     <ConditionalBrush dataKey="date" />
 *   </AreaChart>
 * </ResponsiveChartContainer>
 */
export function ResponsiveChartContainer({
  config,
  size = 'medium',
  dataLength = 0,
  brushThreshold = 14,
  className,
  children,
}: ResponsiveChartContainerProps) {
  const chartProps = useResponsiveChart({ size, dataLength, brushThreshold });
  
  const contextValue: ResponsiveChartContextValue = {
    isMobile: chartProps.isMobile,
    height: chartProps.height,
    heightClass: chartProps.heightClass,
    fontSize: chartProps.isMobile ? 9 : 11,
    legendProps: chartProps.legendProps,
    xAxisProps: chartProps.xAxisProps,
    margin: chartProps.margin,
    shouldShowBrush: chartProps.shouldShowBrush,
  };
  
  return (
    <ResponsiveChartContext.Provider value={contextValue}>
      <ChartContainer
        config={config}
        className={cn("aspect-auto w-full", chartProps.heightClass, className)}
      >
        {children}
      </ChartContainer>
    </ResponsiveChartContext.Provider>
  );
}
