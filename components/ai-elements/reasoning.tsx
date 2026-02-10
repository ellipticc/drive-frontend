'use client';

import React, { useState, useEffect, useRef } from 'react';
import { IconBrain, IconChevronRight } from '@tabler/icons-react';
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
      <div className={cn('my-4 rounded-lg overflow-hidden border border-border/30 bg-muted/40', className)}>
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
        'w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/60 transition-colors group',
        className
      )}
      type="button"
      aria-expanded={isExpanded}
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
        {durationText}
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
  );
};

export const ReasoningContent: React.FC<ReasoningContentProps> = ({ children, className }) => {
  const context = React.useContext(ReasoningContext);
  if (!context) return null;

  const { isExpanded } = context;

  if (!isExpanded) return null;

  return (
    <div className={cn('px-4 pb-3 pt-2 border-t border-border/20', className)}>
      <div className="text-sm text-foreground/70 leading-relaxed whitespace-pre-wrap">
        {children}
      </div>
    </div>
  );
};

Reasoning.displayName = 'Reasoning';
ReasoningTrigger.displayName = 'ReasoningTrigger';
ReasoningContent.displayName = 'ReasoningContent';
