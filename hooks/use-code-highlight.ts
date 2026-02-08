/**
 * useCodeHighlight Hook
 * 
 * Manages async code highlighting with theme support.
 * Renders plain code immediately, then updates with highlighted output.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { highlightCode, isHighlighterReady, prefetchHighlighter } from '@/lib/shiki-highlighter';

interface UseCodeHighlightProps {
  code: string;
  language: string;
  elementRef: React.RefObject<HTMLDivElement | null>;
}

export function useCodeHighlight({ code, language, elementRef }: UseCodeHighlightProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const highlightedRef = useRef(false);

  // Prefetch highlighter on mount (non-blocking)
  useEffect(() => {
    if (!isHighlighterReady()) {
      prefetchHighlighter().catch(() => {
        // Ignore errors - highlighting is optional
      });
    }
  }, []);

  // Highlight code when:
  // 1. Code content changes
  // 2. Language changes
  // 3. Theme changes
  useEffect(() => {
    if (!elementRef.current || !code) return;

    // Prevent duplicate highlighting
    if (highlightedRef.current && theme) {
      highlightedRef.current = false;
    }

    const highlightAsync = async () => {
      try {
        const html = await highlightCode(code, language, isDark);

        if (elementRef.current) {
          elementRef.current.innerHTML = html;
        }

        highlightedRef.current = true;
      } catch (error) {
        console.error('Highlighting error:', error);
        // Keep plain code fallback
      }
    };

    // Delay highlighting slightly to not block initial render
    const timer = requestIdleCallback(() => highlightAsync(), { timeout: 1000 });

    return () => cancelIdleCallback(timer);
  }, [code, language, isDark, elementRef]);
}
