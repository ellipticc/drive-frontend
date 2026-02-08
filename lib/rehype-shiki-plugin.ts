/**
 * Custom React component overrides for react-markdown
 * Handles code blocks with Shiki highlighting and styling
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface CodeComponentProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

/**
 * Code component renderer for react-markdown
 * Handles both inline code and code blocks
 */
export const CodeComponent = React.forwardRef<HTMLElement, CodeComponentProps>(
  ({ inline, className, children, ...props }, ref) => {
    // Inline code
    if (inline) {
      return React.createElement('code', {
        ref: ref as any,
        className: cn(
          'bg-muted px-1.5 py-0.5 rounded text-sm',
          'font-mono text-foreground/90',
          'inline-block whitespace-pre-wrap break-words'
        ),
        ...props,
        children,
      });
    }

    // Block code - will be highlighted via react-markdown with shiki
    return React.createElement('code', {
      ref: ref as any,
      className: cn('block', className),
      ...props,
      children,
    });
  }
);

CodeComponent.displayName = 'CodeComponent';

/**
 * Heading component renderer
 * Adds proper styling and sizes
 */
export const HeadingComponent: React.FC<{
  level: number;
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}> = ({ level, children, className, ...props }) => {
  const headingClass = {
    1: 'text-3xl font-bold mt-8 mb-4',
    2: 'text-2xl font-bold mt-6 mb-3',
    3: 'text-xl font-bold mt-4 mb-2',
    4: 'text-lg font-bold mt-3 mb-2',
    5: 'text-base font-bold mt-2 mb-1',
    6: 'text-sm font-bold mt-2 mb-1',
  }[level] || 'text-base font-bold';

  const Component = `h${level}` as any;

  return React.createElement(Component as any, {
    className: cn(headingClass, 'tracking-tight', className),
    ...props,
    children,
  });
};

/**
 * Link component renderer
 */
export const LinkComponent: React.FC<{
  href?: string;
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}> = ({ href, children, className, ...props }) => {
  return React.createElement('a', {
    href,
    className: cn(
      'text-primary underline hover:text-primary/80',
      'transition-colors duration-200',
      className
    ),
    target: '_blank',
    rel: 'noopener noreferrer',
    ...props,
    children,
  });
};

/**
 * List component renderer
 */
export const ListComponent: React.FC<{
  ordered?: boolean;
  depth?: number;
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}> = ({ ordered, depth = 0, children, className, ...props }) => {
  const Component = ordered ? 'ol' : 'ul';
  const baseClass = ordered ? 'list-decimal' : 'list-disc';

  return React.createElement(Component, {
    className: cn(baseClass, 'ml-6 my-2 space-y-1', className),
    ...props,
    children,
  });
};

/**
 * List item component renderer
 */
export const ListItemComponent: React.FC<{
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}> = ({ children, className, ...props }) => {
  return React.createElement('li', {
    className: cn('text-foreground', className),
    ...props,
    children,
  });
};

/**
 * Table component renderer
 */
export const TableComponent: React.FC<{
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}> = ({ children, className, ...props }) => {
  return React.createElement(
    'div',
    {
      className: 'overflow-x-auto my-4',
    },
    React.createElement('table', {
      className: cn('w-full border-collapse', 'border border-border', className),
      ...props,
      children,
    })
  );
};

/**
 * Table head component renderer
 */
export const TableHeadComponent: React.FC<{
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}> = ({ children, className, ...props }) => {
  return React.createElement('thead', {
    className: cn('bg-muted/50 border-b border-border', className),
    ...props,
    children,
  });
};

/**
 * Table body component renderer
 */
export const TableBodyComponent: React.FC<{
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}> = ({ children, className, ...props }) => {
  return React.createElement('tbody', {
    className: cn(className),
    ...props,
    children,
  });
};

/**
 * Table row component renderer
 */
export const TableRowComponent: React.FC<{
  children?: React.ReactNode;
  className?: string;
  isHeader?: boolean;
  [key: string]: any;
}> = ({ children, className, isHeader, ...props }) => {
  return React.createElement('tr', {
    className: cn(
      'border-b border-border hover:bg-muted/50 transition-colors',
      isHeader && 'bg-muted/50',
      className
    ),
    ...props,
    children,
  });
};

/**
 * Table cell component renderer
 */
export const TableCellComponent: React.FC<{
  children?: React.ReactNode;
  className?: string;
  isHeader?: boolean;
  align?: 'left' | 'center' | 'right';
  [key: string]: any;
}> = ({ children, className, isHeader, align = 'left', ...props }) => {
  const Component = isHeader ? 'th' : 'td';
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[align];

  return React.createElement(Component, {
    className: cn(
      'px-3 py-2 text-sm',
      alignClass,
      isHeader && 'font-semibold',
      className
    ),
    ...props,
    children,
  });
};

/**
 * Blockquote component renderer
 */
export const BlockquoteComponent: React.FC<{
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}> = ({ children, className, ...props }) => {
  return React.createElement('blockquote', {
    className: cn(
      'border-l-4 border-muted-foreground/30 pl-4 py-1 my-2',
      'italic text-muted-foreground',
      className
    ),
    ...props,
    children,
  });
};

/**
 * Paragraph component renderer
 */
export const ParagraphComponent: React.FC<{
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}> = ({ children, className, ...props }) => {
  return React.createElement('p', {
    className: cn('my-2 leading-relaxed', className),
    ...props,
    children,
  });
};

/**
 * Horizontal rule component renderer
 */
export const ThematicBreakComponent: React.FC<{
  className?: string;
  [key: string]: any;
}> = ({ className, ...props }) => {
  return React.createElement('hr', {
    className: cn('my-4 border-0 border-t border-border', className),
    ...props,
  });
};


