"use client";

import type { LanguageModelUsage } from "ai";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { createContext, useContext, useMemo } from "react";
import { getUsage } from "tokenlens";

const PERCENT_MAX = 100;
const ICON_RADIUS = 10;
const ICON_VIEWBOX = 24;
const ICON_CENTER = 12;
const ICON_STROKE_WIDTH = 2;

type ModelId = string;

interface ContextSchema {
  usedTokens: number;
  maxTokens: number;
  usage?: LanguageModelUsage;
  modelId?: ModelId;
  systemTokens?: number;
  toolDefinitionTokens?: number;
  messageTokens?: number;
  userMessageTokens?: number;
  assistantMessageTokens?: number;
  toolResultTokens?: number;
}

const ContextContext = createContext<ContextSchema | null>(null);

const useContextValue = () => {
  const context = useContext(ContextContext);

  if (!context) {
    throw new Error("Context components must be used within Context");
  }

  return context;
};

export type ContextProps = ComponentProps<typeof HoverCard> & ContextSchema;

export const Context = ({
  usedTokens,
  maxTokens,
  usage,
  modelId,
  systemTokens,
  toolDefinitionTokens,
  messageTokens,
  userMessageTokens,
  assistantMessageTokens,
  toolResultTokens,
  ...props
}: ContextProps) => {
  const contextValue = useMemo(
    () => ({
      maxTokens,
      modelId,
      usage,
      usedTokens,
      systemTokens,
      toolDefinitionTokens,
      messageTokens,
      userMessageTokens,
      assistantMessageTokens,
      toolResultTokens,
    }),
    [
      maxTokens,
      modelId,
      usage,
      usedTokens,
      systemTokens,
      toolDefinitionTokens,
      messageTokens,
      toolResultTokens,
    ]
  );

  return (
    <ContextContext.Provider value={contextValue}>
      <HoverCard closeDelay={400} openDelay={150} {...props} />
    </ContextContext.Provider>
  );
};

const ContextIcon = () => {
  const { usedTokens, maxTokens } = useContextValue();
  const circumference = 2 * Math.PI * ICON_RADIUS;
  const usedPercent = usedTokens / maxTokens;
  const dashOffset = circumference * (1 - usedPercent);

  return (
    <svg
      aria-label="Model context usage"
      height="20"
      role="img"
      style={{ color: "currentcolor" }}
      viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
      width="20"
    >
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        opacity="0.25"
        r={ICON_RADIUS}
        stroke="currentColor"
        strokeWidth={ICON_STROKE_WIDTH}
      />
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        opacity="0.7"
        r={ICON_RADIUS}
        stroke="currentColor"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeWidth={ICON_STROKE_WIDTH}
        style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
      />
    </svg>
  );
};

export type ContextTriggerProps = ComponentProps<typeof Button>;

export const ContextTrigger = ({ children, ...props }: ContextTriggerProps) => {
  const { usedTokens, maxTokens } = useContextValue();
  const usedPercent = usedTokens / maxTokens;
  const renderedPercent = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(usedPercent);

  return (
    <HoverCardTrigger asChild>
      {children ?? (
        <Button type="button" variant="ghost" {...props}>
          <span className="font-medium text-muted-foreground">
            {renderedPercent}
          </span>
          <ContextIcon />
        </Button>
      )}
    </HoverCardTrigger>
  );
};

export type ContextContentProps = ComponentProps<typeof HoverCardContent>;

export const ContextContent = ({
  className,
  ...props
}: ContextContentProps) => (
  <HoverCardContent
    className={cn("min-w-60 divide-y overflow-hidden p-0 select-text", className)}
    {...props}
  />
);

export type ContextContentHeaderProps = ComponentProps<"div">;

