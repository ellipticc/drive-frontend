"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { IconCornerDownLeft } from "@tabler/icons-react";

export type SuggestionsProps = ComponentProps<"div"> & {
  label?: string;
};

export const Suggestions = ({
  className,
  children,
  label = "Follow-ups",
  ...props
}: SuggestionsProps) => (
  <div className={cn("w-full mt-6", className)} {...props}>
    {label && (
      <span className="text-sm font-semibold text-foreground mb-2 block">
        {label}
      </span>
    )}
    <div className="w-full border-t border-border/60">
      {children}
    </div>
  </div>
);

export type SuggestionProps = Omit<ComponentProps<"div">, "onClick"> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
};

export const Suggestion = ({
  suggestion,
  onClick,
  className,
  children,
  ...props
}: SuggestionProps) => (
  <div
    className={cn(
      "group flex w-full items-center gap-3 px-1 py-3 cursor-pointer border-b border-border/60",
      "text-muted-foreground transition-colors duration-150",
      "hover:text-foreground",
      className
    )}
    onClick={() => onClick?.(suggestion)}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick?.(suggestion);
      }
    }}
    {...props}
  >
    <span className="shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors duration-150">
      <IconCornerDownLeft className="size-4" />
    </span>
    <span className="text-sm leading-snug break-words">{children || suggestion}</span>
  </div>
);
