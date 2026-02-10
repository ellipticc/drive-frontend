'use client';

import React, { useState, useEffect, useRef } from 'react';
import { IconBrain } from '@tabler/icons-react';
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

  let durationText = 'Thinking';
  if (isStreaming) {
    durationText = 'Thinking…';
  } else if (duration !== undefined && duration > 0) {
    durationText = `Thought for ${duration}s`;
  }

  return (
    <button
      onClick={() => setIsExpanded(!isExpanded)}
      className={cn(
        'inline-flex items-center gap-2 text-sm font-medium transition-all duration-200 py-1 px-0',
        'select-none focus:outline-none',
        'text-primary hover:text-primary/80',
        className
      )}
      type="button"
      aria-expanded={isExpanded}
    >
      <div className={cn(
        'relative flex items-center justify-center',
        isExpanded && 'animate-pulse'
      )}>
        <div className="absolute inset-0 bg-primary/20 blur-md rounded-full" />
        <IconBrain
          className={cn('w-4 h-4 relative transition-transform duration-200 z-10')}
        />
      </div>
      <span className="bg-gradient-to-r from-primary via-primary to-primary/80 bg-clip-text text-transparent">
        {durationText}
      </span>
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
    <div className={cn('relative pl-0 mb-4 space-y-0', className)}>
      {/* Top dot indicator */}
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full" />
        <div className="flex-1 h-px bg-primary/40" />
      </div>

      {/* Thinking content - bigger, with glow */}
      <div className="pl-4 space-y-2">
        {lines.map((line, idx) => (
          <div
            key={idx}
            className={cn(
              'text-sm leading-relaxed',
              'text-primary/70 dark:text-primary/60',
              'whitespace-pre-wrap break-words',
              'font-medium'
            )}
          >
            {line}
          </div>
        ))}

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex items-center gap-2 mt-3">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Solid bottom divider */}
      <div className="mt-3 h-px bg-primary/30" />
    </div>
  );
};

Reasoning.displayName = 'Reasoning';
ReasoningTrigger.displayName = 'ReasoningTrigger';
ReasoningContent.displayName = 'ReasoningContent';