export const ContextContentHeader = ({
  children,
  className,
  ...props
}: ContextContentHeaderProps) => {
  const { usedTokens, maxTokens } = useContextValue();
  const usedPercent = usedTokens / maxTokens;
  const displayPct = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(usedPercent);
  const used = new Intl.NumberFormat("en-US", {
    notation: "compact",
  }).format(usedTokens);
  const total = new Intl.NumberFormat("en-US", {
    notation: "compact",
  }).format(maxTokens);

  return (
    <div className={cn("w-full space-y-2 p-3", className)} {...props}>
      {children ?? (
        <>
          <div className="flex items-center justify-between gap-3 text-xs">
            <p>{displayPct}</p>
            <p className="font-mono text-muted-foreground">
              {used} / {total}
            </p>
          </div>
          <div className="space-y-2">
            <Progress className="bg-muted" value={usedPercent * PERCENT_MAX} />
          </div>
        </>
      )}
    </div>
  );
};

export type ContextContentBodyProps = ComponentProps<"div">;

export const ContextContentBody = ({
  children,
  className,
  ...props
}: ContextContentBodyProps) => (
  <div className={cn("w-full p-3", className)} {...props}>
    {children}
  </div>
);

export type ContextContentFooterProps = ComponentProps<"div">;

export const ContextContentFooter = ({
  children,
  className,
  ...props
}: ContextContentFooterProps) => {
  const { modelId, usage } = useContextValue();
  const costUSD = modelId
    ? getUsage({
        modelId,
        usage: {
          input: usage?.inputTokens ?? 0,
          output: usage?.outputTokens ?? 0,
        },
      }).costUSD?.totalUSD
    : undefined;
  const totalCost = new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(costUSD ?? 0);

  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-3 bg-secondary p-3 text-xs",
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <span className="text-muted-foreground">Total cost</span>
          <span>{totalCost}</span>
        </>
      )}
    </div>
  );
};

export type ContextInputUsageProps = ComponentProps<"div">;

export const ContextInputUsage = ({
  className,
  children,
  ...props
}: ContextInputUsageProps) => {
  const { usage, modelId } = useContextValue();
  const inputTokens = usage?.inputTokens ?? 0;

  if (children) {
    return children;
  }

  if (!inputTokens) {
    return null;
  }

  const inputCost = modelId
    ? getUsage({
        modelId,
        usage: { input: inputTokens, output: 0 },
      }).costUSD?.totalUSD
    : undefined;
  const inputCostText = new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(inputCost ?? 0);

  return (
    <div
      className={cn("flex items-center justify-between text-xs", className)}
      {...props}
    >
      <span className="text-muted-foreground">Input</span>
      <TokensWithCost costText={inputCostText} tokens={inputTokens} />
    </div>
  );
};

export type ContextOutputUsageProps = ComponentProps<"div">;

export const ContextOutputUsage = ({
  className,
  children,
  ...props
}: ContextOutputUsageProps) => {
  const { usage, modelId } = useContextValue();
  const outputTokens = usage?.outputTokens ?? 0;

  if (children) {
    return children;
  }

  if (!outputTokens) {
    return null;
  }

  const outputCost = modelId
    ? getUsage({
        modelId,
        usage: { input: 0, output: outputTokens },
      }).costUSD?.totalUSD
    : undefined;
  const outputCostText = new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(outputCost ?? 0);

  return (
    <div
      className={cn("flex items-center justify-between text-xs", className)}
      {...props}
    >
      <span className="text-muted-foreground">Output</span>
      <TokensWithCost costText={outputCostText} tokens={outputTokens} />
    </div>
  );
};

export type ContextReasoningUsageProps = ComponentProps<"div">;

export const ContextReasoningUsage = ({
  className,
  children,
  ...props
}: ContextReasoningUsageProps) => {
  const { usage, modelId } = useContextValue();
  const reasoningTokens = usage?.reasoningTokens ?? 0;

  if (children) {
    return children;
  }

  if (!reasoningTokens) {
    return null;
  }

  const reasoningCost = modelId
    ? getUsage({
        modelId,
        usage: { reasoningTokens },
      }).costUSD?.totalUSD
    : undefined;
  const reasoningCostText = new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(reasoningCost ?? 0);

  return (
    <div
      className={cn("flex items-center justify-between text-xs", className)}
      {...props}
    >
      <span className="text-muted-foreground">Reasoning</span>
      <TokensWithCost costText={reasoningCostText} tokens={reasoningTokens} />
    </div>
  );
};

