import { useRef, useCallback, useEffect, useState } from 'react';

interface UseTablePointerHoverReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  hoverRowIndex: number | null;
  hoverHighlightStyle: React.CSSProperties;
}

/**
 * useTablePointerHover - High-performance row hover tracking using pointer events
 * 
 * Instead of per-row hover state:
 * - Single pointermove listener on table container
 * - Calculates row index from cursor Y position
 * - Renders one floating overlay with transform-based positioning
 * - No per-row re-renders during hover
 */
export function useTablePointerHover(rowHeight: number = 44): UseTablePointerHoverReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverRowIndex, setHoverRowIndex] = useState<number | null>(null);
  const scrollOffsetRef = useRef(0);
  const lastClientYRef = useRef<number | null>(null);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clientY = e.clientY;

    // Check if cursor is within table bounds
    if (clientY < rect.top || clientY > rect.bottom) {
      setHoverRowIndex(null);
      lastClientYRef.current = null;
      return;
    }

    // Calculate position relative to table
    const relativeY = clientY - rect.top;

    // Find table body or rows container
    const tableBody = containerRef.current.querySelector('tbody') || 
                      containerRef.current.querySelector('[role="rowgroup"]') ||
                      containerRef.current;
    
    if (!tableBody) {
      setHoverRowIndex(null);
      return;
    }

    // Account for scroll offset within the container
    const scrollY = tableBody.parentElement?.scrollTop || 0;
    const absoluteY = relativeY + scrollY;

    // Calculate which row index
    const rowIndex = Math.floor(absoluteY / rowHeight);

    // Get actual row count to prevent index overflow
    const rows = tableBody.querySelectorAll('tr');
    if (rowIndex >= 0 && rowIndex < rows.length) {
      setHoverRowIndex(rowIndex);
      lastClientYRef.current = clientY;
    } else {
      setHoverRowIndex(null);
    }
  }, [rowHeight]);

  const handlePointerLeave = useCallback(() => {
    setHoverRowIndex(null);
    lastClientYRef.current = null;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Store scroll offset for calculations
    const handleScroll = () => {
      const tableBody = container.querySelector('tbody') || 
                        container.querySelector('[role="rowgroup"]');
      if (tableBody?.parentElement) {
        scrollOffsetRef.current = tableBody.parentElement.scrollTop || 0;
      }
    };

    container.addEventListener('pointermove', handlePointerMove as EventListener);
    container.addEventListener('pointerleave', handlePointerLeave as EventListener);
    container.addEventListener('scroll', handleScroll, true);

    return () => {
      container.removeEventListener('pointermove', handlePointerMove as EventListener);
      container.removeEventListener('pointerleave', handlePointerLeave as EventListener);
      container.removeEventListener('scroll', handleScroll, true);
    };
  }, [handlePointerMove, handlePointerLeave]);

  // Calculate Y position for overlay using transform (non-layout-affecting)
  const translateY = hoverRowIndex !== null ? hoverRowIndex * rowHeight : 0;

  const hoverHighlightStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: `${rowHeight}px`,
    pointerEvents: 'none',
    transform: `translateY(${translateY}px)`,
    opacity: hoverRowIndex !== null ? 1 : 0,
    transition: 'opacity 0.15s ease-out',
    zIndex: 0,
    background: 'var(--hover-overlay-bg, hsl(var(--muted) / 0.5))',
    borderRadius: '0.375rem',
  };

  return {
    containerRef,
    hoverRowIndex,
    hoverHighlightStyle,
  };
}
