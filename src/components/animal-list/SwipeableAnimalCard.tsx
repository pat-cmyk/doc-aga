import { ReactNode, useEffect, useRef } from 'react';
import { Download, Eye, Loader2, Check } from 'lucide-react';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { hapticImpact, hapticNotification } from '@/lib/haptics';
import { cn } from '@/lib/utils';

interface SwipeableAnimalCardProps {
  children: ReactNode;
  onSwipeLeftAction: () => void;
  onSwipeRightAction: () => void;
  isCached: boolean;
  isDownloading: boolean;
}

const ACTION_WIDTH = 80;
const REVEAL_THRESHOLD = 50;
const TRIGGER_THRESHOLD = 100;

export const SwipeableAnimalCard = ({
  children,
  onSwipeLeftAction,
  onSwipeRightAction,
  isCached,
  isDownloading,
}: SwipeableAnimalCardProps) => {
  const hasTriggeredHaptic = useRef(false);
  const autoResetTimeout = useRef<NodeJS.Timeout | null>(null);

  const {
    offsetX,
    isSwiping,
    hasPassedThreshold,
    direction,
    handlers,
    reset,
  } = useSwipeGesture({
    revealThreshold: REVEAL_THRESHOLD,
    triggerThreshold: TRIGGER_THRESHOLD,
    onSwipeLeft: () => {
      hapticNotification('success');
      onSwipeLeftAction();
    },
    onSwipeRight: () => {
      hapticNotification('success');
      onSwipeRightAction();
    },
  });

  // Haptic feedback when crossing threshold
  useEffect(() => {
    if (hasPassedThreshold && !hasTriggeredHaptic.current) {
      hapticImpact('light');
      hasTriggeredHaptic.current = true;
    } else if (!hasPassedThreshold) {
      hasTriggeredHaptic.current = false;
    }
  }, [hasPassedThreshold]);

  // Auto-reset after 3 seconds of no interaction
  useEffect(() => {
    if (isSwiping) {
      if (autoResetTimeout.current) {
        clearTimeout(autoResetTimeout.current);
      }
    } else if (Math.abs(offsetX) > 0) {
      autoResetTimeout.current = setTimeout(() => {
        reset();
      }, 3000);
    }

    return () => {
      if (autoResetTimeout.current) {
        clearTimeout(autoResetTimeout.current);
      }
    };
  }, [isSwiping, offsetX, reset]);

  // Clamp offset to max action width
  const clampedOffset = Math.max(-ACTION_WIDTH, Math.min(ACTION_WIDTH, offsetX));
  
  // Calculate action reveal percentage
  const leftReveal = Math.min(1, Math.max(0, offsetX / REVEAL_THRESHOLD));
  const rightReveal = Math.min(1, Math.max(0, -offsetX / REVEAL_THRESHOLD));

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Left action (View Details) - revealed on right swipe */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 flex items-center justify-center transition-colors duration-150",
          hasPassedThreshold && direction === 'right'
            ? "bg-green-600"
            : "bg-green-500"
        )}
        style={{
          width: ACTION_WIDTH,
          opacity: leftReveal,
        }}
      >
        <div className="flex flex-col items-center gap-0.5 text-white">
          <Eye className="h-5 w-5" />
          <span className="text-[10px] font-medium">View</span>
        </div>
      </div>

      {/* Right action (Cache Offline) - revealed on left swipe */}
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex items-center justify-center transition-colors duration-150",
          hasPassedThreshold && direction === 'left'
            ? "bg-blue-600"
            : "bg-blue-500"
        )}
        style={{
          width: ACTION_WIDTH,
          opacity: rightReveal,
        }}
      >
        <div className="flex flex-col items-center gap-0.5 text-white">
          {isDownloading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isCached ? (
            <Check className="h-5 w-5" />
          ) : (
            <Download className="h-5 w-5" />
          )}
          <span className="text-[10px] font-medium">
            {isDownloading ? "Saving..." : isCached ? "Cached" : "Cache"}
          </span>
        </div>
      </div>

      {/* Card content */}
      <div
        {...handlers}
        className={cn(
          "relative bg-card",
          !isSwiping && "transition-transform duration-300 ease-out"
        )}
        style={{
          transform: `translateX(${clampedOffset}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
};
