/**
 * ShikiCodeBlock Component
 * 
 * Custom code block renderer for Streamdown with Shiki syntax highlighting.
 * Renders immediately with plain text, then asynchronously highlights with Shiki.
 */

'use client';

import React, { useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useCodeHighlight } from '@/hooks/use-code-highlight';
import { Button } from '@/components/ui/button';
import { IconCopy, IconCheck } from '@tabler/icons-react';

interface ShikiCodeBlockProps {
  code: string;
  language?: string;
  inline?: boolean;
}

export const ShikiCodeBlock = React.forwardRef<
  HTMLDivElement,
  ShikiCodeBlockProps
>(({ code, language = 'plain', inline = false }, ref) => {
  const codeRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  // Normalize language name
  const normalizedLanguage = useMemo(() => {
    return (language || 'plain').toLowerCase().trim();
  }, [language]);

  // Use highlighting hook
  useCodeHighlight({
    code,
    language: normalizedLanguage,
    elementRef: codeRef,
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  if (inline) {
    // Inline code - minimal styling
    return (
      <code
        className={cn(
          'font-mono text-sm leading-relaxed',
          'bg-code-bg text-code-text',
          'px-1.5 py-0.5 rounded',
          'border border-code-border'
        )}
      >
        {code}
      </code>
    );
  }

  // Block code
  return (
    <div
      ref={ref}
      className={cn(
        'relative group',
        'bg-code-bg text-code-text',
        'border border-code-border rounded-lg',
        'overflow-hidden',
        'my-4'
      )}
    >
      {/* Language badge */}
      {normalizedLanguage && normalizedLanguage !== 'plain' && (
        <div
          className={cn(
            'absolute top-2 right-12 z-10',
            'text-xs font-mono font-semibold',
            'text-code-meta uppercase tracking-wide',
            'opacity-0 group-hover:opacity-100 transition-opacity'
          )}
        >
          {normalizedLanguage}
        </div>
      )}

      {/* Copy button */}
      <Button
        size="sm"
        variant="ghost"
        className={cn(
          'absolute top-2 right-2 z-10',
          'h-8 w-8 p-0',
          'text-code-meta hover:text-code-text',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          'hover:bg-code-hover'
        )}
        onClick={handleCopy}
        title={copied ? 'Copied!' : 'Copy code'}
      >
        {copied ? (
          <IconCheck className="h-4 w-4" />
        ) : (
          <IconCopy className="h-4 w-4" />
        )}
      </Button>

      {/* Code container */}
      <pre className="m-0 overflow-x-auto">
        <div
          ref={codeRef}
          className={cn(
            'font-mono text-sm leading-relaxed',
            'p-4'
          )}
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        >
          {/* Fallback plain text (will be replaced by highlighted HTML) */}
          <code>{code}</code>
        </div>
      </pre>
    </div>
  );
});

ShikiCodeBlock.displayName = 'ShikiCodeBlock';
