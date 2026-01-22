import { useIsMobile } from "./use-mobile";
import {
  CHART_HEIGHT,
  CHART_FONT_SIZE,
  CHART_LEGEND,
  CHART_XAXIS,
  CHART_MARGIN,
} from "@/lib/chartConfig";

type ChartSize = 'small' | 'medium' | 'large';

interface UseResponsiveChartOptions {
  size?: ChartSize;
  dataLength?: number;
  brushThreshold?: number;
}

/**
 * Hook that returns mobile-optimized chart configuration props.
 * Centralizes responsive logic for consistent chart behavior across the app.
 */
export function useResponsiveChart(options: UseResponsiveChartOptions = {}) {
  const { 
    size = 'medium', 
    dataLength = 0, 
    brushThreshold = 6 
  } = options;
  
  const isMobile = useIsMobile();

  const heights = CHART_HEIGHT[size];
  const height = isMobile ? heights.mobile : heights.desktop;
  const heightClass = `h-[${heights.mobile}px] sm:h-[${heights.tablet}px] md:h-[${heights.desktop}px]`;

  const fontSize = isMobile ? CHART_FONT_SIZE.mobile : CHART_FONT_SIZE.desktop;
  
  const legendConfig = isMobile ? CHART_LEGEND.mobile : CHART_LEGEND.desktop;
  const legendProps = {
    wrapperStyle: {
      fontSize: legendConfig.fontSize,
      paddingTop: legendConfig.paddingTop,
      paddingBottom: legendConfig.paddingBottom,
    },
    iconSize: legendConfig.iconSize,
    layout: 'horizontal' as const,
    align: 'center' as const,
    verticalAlign: 'bottom' as const,
  };

  const xAxisConfig = isMobile ? CHART_XAXIS.mobile : CHART_XAXIS.desktop;
  const xAxisProps = {
    tick: { fontSize },
    tickMargin: xAxisConfig.tickMargin,
    angle: xAxisConfig.angle,
    textAnchor: xAxisConfig.textAnchor,
    height: xAxisConfig.height,
    interval: xAxisConfig.interval,
  };

  const margin = isMobile ? CHART_MARGIN.mobile : CHART_MARGIN.desktop;

  const shouldShowBrush = dataLength > brushThreshold && !isMobile;

  return {
    isMobile,
    height,
    heightClass,
    fontSize,
    legendProps,
    xAxisProps,
    margin,
    shouldShowBrush,
    // Raw configs for custom usage
    config: {
      heights,
      legendConfig,
      xAxisConfig,
    },
  };
}
