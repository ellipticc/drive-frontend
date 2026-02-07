"use client";

import { cn } from "@/lib/utils";
import { IconX, IconFile, IconPhoto } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import {
    Children,
    cloneElement,
    createContext,
    forwardRef,
    useContext,
    type ButtonHTMLAttributes,
    type HTMLAttributes,
    type ReactElement,
} from "react";

// ============================================================================
// Context & Types
// ============================================================================

interface AttachmentContextValue {
    data: any; // Type according to your file structure
    onRemove?: () => void;
}

const AttachmentContext = createContext<AttachmentContextValue | null>(null);

const useAttachment = () => {
    const context = useContext(AttachmentContext);
    if (!context) {
        throw new Error("useAttachment must be used within an Attachment component");
    }
    return context;
};

// ============================================================================
// Components
// ============================================================================

export interface AttachmentsProps extends HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "inline";
}

export const Attachments = forwardRef<HTMLDivElement, AttachmentsProps>(
    ({ className, variant = "default", children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "flex gap-2 overflow-x-auto py-2",
                    variant === "inline" ? "flex-row" : "flex-wrap",
                    className
                )}
                {...props}
            >
                <AnimatePresence mode="popLayout">{children}</AnimatePresence>
            </div>
        );
    }
);
Attachments.displayName = "Attachments";

export interface AttachmentProps extends HTMLAttributes<HTMLDivElement> {
    data: any;
    onRemove?: () => void;
}

export const Attachment = forwardRef<HTMLDivElement, AttachmentProps>(
    ({ className, data, onRemove, children, ...props }, ref) => {
        return (
            <AttachmentContext.Provider value={{ data, onRemove }}>
                <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    ref={ref}
                    className={cn(
                        "relative flex items-center justify-center overflow-hidden rounded-lg border bg-background shadow-sm group",
                        "h-16 w-16 min-w-[4rem]", // Default size
                        className
                    )}
                >
                    {children}
                </motion.div>
            </AttachmentContext.Provider>
        );
    }
);
Attachment.displayName = "Attachment";

export const AttachmentPreview = forwardRef<
    HTMLDivElement,
    HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
    const { data } = useAttachment();
    const isImage = data.type?.startsWith("image/") || data.mediaType?.startsWith("image/");
    const url = data.url || (data.file ? URL.createObjectURL(data.file) : null);

    return (
        <div
            ref={ref}
            className={cn("size-full flex items-center justify-center p-1", className)}
            {...props}
        >
            {isImage && url ? (
                <img
                    src={url}
                    alt={data.name || "Attachment"}
                    className="size-full object-cover rounded-md"
                />
            ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <IconFile className="size-6" />
                    <span className="text-[9px] truncate max-w-full px-1">{data.filename || data.name}</span>
                </div>
            )}
        </div>
    );
});
AttachmentPreview.displayName = "AttachmentPreview";

export const AttachmentRemove = forwardRef<
    HTMLButtonElement,
    ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
    const { onRemove } = useAttachment();

    if (!onRemove) return null;

    return (
        <button
            ref={ref}
            type="button"
            onClick={onRemove}
            className={cn(
                "absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-sm transition-opacity",
                "group-hover:opacity-100 focus:opacity-100",
                className
            )}
            {...props}
        >
            <IconX className="size-3" />
        </button>
    );
});
AttachmentRemove.displayName = "AttachmentRemove";
