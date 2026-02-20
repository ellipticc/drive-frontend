/**
 * Mobile responsive utilities
 */

/**
 * Detect if device is mobile/tablet
 * Uses window.matchMedia for SSR safety
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return window.matchMedia('(max-width: 768px)').matches;
};

/**
 * Hook to detect mobile
 */
export const useIsMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const [isMobile, setIsMobile] = React.useState(isMobileDevice());

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return isMobile;
};

// Simpler hook version
import React from 'react';

export const useIsMobileDevice = (): boolean => {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    setIsMobile(isMobileDevice());

    const handleResize = () => {
      setIsMobile(isMobileDevice());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
};
