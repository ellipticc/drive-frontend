"use client"

import * as React from "react"
import { apiClient } from "@/lib/api"
import { IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"
import { usePathname } from "next/navigation"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface FeedbackDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
    const [text, setText] = React.useState("")
    const [sending, setSending] = React.useState(false)
    const isSendingRef = React.useRef(false)
    const pathname = usePathname()

    // Reset text when dialog closes
    React.useEffect(() => {
        if (!open) {
            setText("")
            isSendingRef.current = false
        }
    }, [open])

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
            isSendingRef.current = false
        } finally {
            setSending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto">
                <DialogHeader>
                    <DialogTitle>Send Feedback</DialogTitle>
                    <DialogDescription>
                        Share your ideas, report bugs, or let us know how we're doing.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <Textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Ideas, bugs, or anything else..."
                        className="min-h-[120px] resize-none"
                        maxLength={1000}
                        autoFocus
                    />

                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                            {text.length}/1000
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={sending}
                                size="sm"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSend}
                                disabled={!text.trim() || sending}
                                size="sm"
                            >
                                {sending ? (
                                    <IconLoader2 className="h-3 w-3 animate-spin mr-2" />
                                ) : null}
                                Send
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
