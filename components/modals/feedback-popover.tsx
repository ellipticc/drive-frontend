"use client"

import * as React from "react"
import { apiClient } from "@/lib/api"
import { IconBubbleText, IconLoader2, IconDatabaseSmile } from "@tabler/icons-react"
import { toast } from "sonner"
import { usePathname } from "next/navigation"

import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Kbd } from "@/components/ui/kbd"

interface FeedbackPopoverProps extends React.HTMLAttributes<HTMLElement> {
    children: React.ReactNode
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function FeedbackPopover({ children, open, onOpenChange, ...triggerProps }: FeedbackPopoverProps) {
    const [text, setText] = React.useState("")
    const [sending, setSending] = React.useState(false)
    const isSendingRef = React.useRef(false)
    const pathname = usePathname()

    // Reset text when popover closes
    React.useEffect(() => {
        if (!open) {
            setText("")
            isSendingRef.current = false
        }
    }, [open])

    // Global keyboard listener for "F" key and "Enter"
    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            // Open/Close on "f" if not typing
            if (e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                const active = document.activeElement
                const tagName = active?.tagName.toLowerCase()
                const isContentEditable = (active as HTMLElement)?.isContentEditable

                if (tagName === 'input' || tagName === 'textarea' || isContentEditable) {
                    return
                }

                e.preventDefault()
                onOpenChange(!open)
            }

            // Send on Enter (or Cmd+Enter) when open
            if (e.key === "Enter" && !e.shiftKey && open) {
                const active = document.activeElement
                if (active?.tagName.toLowerCase() === 'textarea') {
                    e.preventDefault()
                    handleSend()
                }
            }
        }

        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [open, text, onOpenChange, sending])

    const handleSend = async () => {
        if (!text.trim() || sending || isSendingRef.current) return
        if (text.length > 1000) {
            toast.error("Message too long (max 1000 characters)")
            return
        }

        setSending(true)
        isSendingRef.current = true
        try {
            const response = await apiClient.sendFeedback({
                message: text,
                path: pathname
            })

            if (!response.success) {
                throw new Error(response.error || 'Failed to send feedback')
            }

            setText("")
            onOpenChange(false)
            toast.success("Feedback sent! Thank you.")
        } catch (e) {
            console.error("Feedback error:", e)
            toast.error("Failed to send feedback. Please try again.")
            isSendingRef.current = false // Reset on error so user can retry
        } finally {
            setSending(false)
        }
    }

    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild {...(triggerProps as any)}>
                {children}
            </PopoverTrigger>
            <PopoverContent
                side="right"
                align="start"
                sideOffset={10}
                className="w-[320px] p-0 gap-0 overflow-hidden bg-muted border-border shadow-2xl animate-in fade-in-0 zoom-in-95 data-[state=open]:ring-2 data-[state=open]:ring-primary/20"
            >
                <div className="p-0">
                    <Textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Ideas, bugs, or anything else..."
                        className="h-[140px] w-full resize-none border-0 focus-visible:ring-0 rounded-none bg-transparent p-3 text-sm placeholder:text-muted-foreground text-foreground overflow-y-auto"
                        autoFocus
                        maxLength={1000}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleSend()
                            }
                        }}
                    />
                </div>

                <div className="flex items-center justify-between px-3 py-2 bg-transparent">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                        {text.length}/1000
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleSend}
                            disabled={!text.trim() || sending}
                            size="sm"
                            className="h-7 px-4 font-medium transition-all duration-200 hover:scale-105 active:scale-95 bg-primary text-primary-foreground text-xs rounded-full shadow-lg hover:shadow-primary/20"
                        >
                            {sending ? (
                                <IconLoader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                "Send"
                            )}
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
