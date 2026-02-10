'use client';

import React, { useState, useEffect, useRef } from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface ReasoningContextType {
  isStreaming: boolean;
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
  duration: number | undefined;
}

const ReasoningContext = React.createContext<ReasoningContextType | null>(null);

export interface ReasoningProps {
  isStreaming?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export interface ReasoningTriggerProps {
  className?: string;
}

export interface ReasoningContentProps {
  children: string;
  className?: string;
}

export const Reasoning: React.FC<ReasoningProps> = ({
  isStreaming = false,
  defaultOpen = false,
  children,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultOpen);
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const startTimeRef = useRef<number | null>(null);

  // Track streaming duration
  useEffect(() => {
    if (isStreaming) {
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }
    } else if (startTimeRef.current !== null) {
      setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
      startTimeRef.current = null;
    }
  }, [isStreaming]);

  return (
    <ReasoningContext.Provider value={{ isStreaming, isExpanded, setIsExpanded, duration }}>
      <div className={cn('w-full space-y-0', className)}>
        {children}
      </div>
    </ReasoningContext.Provider>
  );
};

export const ReasoningTrigger: React.FC<ReasoningTriggerProps> = ({ className }) => {
  const context = React.useContext(ReasoningContext);
  if (!context) return null;

  const { isExpanded, setIsExpanded, isStreaming, duration } = context;

  const durationText = isStreaming
    ? 'Thinking…'
    : duration !== undefined
      ? `Thought for ${duration}s`
      : 'Thinking';

  return (
    <button
      onClick={() => setIsExpanded(!isExpanded)}
      className={cn(
        'inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-2 px-0',
        'select-none focus:outline-none',
        className
      )}
      type="button"
      aria-expanded={isExpanded}
    >
      <IconChevronRight
        className={cn('w-4 h-4 transition-transform duration-200', isExpanded && 'rotate-90')}
      />
      <span>{durationText}</span>
    </button>
  );
};

export const ReasoningContent: React.FC<ReasoningContentProps> = ({ children, className }) => {
  const context = React.useContext(ReasoningContext);
  if (!context) return null;

  const { isExpanded, isStreaming } = context;

  if (!isExpanded) return null;

  // Split content by lines and filter empty lines
  const lines = children.split('\n').filter((line) => line.trim());

  return (
    <div className={cn('relative pl-0 mb-3 space-y-0', className)}>
      {/* Vertical divider line */}
      <div className="absolute left-2 top-0 bottom-0 w-px bg-gradient-to-b from-muted-foreground/50 via-muted-foreground/30 to-transparent" />

      {/* Thinking content with dots */}
      <div className="pl-6 space-y-0">
        {lines.map((line, idx) => (
          <div
            key={idx}
            className={cn(
              'text-xs text-muted-foreground py-0.5 leading-relaxed',
              'opacity-70',
              'whitespace-pre-wrap break-words'
            )}
          >
            <span className="inline-block mr-2 text-muted-foreground/60">·</span>
            <span className="inline">{line}</span>
          </div>
        ))}

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="inline-block w-1 h-3 bg-muted-foreground/40 animate-pulse mt-1" />
        )}
      </div>

      {/* Visual separator */}
      <div className="h-2" />
    </div>
  );
};

Reasoning.displayName = 'Reasoning';
ReasoningTrigger.displayName = 'ReasoningTrigger';
ReasoningContent.displayName = 'ReasoningContent';
