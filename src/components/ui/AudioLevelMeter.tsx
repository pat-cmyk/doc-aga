/**
 * AudioLevelMeter - Visual audio level indicator component
 * 
 * Displays real-time audio levels in various visual formats:
 * - bars: Vertical bars responding to frequency bands
 * - simple: Single horizontal progress bar
 * - circle: Pulsing ring (for button integration)
 */

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { extractBandLevels } from '@/hooks/useAudioLevelMeter';

export interface AudioLevelMeterProps {
  /** Normalized audio level (0-100) */
  audioLevel: number;
  /** Frequency data for bar visualization */
  frequencyData?: Uint8Array;
  /** Visual variant */
  variant?: 'bars' | 'simple' | 'circle';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Whether the meter is active (for circle pulse effect) */
  isActive?: boolean;
}

const sizeConfig = {
  sm: { height: 16, barWidth: 3, gap: 2, count: 4, circleSize: 32 },
  md: { height: 24, barWidth: 4, gap: 2, count: 5, circleSize: 40 },
  lg: { height: 32, barWidth: 5, gap: 3, count: 5, circleSize: 48 },
};

/**
 * Bars variant - Vertical frequency bars
 */
function BarsVisualization({ 
  audioLevel, 
  frequencyData, 
  size = 'md' 
}: Pick<AudioLevelMeterProps, 'audioLevel' | 'frequencyData' | 'size'>) {
  const config = sizeConfig[size];
  
  // Extract band levels from frequency data
  const bandLevels = useMemo(() => {
    if (frequencyData && frequencyData.length > 0) {
      return extractBandLevels(frequencyData);
    }
    // Fallback: distribute overall level across bars with variation
    return Array.from({ length: config.count }, (_, i) => {
      const variation = Math.sin(Date.now() / 100 + i) * 10;
      return Math.max(5, Math.min(100, audioLevel + variation));
    });
  }, [frequencyData, audioLevel, config.count]);

  const totalWidth = config.count * config.barWidth + (config.count - 1) * config.gap;

  return (
    <div 
      className="flex items-end gap-px"
      style={{ 
        height: config.height, 
        width: totalWidth,
        gap: config.gap,
      }}
    >
      {bandLevels.slice(0, config.count).map((level, index) => (
        <div
          key={index}
          className="bg-destructive rounded-sm transition-all duration-75 ease-out"
          style={{
            width: config.barWidth,
            height: `${Math.max(15, level)}%`,
            opacity: 0.5 + (level / 200),
          }}
        />
      ))}
    </div>
  );
}

/**
 * Simple variant - Horizontal progress bar
 */
function SimpleVisualization({ 
  audioLevel, 
  size = 'md',
  className,
}: Pick<AudioLevelMeterProps, 'audioLevel' | 'size' | 'className'>) {
  const config = sizeConfig[size];
  const width = config.count * config.barWidth + (config.count - 1) * config.gap + 20;

  // Color gradient based on level
  const getGradient = () => {
    if (audioLevel > 80) return 'from-yellow-500 to-destructive';
    if (audioLevel > 50) return 'from-primary to-yellow-500';
    return 'from-primary/60 to-primary';
  };

  return (
    <div 
      className={cn(
        "h-1 bg-muted rounded-full overflow-hidden",
        className
      )}
      style={{ width }}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-75 ease-out bg-gradient-to-r",
          getGradient()
        )}
        style={{ width: `${Math.max(5, audioLevel)}%` }}
      />
    </div>
  );
}

/**
 * Circle variant - Pulsing ring for button integration
 */
function CircleVisualization({ 
  audioLevel, 
  size = 'md',
  isActive = true,
}: Pick<AudioLevelMeterProps, 'audioLevel' | 'size' | 'isActive'>) {
  const config = sizeConfig[size];
  
  // Scale ring width based on audio level (2px to 6px)
  const ringWidth = 2 + (audioLevel / 100) * 4;
  const opacity = isActive ? 0.3 + (audioLevel / 100) * 0.7 : 0;
  const scale = 1 + (audioLevel / 100) * 0.15;

  return (
    <div 
      className="absolute inset-0 rounded-full pointer-events-none"
      style={{
        boxShadow: `0 0 0 ${ringWidth}px hsl(var(--destructive) / ${opacity})`,
        transform: `scale(${scale})`,
        transition: 'all 75ms ease-out',
      }}
    />
  );
}

/**
 * Main AudioLevelMeter component
 */
export function AudioLevelMeter({
  audioLevel,
  frequencyData,
  variant = 'bars',
  size = 'md',
  className,
  isActive = true,
}: AudioLevelMeterProps) {
  if (!isActive && variant !== 'circle') {
    return null;
  }

  switch (variant) {
    case 'bars':
      return (
        <div className={cn('flex items-center justify-center', className)}>
          <BarsVisualization 
            audioLevel={audioLevel} 
            frequencyData={frequencyData} 
            size={size} 
          />
        </div>
      );
    
    case 'simple':
      return (
        <SimpleVisualization 
          audioLevel={audioLevel} 
          size={size} 
          className={className}
        />
      );
    
    case 'circle':
      return (
        <CircleVisualization 
          audioLevel={audioLevel} 
          size={size}
          isActive={isActive}
        />
      );
    
    default:
      return null;
  }
}

export default AudioLevelMeter;
