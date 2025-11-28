import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only start pull if at top of scroll
      if (container.scrollTop === 0) {
        startY.current = e.touches[0].clientY;
        setIsPulling(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || isRefreshing) return;

      currentY.current = e.touches[0].clientY;
      const distance = Math.max(0, currentY.current - startY.current);
      
      // Apply diminishing returns for pull distance
      const adjustedDistance = Math.min(
        maxPullDistance,
        distance * 0.5
      );
      
      setPullDistance(adjustedDistance);

      // Prevent default scroll behavior while pulling
      if (distance > 0) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling) return;

      setIsPulling(false);

      if (pullDistance >= threshold) {
        setIsRefreshing(true);
        setPullDistance(threshold);
        
        try {
          await onRefresh();
        } catch (error) {
          console.error('Refresh failed:', error);
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
