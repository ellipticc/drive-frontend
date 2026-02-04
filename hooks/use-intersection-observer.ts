// Hook for lazy loading images using Intersection Observer
// Only loads images when they come into viewport

import { useState, useEffect, useRef, useCallback } from 'react';

interface IntersectionOptions extends IntersectionObserverInit {
  triggerOnce?: boolean;
  fallbackInView?: boolean;
}

export function useIntersectionObserver(
  options: IntersectionOptions = {}
) {
  const {
    threshold = 0.1,
    root = null,
    rootMargin = '50px',
    triggerOnce = true,
    fallbackInView = false,
  } = options;

  const [isIntersecting, setIsIntersecting] = useState(fallbackInView);
  const [hasIntersected, setHasIntersected] = useState(false);
  const elementRef = useRef<Element | null>(null);

  const setRef = useCallback((element: Element | null) => {
    elementRef.current = element;
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // If triggerOnce is true and we've already intersected, stay intersected
    if (triggerOnce && hasIntersected) {
      setIsIntersecting(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isElementIntersecting = entry.isIntersecting;

        setIsIntersecting(isElementIntersecting);

        if (isElementIntersecting && triggerOnce) {
          setHasIntersected(true);
          // Disconnect observer after first intersection if triggerOnce is true
          observer.disconnect();
        }
      },
      { threshold, root, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, root, rootMargin, triggerOnce, hasIntersected]);

  return [setRef, isIntersecting] as const;
}

// Specialized hook for lazy image loading
export function useLazyImage(src: string, placeholder?: string) {
  const [imageSrc, setImageSrc] = useState(placeholder || '');
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [setRef, isIntersecting] = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '100px', // Load 100px before entering viewport
    triggerOnce: true,
  });

  useEffect(() => {
    if (isIntersecting && src && imageSrc !== src) {
      const img = new Image();

      img.onload = () => {
        setImageSrc(src);
        setIsLoaded(true);
        setHasError(false);
      };

      img.onerror = () => {
        setHasError(true);
        setIsLoaded(true);
      };

      img.src = src;
    }
  }, [isIntersecting, src, imageSrc]);

  return {
    ref: setRef,
    src: imageSrc,
    isLoaded,
    hasError,
    isIntersecting,
  };
}