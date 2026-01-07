"use client"

import * as React from "react"
import { apiClient } from "@/lib/api"
import { IconMessage2, IconLoader2, IconDatabaseSmile } from "@tabler/icons-react"
import { toast } from "sonner"
import { usePathname } from "next/navigation"

import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Kbd } from "@/components/ui/kbd"

interface FeedbackModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
    const [text, setText] = React.useState("")
    const [sending, setSending] = React.useState(false)
    const pathname = usePathname()

    // Global keyboard listener for "F" key and "Cmd+Enter"
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

            // Send on Cmd+Enter (or Ctrl+Enter) when open
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && open) {
                e.preventDefault()
                handleSend()
            }
        }

        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [open, text, onOpenChange]) // Dependencies for handleSend closure

    const handleSend = async () => {
        if (!text.trim()) return
        if (text.length > 1000) {
            toast.error("Message too long (max 1000 characters)")
            return
        }

        setSending(true)
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
            toast.success("Feedback sent! Thank you.", {
                icon: <IconDatabaseSmile stroke={1.5} className="h-4 w-4" />
            })
        } catch (e) {
            console.error("Feedback error:", e)
            toast.error("Failed to send feedback. Please try again.")
        } finally {
            setSending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden bg-zinc-950 border-zinc-800 shadow-2xl">
                {/* Header with Title and 'F' shortcut hint */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                    <DialogTitle className="text-sm font-medium flex items-center gap-2 text-zinc-100">
                        Feedback
                    </DialogTitle>
                    <Kbd className="bg-zinc-900 border-zinc-800 text-zinc-400">F</Kbd>
                </div>

                <DialogDescription className="sr-only">
                    Send feedback, bug reports, or ideas to the team.
                </DialogDescription>

                <div className="p-0">
                    <Textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Ideas, bugs, or anything else..."
                        className="min-h-[160px] w-full resize-none border-0 focus-visible:ring-0 rounded-none bg-zinc-950 p-4 text-base placeholder:text-zinc-500 text-zinc-100"
                        autoFocus
                        maxLength={1000}
                    />
                </div>

                {/* Footer with Send button and shortcuts */}
                <div className="flex items-center justify-between px-4 py-3 bg-zinc-950 border-t border-zinc-800">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <IconMessage2 className="h-4 w-4 text-zinc-600" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleSend}
                            disabled={!text.trim() || sending}
                            size="sm"
                            className="h-8 gap-2 font-medium bg-zinc-100 text-zinc-900 hover:bg-white"
                        >
                            {sending ? (
                                <IconLoader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                "Send"
                            )}
                            <div className="flex items-center gap-1 ml-1">
                                <Kbd className="bg-zinc-300 border-zinc-300 text-zinc-900 h-5 px-1.5 text-[10px] min-w-[auto]">⌘</Kbd>
                                <Kbd className="bg-zinc-300 border-zinc-300 text-zinc-900 h-5 px-1.5 text-[10px] min-w-[auto]">↵</Kbd>
                            </div>
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
