/**
 * Mobile responsive utilities
 */

import React from 'react';

/**
 * Detect if device is mobile/tablet
 * Uses window.matchMedia for SSR safety
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return window.matchMedia('(max-width: 768px)').matches;
};

/**
 * Hook to detect mobile with hydration safety
 * Prevents hydration mismatch by returning server-safe value initially,
 * then syncing client-side state after mount
 */
export const useIsMobileDevice = (): boolean => {
  const [isMobile, setIsMobile] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useLayoutEffect(() => {
    // Sync the actual mobile state immediately (before paint)
    setIsMobile(isMobileDevice());
    setMounted(true);

    const handleResize = () => {
      setIsMobile(isMobileDevice());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // During SSR and initial client render, return false
  // After mount, return actual state
  if (!mounted) return false;
  
  return isMobile;
};
