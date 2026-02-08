/**
 * StreamdownWithShiki
 * 
 * Drop-in replacement for Streamdown that automatically applies Shiki highlighting
 * to code blocks. Works seamlessly with all Streamdown plugins.
 * 
 * The workflow:
 * 1. Streamdown renders markdown with plain <pre><code> blocks
 * 2. We detect these blocks via MutationObserver
 * 3. Extract code content and language
 * 4. Apply Shiki highlighting asynchronously
 * 5. Replace inner HTML with highlighted version
 * 6. Support theme switching with re-highlighting
 */

'use client';

import React, { useEffect } from 'react';
import { Streamdown } from 'streamdown';
import { highlightCode, prefetchHighlighter } from '@/lib/shiki-highlighter';
import { useTheme } from 'next-themes';

interface StreamdownWithShikiProps {
  children: string;
  plugins?: any;
  className?: string;
}

/**
 * Wrapper that applies Shiki highlighting to Streamdown code blocks
 */
export const StreamdownWithShiki = React.forwardRef<
  HTMLDivElement,
  StreamdownWithShikiProps
>(({ children, plugins, className }, ref) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const containerRef = React.useRef<HTMLDivElement>(null);
  const highlightedBlocksRef = React.useRef<WeakSet<HTMLElement>>(new WeakSet());
  const observerRef = React.useRef<MutationObserver | null>(null);

  // Prefetch highlighter on mount (non-blocking)
  useEffect(() => {
    prefetchHighlighter().catch(() => {
      // Ignore - we have fallback plain code
    });
  }, []);

  // Clean code by removing common language specifiers from first line
  const cleanCode = (code: string): { code: string; language: string } => {
    const lines = code.split('\n');
    const firstLine = lines[0].trim();
    
    // Common language markers that might appear as first line
    const langPatterns = [
      { pattern: /^\/\/\s*/, lang: 'javascript' },  // // javascript
      { pattern: /^#\s*/, lang: 'bash' },           // # bash/shell
      { pattern: /^<!/, lang: 'html' },             // <! (HTML)
      { pattern: /^<\?/, lang: 'php' },             // <? (PHP)
    ];
    
    for (const { pattern, lang: detectedLang } of langPatterns) {
      if (pattern.test(firstLine) && lines.length > 1) {
        // This looks like a language marker, remove it
        return {
          code: lines.slice(1).join('\n'),
          language: detectedLang
        };
      }
    }
    
    return { code, language: 'plain' };
  };

  // Process and highlight code blocks
  const highlightCodeBlocks = React.useCallback(async () => {
    if (!containerRef.current) return;

    const codeBlocks = containerRef.current.querySelectorAll(
      'pre > code'
    ) as NodeListOf<HTMLElement>;

    if (!codeBlocks?.length) return;

    for (const codeBlock of codeBlocks) {
      const preElement = codeBlock.parentElement as HTMLElement;

      // Skip if already processed
      if (highlightedBlocksRef.current.has(codeBlock)) {
        continue; // Already highlighted
      }

      let language = 'plain'; // Declare outside try/catch for error handling

      try {
        let code = codeBlock.textContent || '';
        if (!code.trim()) continue;

        // Extract language from class or pre element, or clean from code
        const langMatch =
          codeBlock.className?.match(/language-(\w+)/) ||
          preElement.className?.match(/language-(\w+)/);
        
        if (!langMatch) {
          // No language class found, check if code has language marker
          const cleaned = cleanCode(code);
          code = cleaned.code;
          language = cleaned.language;
        } else {
          language = langMatch[1];
        }

        // Highlight asynchronously
        const highlightedHtml = await highlightCode(code, language, isDark);

        // Parse Shiki's output
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = highlightedHtml;

        const shikiCode = tempDiv.querySelector('code');
        const shikiPre = tempDiv.querySelector('pre');

        if (shikiCode?.innerHTML) {
          // Replace code block content with Shiki output
          codeBlock.innerHTML = shikiCode.innerHTML;

          // Apply Shiki's pre styles if available
          if (shikiPre?.style) {
            const bgColor = shikiPre.style.backgroundColor;
            const color = shikiPre.style.color;
            if (bgColor) preElement.style.backgroundColor = bgColor;
            if (color) preElement.style.color = color;
          }

          // Mark as processed
          highlightedBlocksRef.current.add(codeBlock);
        }
      } catch (error) {
        console.warn(`Failed to highlight code block (${language}):`, error);
        // Keep plain code fallback - already in DOM
      }
    }
  }, [isDark]);

  // Watch for DOM changes (Streamdown rendering)
  useEffect(() => {
    if (!containerRef.current) return;

    // Initial highlight
    highlightCodeBlocks();

    // Watch for new code blocks from Streamdown
    const observer = new MutationObserver((mutations) => {
      let hasCodeBlocks = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          // Check if any nodes are code-related
          const hasPreTag = Array.from(mutation.addedNodes).some(
            (node) =>
              node instanceof HTMLElement &&
              (node.tagName === 'PRE' ||
                node.tagName === 'CODE' ||
                node.querySelector?.('pre, code'))
          );

          if (hasPreTag) {
            hasCodeBlocks = true;
            break;
          }
        }
      }

      if (hasCodeBlocks) {
        // Delay slightly to let DOM settle
        setTimeout(() => highlightCodeBlocks(), 50);
      }
    });

    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
      characterData: false, // Don't monitor text changes
    });

    observerRef.current = observer;

    return () => observer.disconnect();
  }, [highlightCodeBlocks]);

  // Re-highlight on theme change
  useEffect(() => {
    if (!containerRef.current) return;

    // Clear processed markers on theme change so blocks are re-highlighted
    highlightedBlocksRef.current = new WeakSet();
    highlightCodeBlocks();
  }, [isDark, highlightCodeBlocks]);

  return (
    <div ref={containerRef} className={className}>
      <Streamdown plugins={plugins}>
        {children}
      </Streamdown>
    </div>
  );
});

StreamdownWithShiki.displayName = 'StreamdownWithShiki';
