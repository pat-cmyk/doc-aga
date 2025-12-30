import { useRef, useCallback, useState } from 'react';

interface SwipeState {
  offsetX: number;
  isSwiping: boolean;
  isSwipingLeft: boolean;
  isSwipingRight: boolean;
  hasPassedThreshold: boolean;
  direction: 'left' | 'right' | null;
}

interface UseSwipeGestureOptions {
  revealThreshold?: number;
  triggerThreshold?: number;
  velocityThreshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  disabled?: boolean;
}

export const useSwipeGesture = ({
  revealThreshold = 50,
  triggerThreshold = 100,
  velocityThreshold = 0.5,
  onSwipeLeft,
  onSwipeRight,
  disabled = false,
}: UseSwipeGestureOptions = {}) => {
  const [state, setState] = useState<SwipeState>({
    offsetX: 0,
    isSwiping: false,
    isSwipingLeft: false,
    isSwipingRight: false,
    hasPassedThreshold: false,
    direction: null,
  });

  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const isTracking = useRef(false);
  const hasDecidedDirection = useRef(false);
  const isHorizontalSwipe = useRef(false);

  const reset = useCallback(() => {
    setState({
      offsetX: 0,
      isSwiping: false,
      isSwipingLeft: false,
      isSwipingRight: false,
      hasPassedThreshold: false,
      direction: null,
    });
    isTracking.current = false;
    hasDecidedDirection.current = false;
    isHorizontalSwipe.current = false;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    startTime.current = Date.now();
    isTracking.current = true;
    hasDecidedDirection.current = false;
    isHorizontalSwipe.current = false;
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || !isTracking.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - startX.current;
    const deltaY = touch.clientY - startY.current;

    // Decide swipe direction on first significant movement
    if (!hasDecidedDirection.current) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      
      // Need at least 10px movement to decide
      if (absX > 10 || absY > 10) {
        hasDecidedDirection.current = true;
        // Horizontal if angle is less than 30 degrees from horizontal
        isHorizontalSwipe.current = absX > absY * 1.73; // tan(30°) ≈ 0.577, so absX/absY > 1.73
      }
    }

    // Only track horizontal swipes
    if (!isHorizontalSwipe.current) return;

    // Prevent vertical scrolling during horizontal swipe
    e.preventDefault();

    const isSwipingLeft = deltaX < 0;
    const isSwipingRight = deltaX > 0;
    const hasPassedThreshold = Math.abs(deltaX) >= triggerThreshold;

    setState({
      offsetX: deltaX,
      isSwiping: true,
      isSwipingLeft,
      isSwipingRight,
      hasPassedThreshold,
      direction: isSwipingLeft ? 'left' : isSwipingRight ? 'right' : null,
    });
  }, [disabled, triggerThreshold]);

  const handleTouchEnd = useCallback(() => {
    if (disabled || !isTracking.current) return;

    const deltaX = state.offsetX;
    const elapsed = Date.now() - startTime.current;
    const velocity = Math.abs(deltaX) / elapsed;
    
    const shouldTrigger = 
      Math.abs(deltaX) >= triggerThreshold || 
      (Math.abs(deltaX) >= revealThreshold && velocity >= velocityThreshold);

    if (shouldTrigger) {
      if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      } else if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      }
    }

    reset();
  }, [disabled, state.offsetX, triggerThreshold, revealThreshold, velocityThreshold, onSwipeLeft, onSwipeRight, reset]);

  return {
    ...state,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: reset,
    },
    reset,
  };
};
