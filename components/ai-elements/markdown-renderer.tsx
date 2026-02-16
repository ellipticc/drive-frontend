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
  MathInline,
  MathBlock,
} from '@/components/ai-elements/markdown-components';

// Plugins for extended Markdown support
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
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
   * Whether content is actively being streamed — skips syntax highlighting
   */
  isStreaming?: boolean;
}

/**
 * AST-based Markdown renderer with Shiki + Remark + Rehype
 * Handles streaming responses safely and renders rich formatting using custom design system components
 * 
 * Features:
 * - Remark + Rehype for proper Markdown AST parsing
 * - GFM support (tables, strikethrough, task lists)
 * - Math support (KaTeX)
 */
const InternalMarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
  compact = false,
  isStreaming = false,
}) => {
  // Normalize problematic unicode characters
  const safeContent = React.useMemo(() => {
    if (!content) return content;
    // Normalize dashes
    return content.replace(/\u2013|\u2014/g, '-');
  }, [content]);

  // Components mapping for react-markdown
  const components = useMemo(
    () => ({
      // Inline code only — bare `code` elements (backtick `code`)
      code: (props: any) => {
        const { children } = props;
        return <InlineCode>{children}</InlineCode>;
      },

      // Fenced code blocks — `pre` wraps `code` in react-markdown AST
      // Extract the child <code> element, read its language + content, render CodeBlock
      pre: (props: any) => {
        const { children } = props;
        // react-markdown renders <pre><code className="language-X">...</code></pre>
        const codeChild = React.Children.toArray(children).find(
          (child: any) => child?.type === 'code' || child?.props?.className
        ) as React.ReactElement<any> | undefined;

        if (codeChild?.props) {
          const { className: codeClassName, children: codeChildren } = codeChild.props;
          const language = codeClassName
            ? codeClassName.match(/language-(\w+)/)?.[1]
            : undefined;
          const content = typeof codeChildren === 'string'
            ? codeChildren
            : String(codeChildren || '');

          return (
            <div className="w-full max-w-full overflow-hidden my-4 rounded-lg">
              <CodeBlock
                language={language || 'plain'}
                code={content}
                className="my-0 w-full max-w-full"
                isStreaming={isStreaming}
              />
            </div>
          );
        }

        // Fallback: render as-is if no code child found
        return <pre>{children}</pre>;
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

      // Math
      math: (props: any) => <MathBlock {...props} />,
      inlineMath: (props: any) => <MathInline {...props} />,

      // Text formatting
      strong: Strong as any,
      em: Emphasis as any,
    }),
    []
  );

  // Remark plugins for Markdown parsing
  const remarkPlugins = useMemo(
    () => [remarkGfm, remarkMath, remarkBreaks],
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
        // Base wrapper with prose styling - increased text size from default
        'prose dark:prose-invert prose-base max-w-none w-full overflow-hidden',
        '[&_pre]:overflow-x-auto [&_pre]:max-w-full [&_pre]:w-full',
        '[&_code]:break-words',

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

export const MarkdownRenderer = React.memo(InternalMarkdownRenderer);