export type ContextCacheUsageProps = ComponentProps<"div">;

export const ContextCacheUsage = ({
  className,
  children,
  ...props
}: ContextCacheUsageProps) => {
  const { usage, modelId } = useContextValue();
  const cacheTokens = usage?.cachedInputTokens ?? 0;

  if (children) {
    return children;
  }

  if (!cacheTokens) {
    return null;
  }

  const cacheCost = modelId
    ? getUsage({
        modelId,
        usage: { cacheReads: cacheTokens, input: 0, output: 0 },
      }).costUSD?.totalUSD
    : undefined;
  const cacheCostText = new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cacheCost ?? 0);

  return (
    <div
      className={cn("flex items-center justify-between text-xs", className)}
      {...props}
    >
      <span className="text-muted-foreground">Cache</span>
      <TokensWithCost costText={cacheCostText} tokens={cacheTokens} />
    </div>
  );
};

const TokensWithCost = ({
  tokens,
  costText,
}: {
  tokens?: number;
  costText?: string;
}) => (
  <span>
    {tokens === undefined
      ? "—"
      : new Intl.NumberFormat("en-US", {
          notation: "compact",
        }).format(tokens)}
    {costText ? (
      <span className="ml-2 text-muted-foreground">• {costText}</span>
    ) : null}
  </span>
);

/**
 * Context Window Breakdown Component
 * Shows token usage by category (System, Tools, Messages, Results)
 */
export type ContextWindowBreakdownProps = ComponentProps<"div">;

export const ContextWindowBreakdown = ({
  className,
  children,
  ...props
}: ContextWindowBreakdownProps) => {
  const {
    systemTokens = 0,
    toolDefinitionTokens = 0,
    messageTokens = 0,
    userMessageTokens = 0,
    assistantMessageTokens = 0,
    toolResultTokens = 0,
    maxTokens,
  } = useContextValue();

  const totalContextTokens =
    systemTokens +
    toolDefinitionTokens +
    messageTokens +
    toolResultTokens;

  if (children) {
    return children;
  }

  if (totalContextTokens === 0) {
    return null;
  }

  const calculatePercent = (tokens: number) => {
    if (totalContextTokens === 0) return 0;
    return (tokens / maxTokens) * 100;
  };

  return (
    <div
      className={cn(
        "w-full space-y-2 border-t border-border/50 p-3 text-xs",
        className
      )}
      {...props}
    >
      <p className="font-medium text-foreground">Context Breakdown</p>

      <div className="space-y-1.5">
        {/* System Instructions */}
        {systemTokens > 0 && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">• System Instructions</span>
            <span className="font-mono">
              {calculatePercent(systemTokens).toFixed(1)}%
            </span>
          </div>
        )}

        {/* Tool Definitions */}
        {toolDefinitionTokens > 0 && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">• Tool Definitions</span>
            <span className="font-mono">
              {calculatePercent(toolDefinitionTokens).toFixed(1)}%
            </span>
          </div>
        )}

        {/* Messages (total + breakdown) */}
        {messageTokens > 0 && (
          <div className="space-y-1 w-full">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">• Messages</span>
              <span className="font-mono">{calculatePercent(messageTokens).toFixed(1)}% · {new Intl.NumberFormat('en-US',{notation: 'compact'}).format(messageTokens)}</span>
            </div>

            <div className="ml-3 space-y-0.5">
              {/** User messages */}
              {userMessageTokens > 0 && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">— User messages</span>
                  <span className="font-mono">{calculatePercent(userMessageTokens).toFixed(1)}% · {new Intl.NumberFormat('en-US',{notation: 'compact'}).format(userMessageTokens)}</span>
                </div>
              )}

              {/** Assistant messages */}
              {assistantMessageTokens > 0 && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">— Assistant messages</span>
                  <span className="font-mono">{calculatePercent(assistantMessageTokens).toFixed(1)}% · {new Intl.NumberFormat('en-US',{notation: 'compact'}).format(assistantMessageTokens)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tool Results */}
        {toolResultTokens > 0 && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">• Tool Results</span>
            <span className="font-mono">
              {calculatePercent(toolResultTokens).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
