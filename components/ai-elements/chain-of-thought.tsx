"use client";

import type { ComponentProps, ReactNode } from "react";

import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from '@/lib/utils';
import { IconBulb, IconBulbFilled, IconChevronDown, IconChevronRight, IconDots, IconSearch, IconCode } from "@tabler/icons-react";
import { createContext, memo, useContext, useMemo } from "react";
import { CodeBlock } from "./markdown-components";

interface ChainOfThoughtContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue | null>(
  null
);

const useChainOfThought = () => {
  const context = useContext(ChainOfThoughtContext);
  if (!context) {
    throw new Error(
      "ChainOfThought components must be used within ChainOfThought"
    );
  }
  return context;
};

export type ChainOfThoughtProps = ComponentProps<"div"> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const ChainOfThought = memo(
  ({
    className,
    open,
    defaultOpen = false,
    onOpenChange,
    children,
    ...props
  }: ChainOfThoughtProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      defaultProp: defaultOpen,
      onChange: onOpenChange,
      prop: open,
    });

    const chainOfThoughtContext = useMemo(
      () => ({ isOpen, setIsOpen }),
      [isOpen, setIsOpen]
    );

    return (
      <ChainOfThoughtContext.Provider value={chainOfThoughtContext}>
        <div className={cn("not-prose w-full space-y-4", className)} {...props}>
          {children}
        </div>
      </ChainOfThoughtContext.Provider>
    );
  }
);

export type ChainOfThoughtHeaderProps = ComponentProps<
  typeof CollapsibleTrigger
> & {
  label?: ReactNode;
};

export const ChainOfThoughtHeader = memo(
  ({ className, children, label, ...props }: ChainOfThoughtHeaderProps) => {
    const { isOpen, setIsOpen } = useChainOfThought();

    return (
      <Collapsible onOpenChange={setIsOpen} open={isOpen}>
        <CollapsibleTrigger
          className={cn(
            "flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground group",
            className
          )}
          {...props}
        >
          {isOpen ? (
            <IconBulbFilled className="size-4 text-primary animate-pulse" />
          ) : (
            <IconBulb className="size-4" />
          )}
          <span className="font-medium">
            {children ?? label ?? "Thought process"}
          </span>
          {isOpen ? (
            <IconChevronDown className="size-3.5 opacity-70 group-hover:opacity-100 transition-transform" />
          ) : (
            <IconChevronRight className="size-3.5 opacity-70 group-hover:opacity-100 transition-transform" />
          )}
        </CollapsibleTrigger>
      </Collapsible>
    );
  }
);

export type ChainOfThoughtStepProps = ComponentProps<"div"> & {
  icon?: React.ComponentType<any>;
  label: ReactNode;
  description?: ReactNode;
  content?: string;
  code?: string;
  stdout?: string;
  status?: "complete" | "active" | "pending";
  stepType?: "thinking" | "search" | "code" | "think" | "searching" | "default";
};

const stepStatusStyles = {
  active: "text-foreground",
  complete: "text-muted-foreground",
  pending: "text-muted-foreground/50",
};

const getStepIcon = (stepType?: ChainOfThoughtStepProps['stepType']) => {
  switch (stepType) {
    case 'search':
      return IconSearch;
    case 'code':
      return IconCode;
    case 'thinking':
    case 'think':
      return IconBulb;
    default:
      return IconDots;
  }
};

export const ChainOfThoughtStep = memo(
  ({
    className,
    icon: Icon,
    label,
    description,
    content,
    code,
    stdout,
    status = "complete",
    stepType,
    children,
    ...props
  }: ChainOfThoughtStepProps) => {
    const DefaultIcon = Icon || getStepIcon(stepType);

    return (
      <div
        className={cn(
          "flex gap-3 text-sm",
          stepStatusStyles[status],
          "fade-in-0 slide-in-from-top-1 animate-in duration-300",
          className
        )}
        {...props}
      >
        <div className="relative mt-0.5 flex flex-col items-center">
          <div className={cn(
            "p-1 rounded-full bg-muted/50 border border-border/50",
            status === 'active' && "bg-primary/10 border-primary/20 text-primary"
          )}>
            <DefaultIcon className="size-3.5" />
          </div>
          <div className="flex-1 w-px bg-border/30 mt-1" />
        </div>
        <div className="flex-1 min-w-0 pb-4">
          <div className="font-medium leading-tight">{label}</div>
          {description && (
            <div className="text-muted-foreground/80 text-xs mt-1 leading-relaxed">{description}</div>
          )}
          {(content || code || stdout || children) && (
            <div className="mt-3 space-y-3">
              {content && (
                <div className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {content}
                </div>
              )}
              {code && <CodeBlock code={code} language="python" />}
              {stdout && <CodeBlock code={stdout} language="plain" />}
              {children}
            </div>
          )}
        </div>
      </div>
    );
  }
);

