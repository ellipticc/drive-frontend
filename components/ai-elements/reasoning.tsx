"use client";

import type { ComponentProps, ReactNode } from "react";

import { useControllableState } from "@radix-ui/react-use-controllable-state";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { IconBrain, IconChevronDown, IconChevronRight, IconBulb } from "@tabler/icons-react";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Streamdown } from "streamdown";

import { Shimmer } from "./shimmer";

interface ReasoningContextValue {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number | undefined;
  tokenCount?: number;
  thinkingType?: 'thinking' | 'think';
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

export const useReasoning = () => {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning");
  }
  return context;
};

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
  tokenCount?: number;
  thinkingType?: 'thinking' | 'think';
};

const AUTO_CLOSE_DELAY = 1000;
const MS_IN_S = 1000;

// Helper to parse thinking stats from content
export const parseThinkingStats = (content: string) => {
  const lines = content.split('\n');
  const tokenCount = content.split(/\s+/).length;
  
  return {
    tokenCount,
    lineCount: lines.length,
    wordCount: content.split(/\s+/).length,
  };
};

// Helper to detect thinking tag type
export const detectThinkingTagType = (content: string): 'thinking' | 'think' | null => {
  if (content.includes('<thinking>')) return 'thinking';
  if (content.includes('<think>')) return 'think';
  return null;
};

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen,
    onOpenChange,
    duration: durationProp,
    tokenCount: tokenCountProp,
    thinkingType: thinkingTypeProp,
    children,
    ...props
  }: ReasoningProps) => {
    const resolvedDefaultOpen = defaultOpen ?? isStreaming;
    // Track if defaultOpen was explicitly set to false (to prevent auto-open)
    const isExplicitlyClosed = defaultOpen === false;

    const [isOpen, setIsOpen] = useControllableState<boolean>({
      defaultProp: resolvedDefaultOpen,
      onChange: onOpenChange,
      prop: open,
    });
    const [duration, setDuration] = useControllableState<number | undefined>({
      defaultProp: undefined,
      prop: durationProp,
    });
    const [tokenCount, setTokenCount] = useControllableState<number | undefined>({
      defaultProp: undefined,
      prop: tokenCountProp,
    });

    const hasEverStreamedRef = useRef(isStreaming);
    const [hasAutoClosed, setHasAutoClosed] = useState(false);
    const startTimeRef = useRef<number | null>(null);

    // Track when streaming starts and compute duration
    useEffect(() => {
      if (isStreaming) {
        hasEverStreamedRef.current = true;
        if (startTimeRef.current === null) {
          startTimeRef.current = Date.now();
        }
      } else if (startTimeRef.current !== null) {
        setDuration(Math.ceil((Date.now() - startTimeRef.current) / MS_IN_S));
        startTimeRef.current = null;
      }
    }, [isStreaming, setDuration]);

    // Auto-open when streaming starts (unless explicitly closed)
    useEffect(() => {
      if (isStreaming && !isOpen && !isExplicitlyClosed) {
        setIsOpen(true);
      }
    }, [isStreaming, isOpen, setIsOpen, isExplicitlyClosed]);

    // Auto-close when streaming ends (once only, and only if it ever streamed)
    useEffect(() => {
      if (
        hasEverStreamedRef.current &&
        !isStreaming &&
        isOpen &&
        !hasAutoClosed
      ) {
        const timer = setTimeout(() => {
          setIsOpen(false);
          setHasAutoClosed(true);
        }, AUTO_CLOSE_DELAY);

        return () => clearTimeout(timer);
      }
    }, [isStreaming, isOpen, setIsOpen, hasAutoClosed]);

    const handleOpenChange = useCallback(
      (newOpen: boolean) => {
        setIsOpen(newOpen);
      },
      [setIsOpen]
    );

    const contextValue = useMemo(
      () => ({ duration, isOpen, isStreaming, setIsOpen, tokenCount, thinkingType: thinkingTypeProp }),
      [duration, isOpen, isStreaming, setIsOpen, tokenCount, thinkingTypeProp]
    );

    return (
      <ReasoningContext.Provider value={contextValue}>
        <Collapsible
          className={cn("not-prose mb-4", className)}
          onOpenChange={handleOpenChange}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ReasoningContext.Provider>
    );
  }
);

export type ReasoningTriggerProps = ComponentProps<
  typeof CollapsibleTrigger
> & {
  getThinkingMessage?: (isStreaming: boolean, duration?: number, tokenCount?: number, thinkingType?: 'thinking' | 'think') => ReactNode;
};

const defaultGetThinkingMessage = (isStreaming: boolean, duration?: number, tokenCount?: number, thinkingType?: 'thinking' | 'think') => {
  const stats = [];
  
  if (isStreaming || duration === 0) {
    return <Shimmer duration={1}>Thinking...</Shimmer>;
  }
  
  if (duration !== undefined && duration > 0) {
    stats.push(`${duration}s`);
  }

  const statsText = stats.length > 0 ? ` (${stats.join(', ')})` : '';
  const typeLabel = thinkingType === 'think' ? 'Think' : 'Thinking';
  
  return <p>{typeLabel}{statsText}</p>;
};

export const ReasoningTrigger = memo(
  ({
    className,
    children,
    getThinkingMessage = defaultGetThinkingMessage,
    ...props
  }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration, tokenCount, thinkingType } = useReasoning();

    return (
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-2 text-foreground text-sm transition-colors hover:text-foreground/80",
          className
        )}
        {...props}
      >
        {children ?? (
          <div className="flex gap-2">
            <div className="relative mt-0.5">
              <IconBrain className="size-4" />
              <div className="absolute top-7 bottom-0 left-1/2 -mx-px w-px bg-border" />
            </div>
            <div className="flex-1">
              {getThinkingMessage(isStreaming, duration, tokenCount, thinkingType)}
            </div>
            <div className="ml-auto">
              {isOpen ? (
                <IconChevronDown className="size-4 transition-transform duration-200" />
              ) : (
                <IconChevronRight className="size-4 transition-transform duration-200" />
              )}
            </div>
          </div>
        )}
      </CollapsibleTrigger>
    );
  }
);

export type ReasoningContentProps = ComponentProps<
  typeof CollapsibleContent
> & {
  children: string;
};

const streamdownPlugins = { cjk, code, math, mermaid };

export const ReasoningContent = memo(
  ({ className, children, ...props }: ReasoningContentProps) => (
    <CollapsibleContent
      className={cn(
        "mt-4 text-sm",
        "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-muted-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
        className
      )}
      {...props}
    >
      <Streamdown plugins={streamdownPlugins as any} {...props}>
        {children}
      </Streamdown>
    </CollapsibleContent>
  )
);

Reasoning.displayName = "Reasoning";
ReasoningTrigger.displayName = "ReasoningTrigger";
ReasoningContent.displayName = "ReasoningContent";
