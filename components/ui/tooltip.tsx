"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root> & { children?: React.ReactNode }) {
  // Internal open state to support touch interactions (tap to show)
  const [open, setOpen] = React.useState<boolean | undefined>(undefined);
  const touchTimeoutRef = React.useRef<number | null>(null);

  // Clear timeout on unmount
  React.useEffect(() => {
    return () => {
      if (touchTimeoutRef.current) {
        window.clearTimeout(touchTimeoutRef.current);
      }
    };
  }, []);

  const handleTriggerPointerDown = (e: React.PointerEvent) => {
    // Only handle touch pointers
    if ((e as any).pointerType === 'touch') {
      // Toggle open state on touch
      setOpen(true);
      if (touchTimeoutRef.current) window.clearTimeout(touchTimeoutRef.current);
      // Auto close after 2.5 seconds
      touchTimeoutRef.current = window.setTimeout(() => setOpen(false), 2500);
    }
  };

  // Clone children to attach pointer handler to TooltipTrigger child
  const childrenWithHandler = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    // If child is the TooltipTrigger exported from this module, attach handler
    if ((child.type as any)?.name === TooltipTrigger.name) {
      const existing = child.props as any;
      return React.cloneElement(child, {
        ...existing,
        onPointerDown: (e: React.PointerEvent) => {
          try {
            if (typeof existing.onPointerDown === 'function') existing.onPointerDown(e);
          } catch (err) {
            // ignore
          }
          handleTriggerPointerDown(e);
        },
      });
    }

    return child;
  });

  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" open={open} onOpenChange={(v) => setOpen(v)} {...props}>
        {childrenWithHandler}
      </TooltipPrimitive.Root>
    </TooltipProvider>
  );
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-foreground text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="bg-foreground fill-foreground z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