export type ChainOfThoughtSearchResultsProps = ComponentProps<"div">;

export const ChainOfThoughtSearchResults = memo(
  ({ className, ...props }: ChainOfThoughtSearchResultsProps) => (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  )
);

export const ChainOfThoughtSearchingQueries = memo(
  ({ queries, className, ...props }: { queries: string[], className?: string }) => (
    <div className={cn("flex flex-wrap gap-2 mt-2", className)} {...props}>
      {queries.map((q, i) => (
        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/40 border border-border/50 text-[11px] text-muted-foreground/80">
          <IconSearch className="size-3 opacity-60" />
          {q}
        </div>
      ))}
    </div>
  )
);

export const ChainOfThoughtSourceTable = memo(
  ({ sources, className, ...props }: { sources: any[], className?: string }) => (
    <div className={cn("mt-3 rounded-xl border border-border/30 bg-muted/5 overflow-hidden max-h-[220px] overflow-y-auto custom-scrollbar shadow-inner", className)} {...props}>
      {sources.map((s, i) => {
        let domain = "";
        try {
          domain = new URL(s.url).hostname.replace('www.', '');
        } catch (e) {
          domain = "source";
        }
        return (
          <a
            key={i}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group/source block px-1"
          >
            <div className="flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 group-hover/source:bg-muted/40 cursor-pointer">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                  alt=""
                  className="size-3.5 shrink-0 rounded-sm bg-muted/50 transition-transform duration-200 group-hover/source:scale-110"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDE2IDE2Ij48cmVjdCB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIGZpbGw9IiM4ODgiIG9wYWNpdHk9IjAuMiIvPjwvc3ZnPg==';
                  }}
                />
                <span className="truncate font-medium text-[11.5px] text-muted-foreground/90 group-hover/source:text-foreground transition-colors">{s.title}</span>
              </div>
              <span className="text-[10px] text-muted-foreground/40 group-hover/source:text-muted-foreground/60 transition-colors ml-4 shrink-0 font-mono">
                {domain}
              </span>
            </div>
          </a>
        );
      })}
    </div>
  )
);

export type ChainOfThoughtSearchResultProps = ComponentProps<typeof Badge>;

export const ChainOfThoughtSearchResult = memo(
  ({ className, children, ...props }: ChainOfThoughtSearchResultProps) => (
    <Badge
      className={cn("gap-1 px-2 py-0.5 font-normal text-xs", className)}
      variant="secondary"
      {...props}
    >
      {children}
    </Badge>
  )
);

export type ChainOfThoughtContentProps = ComponentProps<
  typeof CollapsibleContent
>;

export const ChainOfThoughtContent = memo(
  ({ className, children, ...props }: ChainOfThoughtContentProps) => {
    const { isOpen } = useChainOfThought();

    return (
      <Collapsible open={isOpen}>
        <CollapsibleContent
          className={cn(
            "mt-2 space-y-3",
            "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
            className
          )}
          {...props}
        >
          {children}
        </CollapsibleContent>
      </Collapsible>
    );
  }
);

export type ChainOfThoughtImageProps = ComponentProps<"div"> & {
  caption?: string;
};

export const ChainOfThoughtImage = memo(
  ({ className, children, caption, ...props }: ChainOfThoughtImageProps) => (
    <div className={cn("mt-2 space-y-2", className)} {...props}>
      <div className="relative flex max-h-[22rem] items-center justify-center overflow-hidden rounded-lg bg-muted p-3">
        {children}
      </div>
      {caption && <p className="text-muted-foreground text-xs">{caption}</p>}
    </div>
  )
);

ChainOfThought.displayName = "ChainOfThought";
ChainOfThoughtHeader.displayName = "ChainOfThoughtHeader";
ChainOfThoughtStep.displayName = "ChainOfThoughtStep";
ChainOfThoughtSearchResults.displayName = "ChainOfThoughtSearchResults";
ChainOfThoughtSearchResult.displayName = "ChainOfThoughtSearchResult";
ChainOfThoughtContent.displayName = "ChainOfThoughtContent";
ChainOfThoughtImage.displayName = "ChainOfThoughtImage";
