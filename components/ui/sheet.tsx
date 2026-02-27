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
      margin-right: calc(var(--document-sheet-width, 0px) + 0.5rem);
      transition: margin-right 400ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    body:not(.document-sheet-open) [data-slot="sidebar-inset"] {
      margin-right: 0.5rem;
      transition: margin-right 400ms cubic-bezier(0.4, 0, 0.2, 1);
    }
  `
  document.head.appendChild(style)
}

function Sheet({
  modal = false,
  open,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Root> & { modal?: boolean }) {
  const handleOpenChange = (isOpen: boolean) => {
    if (onOpenChange) onOpenChange(isOpen);
    if (!modal) {
      if (isOpen) {
        document.body.classList.add('document-sheet-open');
      } else {
        document.body.classList.remove('document-sheet-open');
      }
    }
  };

  React.useEffect(() => {
    if (open) {
      document.body.classList.add('document-sheet-open');
    } else {
      document.body.classList.remove('document-sheet-open');
    }
  }, [open]);

  React.useEffect(() => {
    return () => {
      document.body.classList.remove('document-sheet-open');
    };
  }, []);

  return (
    <SheetPrimitive.Root
      data-slot="sheet"
      onOpenChange={handleOpenChange}
      modal={modal}
      open={open}
      {...props}
    />
  )
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

function SheetContent({
  className,
  children,
  side = "right",
  resizable = false,
  initialFraction = 0.25,
  minWidth = 320,
  maxWidth = null,
  hideOverlay = true, // Force hide overlay for integrated look
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  resizable?: boolean
  initialFraction?: number
  minWidth?: number
  maxWidth?: number | null
  hideOverlay?: boolean
}) {
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
      if (!document.body.classList.contains('document-sheet-open')) {
        document.body.style.setProperty('--document-sheet-width', '0px');
      }
    }
  }, [resizable, minWidth, initialFraction])

  const contentStyle: React.CSSProperties = widthPx ? {
    width: `${widthPx}px`,
    maxWidth: undefined,
    minWidth: `${minWidth}px`
  } : {}

  return (
    <SheetPrimitive.Content
      data-slot="sheet-content"
      className={cn(
        "bg-background fixed z-40 flex flex-col shadow-lg border-l transition-transform duration-400 ease-in-out",
        "data-[state=closed]:translate-x-full data-[state=open]:translate-x-0",
        side === "right" && "inset-y-0 right-0 h-screen",
        "overflow-x-hidden",
        className
      )}
      style={contentStyle}
      onInteractOutside={(e) => {
        // Integrated sidebar shouldn't close on click outside by default
        e.preventDefault();
      }}
      {...props}
    >
      {resizable && (
        <div
          role="separator"
          className="absolute left-0 top-0 h-full w-1 cursor-ew-resize z-50 hover:bg-primary/20 transition-colors"
          onPointerDown={(e) => {
            e.preventDefault();
            const onMove = (ev: PointerEvent) => {
              const newWidth = Math.max(minWidth, Math.min((maxWidth || window.innerWidth - 120), Math.floor(window.innerWidth - ev.clientX)));
              setWidthPx(newWidth);
              window.dispatchEvent(new CustomEvent('sheet:resize', { detail: { width: newWidth } }));
              document.body.style.setProperty('--document-sheet-width', `${newWidth}px`);
            };
            const onUp = () => {
              window.removeEventListener('pointermove', onMove);
              window.removeEventListener('pointerup', onUp);
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
          }}
        />
      )}

      <div className="flex-1 overflow-y-auto w-full h-full flex flex-col min-h-0">
        {children}
      </div>
      <SheetPrimitive.Close className="absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 disabled:pointer-events-none">
        <IconX className="size-5" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
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
