'use client';

import React, { useState, useRef } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { IconCopy, IconCheck, IconMaximize } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { highlightCode } from '@/lib/shiki-highlighter';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

/**
 * CodeBlock Component
 * Renders fenced code blocks with Shiki highlighting, language label, and copy button
 */
export const CodeBlock = React.forwardRef<
  HTMLDivElement,
  {
    language?: string;
    code?: string;
    children?: React.ReactNode;
    className?: string;
  }
>(({ language = 'plain', code, children, className }, ref) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Get code content
  const codeContent = code || (typeof children === 'string' ? children : String(children || ''));

  // Highlight code asynchronously
  React.useEffect(() => {
    if (!codeContent.trim()) return;

    setIsLoading(true);
    (async () => {
      try {
        const html = await highlightCode(codeContent, language, isDark);
        setHighlightedHtml(html);
      } catch (error) {
        console.warn(`Failed to highlight code (${language}):`, error);
        setHighlightedHtml(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [codeContent, language, isDark]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Format language label
  const labelMap: Record<string, string> = {
    'javascript': 'JavaScript',
    'typescript': 'TypeScript',
    'python': 'Python',
    'jsx': 'JSX',
    'tsx': 'TSX',
    'json': 'JSON',
    'html': 'HTML',
    'css': 'CSS',
    'bash': 'Bash',
    'shell': 'Shell',
    'sql': 'SQL',
    'java': 'Java',
    'cpp': 'C++',
    'csharp': 'C#',
    'php': 'PHP',
    'ruby': 'Ruby',
    'go': 'Go',
    'rust': 'Rust',
  };
  const displayLabel = labelMap[language] || (language === 'plain' ? 'Code' : language.charAt(0).toUpperCase() + language.slice(1));

  return (
    <div
      ref={ref}
      className={cn(
        'my-4 rounded-lg overflow-hidden border border-border/50',
        'bg-muted',
        className
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/80 border-b border-border/30">
        <span className="text-xs font-semibold text-muted-foreground">
          {displayLabel}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            className="h-6 w-6 p-0"
            title="Preview in full screen"
          >
            <IconMaximize className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-6 w-6 p-0"
            title={copied ? 'Copied!' : 'Copy code'}
          >
            {copied ? (
              <IconCheck className="h-4 w-4 text-green-500" />
            ) : (
              <IconCopy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            )}
          </Button>
        </div>
      </div>

      {/* Code content */}
      <div className="overflow-x-auto">
        {!isLoading && highlightedHtml ? (
          <div
            className="p-4 text-sm"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <pre className="p-4 m-0 text-sm font-mono text-foreground">
            <code>{codeContent}</code>
          </pre>
        )}
      </div>

      {/* Code Preview Sheet */}
      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent side="right" resizable initialFraction={0.45} minWidth={320} className="max-w-none p-0 bg-background">
          <div className="flex flex-col h-full">
            {/* Sheet Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
              <div>
                <SheetTitle className="text-base font-semibold">{displayLabel}</SheetTitle>
                <p className="text-xs text-muted-foreground mt-1">Full screen preview</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 gap-2"
                title={copied ? 'Copied!' : 'Copy code'}
              >
                {copied ? (
                  <>
                    <IconCheck className="h-4 w-4 text-green-500" />
                    <span className="text-xs">Copied</span>
                  </>
                ) : (
                  <>
                    <IconCopy className="h-4 w-4" />
                    <span className="text-xs">Copy</span>
                  </>
                )}
              </Button>
            </div>

            {/* Sheet Content - Large Code Preview */}
            <div className="flex-1 overflow-auto p-6">
              <div className="rounded-lg border border-border/50 bg-muted overflow-hidden">
                <div className="overflow-x-auto">
                  {!isLoading && highlightedHtml ? (
                    <div
                      className="p-6 text-base font-mono"
                      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                    />
                  ) : (
                    <pre className="p-6 m-0 text-base font-mono text-foreground whitespace-pre-wrap break-words">
                      <code>{codeContent}</code>
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';

/**
 * InlineCode Component
 * Renders single backtick code as inline element
 */
export const InlineCode: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <code
    className={cn(
      'inline-block align-baseline max-w-full overflow-x-auto whitespace-nowrap px-1.5 py-0.5 rounded',
      'bg-muted text-xs font-mono text-foreground/90',
      className
    )}
  >
    {children}
  </code>
);

/**
 * Heading Components
 */
export const H1: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <h1
    className={cn(
      'text-2xl sm:text-3xl font-bold',
      'text-foreground',
      'mt-6 mb-3 first:mt-0',
      'tracking-tight',
      className
    )}
  >
    {children}
  </h1>
);

export const H2: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <h2
    className={cn(
      'text-xl sm:text-2xl font-bold',
      'text-foreground',
      'mt-5 mb-2.5',
      'tracking-tight',
      className
    )}
  >
    {children}
  </h2>
);

export const H3: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <h3
    className={cn(
      'text-lg font-bold',
      'text-foreground',
      'mt-4 mb-2',
      'tracking-tight',
      className
    )}
  >
    {children}
  </h3>
);

export const H4: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <h4
    className={cn(
      'text-base font-bold',
      'text-foreground',
      'mt-3 mb-1.5',
      'tracking-tight',
      className
    )}
  >
    {children}
  </h4>
);

export const H5: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <h5
    className={cn(
      'text-sm font-bold',
      'text-foreground',
      'mt-2 mb-1',
      className
    )}
  >
    {children}
  </h5>
);

export const H6: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <h6
    className={cn(
      'text-xs font-bold uppercase',
      'text-muted-foreground',
      'mt-2 mb-1',
      'tracking-wide',
      className
    )}
  >
    {children}
  </h6>
);

/**
 * Text/Paragraph Component
 */
export const Text: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <p
    className={cn(
      'text-foreground',
      'text-sm leading-relaxed',
      'my-2',
      className
    )}
  >
    {children}
  </p>
);

/**
 * List Components
 */
export const UnorderedList: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <ul
    className={cn(
      'list-disc list-inside',
      'my-3 space-y-1.5 ml-2',
      'text-foreground text-sm',
      className
    )}
  >
    {children}
  </ul>
);

export const OrderedList: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <ol
    className={cn(
      'list-decimal list-inside',
      'my-3 space-y-1.5 ml-2',
      'text-foreground text-sm',
      className
    )}
  >
    {children}
  </ol>
);

export const ListItem: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <li className={cn('text-foreground', className)}>
    {children}
  </li>
);

/**
 * BlockQuote Component
 */
export const BlockQuote: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <blockquote
    className={cn(
      'border-l-4 border-primary/30 pl-4',
      'py-2 my-3',
      'bg-muted/50 rounded',
      'italic text-muted-foreground text-sm',
      className
    )}
  >
    {children}
  </blockquote>
);

