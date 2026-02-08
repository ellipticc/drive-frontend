'use client';

import React, { useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { highlightCode } from '@/lib/shiki-highlighter';
import { 
  CodeComponent,
  HeadingComponent,
  LinkComponent,
  ListComponent,
  ListItemComponent,
  TableComponent,
  TableHeadComponent,
  TableBodyComponent,
  TableRowComponent,
  TableCellComponent,
  BlockquoteComponent,
  ParagraphComponent,
  ThematicBreakComponent,
} from '@/lib/rehype-shiki-plugin';

// Plugins for extended Markdown support
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  /**
   * Markdown content to render
   */
  content: string;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Whether to use tighter spacing (for chat messages)
   */
  compact?: boolean;
  /**
   * Callback when code content is detected
   */
  onCodeBlock?: (code: string, language: string) => void;
}

/**
 * Custom code block component with Shiki highlighting
 */
const ShikiCodeBlock: React.FC<{
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}> = ({ inline, className, children, ...props }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [highlightedHtml, setHighlightedHtml] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Extract language from className (remark-gfm adds language-X class)
  const language = useMemo(() => {
    if (!className) return 'plain';
    const match = className.match(/language-(\w+)/);
    return match ? match[1] : 'plain';
  }, [className]);

  // Get code text
  const codeText = useMemo(() => {
    if (typeof children === 'string') return children;
    if (Array.isArray(children)) return children.join('');
    return String(children || '');
  }, [children]);

  // Highlight code asynchronously
  React.useEffect(() => {
    if (inline || !codeText.trim()) return;

    setIsLoading(true);
    (async () => {
      try {
        const html = await highlightCode(codeText, language, isDark);
        setHighlightedHtml(html);
      } catch (error) {
        console.warn(`Failed to highlight code (${language}):`, error);
        setHighlightedHtml(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [codeText, language, isDark, inline]);

  // Inline code
  if (inline) {
    return (
      <code
        className={cn(
          'bg-muted px-1.5 py-0.5 rounded text-sm',
          'font-mono text-foreground/90',
          'inline-block whitespace-pre-wrap break-words'
        )}
        {...props}
      >
        {children}
      </code>
    );
  }

  // Block code
  return (
    <div className={cn('relative my-4 rounded-lg overflow-hidden', className)}>
      {!isLoading && highlightedHtml ? (
        <div
          className="overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        <pre className="p-4 m-0 bg-muted overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {children}
          </code>
        </pre>
      )}
    </div>
  );
};

/**
 * AST-based Markdown renderer with Shiki + Remark + Rehype
 * Handles streaming responses safely and renders rich formatting
 * 
 * Features:
 * - Remark + Rehype for proper Markdown AST parsing
 * - GFM support (tables, strikethrough, task lists)
 * - Math support (KaTeX)
 * - Shiki syntax highlighting for code blocks
 * - Fully streaming-safe (handles incomplete Markdown)
 * - Proper styling with Tailwind prose utilities
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
  compact = false,
  onCodeBlock,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Components mapping for react-markdown
  const components = useMemo(
    () => ({
      // Code blocks with Shiki highlighting
      code: ShikiCodeBlock as any,
      
      // Headings (no oversizing)
      h1: ({ node, ...props }: any) =>
        HeadingComponent({ level: 1, ...props }),
      h2: ({ node, ...props }: any) =>
        HeadingComponent({ level: 2, ...props }),
      h3: ({ node, ...props }: any) =>
        HeadingComponent({ level: 3, ...props }),
      h4: ({ node, ...props }: any) =>
        HeadingComponent({ level: 4, ...props }),
      h5: ({ node, ...props }: any) =>
        HeadingComponent({ level: 5, ...props }),
      h6: ({ node, ...props }: any) =>
        HeadingComponent({ level: 6, ...props }),
      
      // Links
      a: LinkComponent as any,
      
      // Lists
      ul: ({ node, ...props }: any) =>
        ListComponent({ ordered: false, ...props }),
      ol: ({ node, ...props }: any) =>
        ListComponent({ ordered: true, ...props }),
      li: ListItemComponent as any,
      
      // Tables
      table: TableComponent as any,
      thead: TableHeadComponent as any,
      tbody: TableBodyComponent as any,
      tr: TableRowComponent as any,
      th: ({ node, ...props }: any) =>
        TableCellComponent({ isHeader: true, ...props }),
      td: ({ node, ...props }: any) =>
        TableCellComponent({ isHeader: false, ...props }),
      
      // Other elements
      blockquote: BlockquoteComponent as any,
      p: ParagraphComponent as any,
      hr: ThematicBreakComponent as any,
      
      // Strong and emphasis (using default behavior)
      strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
      em: ({ children }: any) => <em className="italic">{children}</em>,
    }),
    []
  );

  // Remark plugins for Markdown parsing
  const remarkPlugins = useMemo(
    () => [remarkGfm, remarkMath],
    []
  );

  // Rehype plugins for AST transformation
  const rehypePlugins = useMemo(
    () => [rehypeKatex],
    []
  );

  return (
    <div
      className={cn(
        // Base prose styling
        'prose dark:prose-invert max-w-none',
        'prose-sm',
        
        // Prose element sizing
        'prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl',
        'prose-p:text-sm prose-p:text-foreground',
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        'prose-strong:font-semibold prose-strong:text-foreground',
        'prose-code:text-foreground prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded',
        'prose-pre:bg-muted prose-pre:border prose-pre:border-border',
        'prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto',
        'prose-blockquote:border-l-4 prose-blockquote:pl-4 prose-blockquote:italic',
        'prose-blockquote:text-muted-foreground',
        'prose-table:border-collapse prose-table:w-full',
        'prose-tr:border-b prose-tr:border-border',
        'prose-th:bg-muted prose-th:text-left prose-th:font-semibold prose-th:p-2',
        'prose-td:p-2 prose-td:text-foreground',
        'prose-ul:list-disc prose-ul:ml-6 prose-ol:list-decimal prose-ol:ml-6',
        'prose-li:text-foreground',
        
        // Remove margins if compact
        compact && [
          'prose-h1:mt-4 prose-h1:mb-2',
          'prose-h2:mt-3 prose-h2:mb-2',
          'prose-h3:mt-2 prose-h3:mb-1',
          'prose-p:my-1',
          'prose-ul:my-1 prose-ol:my-1',
          'prose-blockquote:my-2',
          'prose-pre:my-2',
        ],
        
        // Custom overrides
        'text-foreground',
        
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
        // Allow dangerouslyAllowHtml only for highlighted code (sanitized by Shiki)
        skipHtml={false}
        allowElement={({ tagName, properties }) => {
          // Allow custom elements from plugins
          return true;
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
