/**
 * Centralized chart configuration for consistent mobile-responsive charts
 * across the entire application.
 */

export const CHART_HEIGHT = {
  small: { mobile: 200, tablet: 240, desktop: 280 },
  medium: { mobile: 280, tablet: 320, desktop: 360 },
  large: { mobile: 320, tablet: 380, desktop: 420 },
} as const;

export const CHART_FONT_SIZE = {
  mobile: 9,
  tablet: 10,
  desktop: 11,
} as const;

export const CHART_LEGEND = {
  mobile: { 
    fontSize: '9px', 
    iconSize: 8, 
    paddingTop: '16px',
    paddingBottom: '8px'
  },
  desktop: { 
    fontSize: '11px', 
    iconSize: 10, 
    paddingTop: '10px',
    paddingBottom: '0px'
  },
} as const;

export const CHART_XAXIS = {
  mobile: { 
    angle: -45, 
    textAnchor: 'end' as const, 
    tickMargin: 15, 
    height: 60,
    interval: 0
  },
  desktop: { 
    angle: 0, 
    textAnchor: 'middle' as const, 
    tickMargin: 8, 
    height: 30,
    interval: 'preserveStartEnd' as const
  },
} as const;

export const CHART_MARGIN = {
  mobile: { top: 10, right: 10, left: 0, bottom: 100 },
  desktop: { top: 10, right: 10, left: 0, bottom: 60 },
} as const;

// Helper to get height class string for Tailwind
export const getChartHeightClass = (size: 'small' | 'medium' | 'large' = 'medium') => {
  const heights = CHART_HEIGHT[size];
  return `h-[${heights.mobile}px] sm:h-[${heights.tablet}px] md:h-[${heights.desktop}px]`;
};
