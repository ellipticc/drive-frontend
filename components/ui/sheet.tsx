"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { IconX } from "@tabler/icons-react"
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'

import { cn } from "@/lib/utils"

// Inject CSS for symmetric animations
if (typeof window !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @keyframes sheet-slide-in-from-right {
      from { transform: translate3d(calc(100% + 1rem), 0, 0); }
      to { transform: translate3d(0, 0, 0); }
    }
    @keyframes sheet-slide-out-to-right {
      from { transform: translate3d(0, 0, 0); }
      to { transform: translate3d(calc(100% + 1rem), 0, 0); }
    }
    [data-slot="sheet-content"][data-state="open"] {
      animation: sheet-slide-in-from-right 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
    [data-slot="sheet-content"][data-state="closed"] {
      animation: sheet-slide-out-to-right 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
    body.document-sheet-open [data-slot="sidebar-inset"] {
      margin-right: calc(var(--document-sheet-width, 0px) + 1rem);
      transition: margin-right 400ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    body:not(.document-sheet-open) [data-slot="sidebar-inset"] {
      margin-right: 0px;
      transition: margin-right 400ms cubic-bezier(0.4, 0, 0.2, 1);
    }
  `
  document.head.appendChild(style)
}

function Sheet({ modal = true, ...props }: React.ComponentProps<typeof SheetPrimitive.Root> & { modal?: boolean }) {
  const handleOpenChange = (open: boolean) => {
    if (props.onOpenChange) props.onOpenChange(open);
    if (!modal) {
      if (open) {
        document.body.classList.add('document-sheet-open');
      } else {
        document.body.classList.remove('document-sheet-open');
      }
    }
  };

  React.useEffect(() => {
    return () => {
      document.body.classList.remove('document-sheet-open');
    };
  }, []);

  return <SheetPrimitive.Root data-slot="sheet" onOpenChange={handleOpenChange} modal={modal} {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  resizable = false,
  initialFraction = 0.25, // Significantly smaller to be less intrusive
  minWidth = 320, // Reduced minimum width back to normal sidebar constraint
  maxWidth = null,
  hideOverlay = false,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  resizable?: boolean
  initialFraction?: number
  minWidth?: number
  maxWidth?: number | null
  hideOverlay?: boolean
}) {
  const sensors = useSensors(useSensor(PointerSensor))
  const [widthPx, setWidthPx] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const w = Math.max(minWidth, Math.floor(window.innerWidth * initialFraction))
      setWidthPx(w)
      if (resizable) {
        window.dispatchEvent(new CustomEvent('sheet:resize', { detail: { width: w } }))
      }
      document.body.style.setProperty('--document-sheet-width', `${w}px`)
    }

    return () => {
      // Clean up variable when fully unmounted (animation finished)
      // Only set to 0px if document is no longer open
      if (!document.body.classList.contains('document-sheet-open')) {
        document.body.style.setProperty('--document-sheet-width', '0px');
      }
    }
  }, [resizable, minWidth, initialFraction])

  const handleDragMove = (event: any) => {
    if (!resizable) return
    const original = event?.event?.clientX ?? event?.clientX
    if (!original) return
    // compute width as distance from right edge
    const newWidth = Math.max(minWidth, Math.min((maxWidth || window.innerWidth - 120), Math.floor(window.innerWidth - original)))
    setWidthPx(newWidth)
    // notify listeners
    window.dispatchEvent(new CustomEvent('sheet:resize', { detail: { width: newWidth } }))

    // Update global CSS variable for layout pushing
    if (document.body.classList.contains('document-sheet-open')) {
      document.body.style.setProperty('--document-sheet-width', `${newWidth}px`);
    }
  }

  const onDragEnd = () => {
    // no-op for now (persistence can be added later)
  }

  const contentStyle: React.CSSProperties = widthPx ? { width: `${widthPx}px`, maxWidth: undefined, minWidth: `${minWidth}px`, fontSize: `${Math.max(12, Math.min(18, (widthPx / window.innerWidth) * 18))}px` } : {}

  return (
    <SheetPortal>
      {!hideOverlay && <SheetOverlay />}
      <DndContext sensors={sensors} onDragMove={handleDragMove} onDragEnd={onDragEnd}>
        <SheetPrimitive.Content
          data-slot="sheet-content"
          className={cn(
            "bg-background fixed z-50 flex flex-col shadow-lg",
            side === "right" && "inset-y-2 right-2 h-[calc(100svh-1rem)] rounded-2xl border border-sidebar-border shadow-sm",
            side === "left" && "inset-y-2 left-2 h-[calc(100svh-1rem)] rounded-2xl border border-sidebar-border shadow-sm",
            side === "top" && "inset-x-2 top-2 h-auto rounded-2xl border border-sidebar-border shadow-sm",
            side === "bottom" && "inset-x-2 bottom-2 h-auto rounded-2xl border border-sidebar-border shadow-sm",
            "overflow-x-auto",
            className
          )}
          style={contentStyle}
          {...props}
        >
          {resizable && (
            // Drag handle on left edge
            <div
              role="separator"
              aria-orientation="vertical"
              data-drag-handle
              title="Resize preview"
              className="absolute left-0 top-0 h-full w-6 -translate-x-3 cursor-ew-resize z-50 touch-none flex items-center justify-center"
              onPointerDown={(e) => {
                e.preventDefault();
                if (e.pointerType) (e.target as Element).setPointerCapture?.((e as any).pointerId);

                const onMove = (ev: PointerEvent) => {
                  const clientX = ev.clientX;
                  const newWidth = Math.max(minWidth, Math.min((maxWidth || window.innerWidth - 120), Math.floor(window.innerWidth - clientX)));
                  setWidthPx(newWidth);
                  window.dispatchEvent(new CustomEvent('sheet:resize', { detail: { width: newWidth } }));

                  if (document.body.classList.contains('document-sheet-open')) {
                    document.body.style.setProperty('--document-sheet-width', `${newWidth}px`);
                  }
                };

                const onUp = () => {
                  window.removeEventListener('pointermove', onMove);
                  window.removeEventListener('pointerup', onUp);
                  try { (e.target as Element).releasePointerCapture?.((e as any).pointerId); } catch (err) { }
                };

                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp);
              }}
            >
              <div className="h-8 w-[2px] rounded bg-border/60" />
            </div>
          )}

          <div className="flex-1 overflow-y-auto w-full h-full flex flex-col min-h-0">
            {children}
          </div>
          <SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-[1.05rem] right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
            <IconX className="size-5" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        </SheetPrimitive.Content>
      </DndContext>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
