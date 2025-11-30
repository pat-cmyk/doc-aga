import { useEffect, useRef, useState, ReactNode } from "react";

interface LazyRenderOnVisibleProps {
  children: ReactNode;
  fallback: ReactNode;
  rootMargin?: string;
  minHeight?: string;
}

export const LazyRenderOnVisible = ({ 
  children, 
  fallback, 
  rootMargin = "200px",
  minHeight
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
      { rootMargin }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} style={{ minHeight: minHeight || 'auto' }}>
      {isVisible ? children : fallback}
    </div>
  );
};
