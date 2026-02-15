"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { IconCornerDownRight } from "@tabler/icons-react";

export type SuggestionsProps = ComponentProps<"div"> & {
  label?: string;
  variant?: "list" | "row";
};

export const Suggestions = ({
  className,
  children,
  label = "Follow-ups",
  variant = "list",
  ...props
}: SuggestionsProps) => (
  <div className={cn("w-full mt-4", variant === "list" ? "" : "space-y-4", className)} {...props}>
    {label && (
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-sm font-semibold">{label}</span>
      </div>
    )}
    <div className={cn(
      "w-full",
      variant === "list" ? "flex flex-col divide-y border-t border-b" : "flex flex-wrap items-center gap-2"
    )}>
      {children}
    </div>
  </div>
);

export type SuggestionProps = Omit<ComponentProps<"button">, "onClick"> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
  variant?: "list" | "chip";
};

export const Suggestion = ({
  suggestion,
  onClick,
  className,
  children,
  variant = "list",
  ...props
}: SuggestionProps) => {
  if (variant === "chip") {
    return (
      <button
        className={cn(
          "cursor-pointer rounded-xl px-4 py-2 text-sm font-medium transition-colors border",
          "bg-background hover:bg-muted text-foreground border-border hover:border-primary/20",
          className
        )}
        onClick={() => onClick?.(suggestion)}
        type="button"
        {...props}
      >
        {children || suggestion}
      </button>
    );
  }

  return (
    <button
      className={cn(
        "group flex w-full items-start gap-3 px-2 py-3 text-left text-sm transition-colors",
        "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        className
      )}
      onClick={() => onClick?.(suggestion)}
      type="button"
      {...props}
    >
      <span className="mt-0.5 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors">
        <IconCornerDownRight className="size-4" />
      </span>
      <span className="break-words leading-snug">{children || suggestion}</span>
    </button>
  );
};
