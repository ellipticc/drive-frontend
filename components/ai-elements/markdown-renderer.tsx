'use client';

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

// Import custom markdown components
import {
  CodeBlock,
  InlineCode,
  H1,
  H2,
  H3,
  H4,
  H5,
  H6,
  Text,
  UnorderedList,
  OrderedList,
  ListItem,
  BlockQuote,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Link,
  Strong,
  Emphasis,
  HorizontalRule,
  Break,
} from '@/components/ai-elements/markdown-components';

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
}

/**
 * AST-based Markdown renderer with Shiki + Remark + Rehype
 * Handles streaming responses safely and renders rich formatting using custom design system components
 * 
 * Features:
 * - Remark + Rehype for proper Markdown AST parsing
 * - GFM support (tables, strikethrough, task lists)
 * - Math support (KaTeX)
 * - Shiki syntax highlighting for code blocks
 * - Fully streaming-safe (handles incomplete Markdown)
 * - Custom design system components for all elements
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
  compact = false,
}) => {
  // Normalize problematic unicode characters (e.g., en-dash) to avoid strict LaTeX warnings in rehype-katex
  const safeContent = React.useMemo(() => {
    if (!content) return content;
    return content.replace(/\u2013|\u2014/g, '-');
  }, [content]);
  // Components mapping for react-markdown
  const components = useMemo(
    () => ({
      // Code blocks with Shiki highlighting
      code: (props: any) => {
        const { inline, className: codeClassName, children } = props;
        const content = typeof children === 'string' ? children : String(children || '');

        if (inline) {
          return <InlineCode>{children}</InlineCode>;
        }

        // Extract language hint from className
        const language = codeClassName
          ? codeClassName.match(/language-(\w+)/)?.[1]
          : undefined;
        const hasLanguageHint = !!language;

        // Heuristic: if NO language hint and single-line and reasonable length (≤150 chars),
        // it's likely backtick code that was misparsed as a fenced block
        if (!hasLanguageHint && !content.includes('\n') && content.length <= 150) {
          return <InlineCode>{content}</InlineCode>;
        }

        return (
          <CodeBlock
            language={language || 'plain'}
            code={content}
          />
        );
      },

      // Headings
      h1: H1 as any,
      h2: H2 as any,
      h3: H3 as any,
      h4: H4 as any,
      h5: H5 as any,
      h6: H6 as any,

      // Text
      p: Text as any,

      // Lists
      ul: UnorderedList as any,
      ol: OrderedList as any,
      li: ListItem as any,

      // Tables
      table: Table as any,
      thead: TableHead as any,
      tbody: TableBody as any,
      tr: TableRow as any,
      th: (props: any) => <TableCell {...props} isHeader={true} />,
      td: (props: any) => <TableCell {...props} isHeader={false} />,

      // Other elements
      blockquote: BlockQuote as any,
      a: Link as any,
      hr: HorizontalRule as any,
      br: Break as any,

      // Text formatting
      strong: Strong as any,
      em: Emphasis as any,
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
        // Base wrapper with prose styling
        'prose dark:prose-invert max-w-none',
        
        // Remove margins if compact
        compact && [
          '[&>*:first-child]:mt-0',
          '[&>*:last-child]:mb-0',
          '[&_h1]:mt-3 [&_h1]:mb-2',
          '[&_h2]:mt-2.5 [&_h2]:mb-1.5',
          '[&_h3]:mt-2 [&_h3]:mb-1',
          '[&_p]:my-1.5',
          '[&_ul]:my-1 [&_ol]:my-1',
          '[&_blockquote]:my-2',
          '[&_pre]:my-2',
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
      >
        {safeContent}
      </ReactMarkdown>
    </div>
  );
};
