import { useEffect, useRef, useState, ReactNode } from "react";

interface LazyRenderOnVisibleProps {
  children: ReactNode;
  fallback: ReactNode;
  rootMargin?: string;
  minHeight?: string;
  threshold?: number;
}

export const LazyRenderOnVisible = ({ 
  children, 
  fallback, 
  rootMargin = "100px",
  minHeight,
  threshold = 0.1
}: LazyRenderOnVisibleProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { 
        rootMargin,
        threshold
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  return (
    <div ref={ref} style={{ minHeight: minHeight || 'auto' }}>
      {isVisible ? children : fallback}
    </div>
  );
};