/**
 * Table Components - Using security tab styling
 */
export const Table: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <div className={cn('my-4 border rounded-lg overflow-hidden bg-card', className)}>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        {children}
      </table>
    </div>
  </div>
);

export const TableHead: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <thead className={cn('bg-muted/50 border-b', className)}>
    {children}
  </thead>
);

export const TableBody: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <tbody className={cn('divide-y', className)}>
    {children}
  </tbody>
);

export const TableRow: React.FC<{
  children?: React.ReactNode;
  className?: string;
  isHeader?: boolean;
}> = ({ children, className, isHeader }) => (
  <tr className={cn('hover:bg-muted/30 transition-colors', className)}>
    {children}
  </tr>
);

export const TableCell: React.FC<{
  children?: React.ReactNode;
  className?: string;
  isHeader?: boolean;
  align?: 'left' | 'center' | 'right';
}> = ({ children, className, isHeader, align = 'left' }) => {
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[align];

  if (isHeader) {
    return (
      <th className={cn('px-4 py-3 font-medium text-muted-foreground text-xs tracking-wider', alignClass, className)}>
        {children}
      </th>
    );
  }

  return (
    <td className={cn('px-4 py-3', alignClass, className)}>
      {children}
    </td>
  );
};

/**
 * Link Component
 */
export const Link: React.FC<{
  href?: string;
  children?: React.ReactNode;
  className?: string;
}> = ({ href, children, className }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className={cn(
      'text-primary font-medium',
      'hover:text-primary/80 hover:underline',
      'transition-colors duration-200',
      'break-words',
      className
    )}
  >
    {children}
  </a>
);

/**
 * Strong/Bold Component
 */
export const Strong: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <strong className={cn('font-semibold text-foreground', className)}>
    {children}
  </strong>
);

/**
 * Emphasis/Italic Component
 */
export const Emphasis: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <em className={cn('italic', className)}>
    {children}
  </em>
);

/**
 * Horizontal Rule Component
 */
export const HorizontalRule: React.FC<{
  className?: string;
}> = ({ className }) => (
  <hr
    className={cn(
      'my-4 border-0 border-t border-border/50',
      className
    )}
  />
);

/**
 * Break Component
 */
export const Break: React.FC<{
  className?: string;
}> = ({ className }) => (
  <div className={cn('h-2', className)} />
);
