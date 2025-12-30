import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { hapticImpact, hapticNotification } from '@/lib/haptics';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPullDistance?: number;
}

export const usePullToRefresh = ({
  onRefresh,
  threshold = 80,
  maxPullDistance = 120,
}: UsePullToRefreshOptions) => {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const currentY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startedAtTop = useRef(false);
  const hasPassedThreshold = useRef(false);

  // Haptic feedback when threshold is reached
  useEffect(() => {
    if (pullDistance >= threshold && !hasPassedThreshold.current) {
      hapticImpact('medium');
      hasPassedThreshold.current = true;
    } else if (pullDistance < threshold) {
      hasPassedThreshold.current = false;
    }
  }, [pullDistance, threshold]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only track pull if at top of scroll
      startedAtTop.current = container.scrollTop === 0;
      if (startedAtTop.current) {
        startY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Only allow pull-to-refresh if:
      // 1. We started at the top
      // 2. We're still at the top (scrollTop === 0)
      // 3. We're not already refreshing
      if (!startedAtTop.current || container.scrollTop > 0 || isRefreshing) {
        // Reset if user scrolled away from top
        if (isPulling) {
          setIsPulling(false);
          setPullDistance(0);
        }
        return;
      }

      currentY.current = e.touches[0].clientY;
      const distance = currentY.current - startY.current;

      // Only consider positive distance (pulling down)
      if (distance <= 0) {
        // User is scrolling up, not pulling down for refresh
        if (isPulling) {
          setIsPulling(false);
          setPullDistance(0);
        }
        return;
      }

      // Now we're definitely in pull-to-refresh mode
      if (!isPulling) {
        setIsPulling(true);
      }

      // Apply diminishing returns for pull distance
      const adjustedDistance = Math.min(maxPullDistance, distance * 0.5);
      setPullDistance(adjustedDistance);

      // Prevent default scroll behavior while pulling
      e.preventDefault();
    };

    const handleTouchEnd = async () => {
      if (!isPulling) return;

      setIsPulling(false);

      if (pullDistance >= threshold) {
        setIsRefreshing(true);
        setPullDistance(threshold);

        try {
          await onRefresh();
          await hapticNotification('success');
        } catch (error) {
          console.error('Refresh failed:', error);
          await hapticNotification('error');
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPulling, isRefreshing, pullDistance, threshold, maxPullDistance, onRefresh]);

  const PullToRefreshIndicator = () => {
    const opacity = Math.min(1, pullDistance / threshold);
    const scale = Math.min(1, pullDistance / threshold);

    return (
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-transform"
        style={{
          transform: `translateY(${pullDistance}px)`,
          opacity,
        }}
      >
        <div
          className="bg-card/90 backdrop-blur-sm rounded-full p-3 shadow-lg border"
          style={{ transform: `scale(${scale})` }}
        >
          {isRefreshing ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <svg
              className="h-6 w-6 text-primary"
              style={{
                transform: `rotate(${(pullDistance / threshold) * 180}deg)`,
                transition: 'transform 0.2s',
              }}
              fill="none"
              strokeWidth="2"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          )}
        </div>
      </div>
    );
  };

  return {
    containerRef,
    PullToRefreshIndicator,
    isRefreshing,
  };
};
