'use client';

import React, { useState, useEffect } from 'react';
import { IconBrain, IconChevronRight } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ content, isStreaming = false }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [displayContent, setDisplayContent] = useState(content);

  useEffect(() => {
    setDisplayContent(content);
  }, [content]);

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-border/30 bg-muted/40">
      {/* Header with Shimmer */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/60 transition-colors group"
      >
        <div className="relative">
          <IconBrain className="h-4 w-4 text-primary/70" />
          {isStreaming && (
            <div className="absolute inset-0 animate-pulse">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 blur-sm rounded-full" />
            </div>
          )}
        </div>
        <span className="text-sm font-medium text-foreground/80">
          {isStreaming ? 'Thinking…' : 'Thinking'}
        </span>
        <div className="ml-auto">
          <IconChevronRight
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              !isExpanded ? 'rotate-90' : ''
            )}
          />
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-3 pt-2 border-t border-border/20">
          <div className="text-sm text-foreground/70 leading-relaxed whitespace-pre-wrap">
            {displayContent}
          </div>
        </div>
      )}
    </div>
  );
};
