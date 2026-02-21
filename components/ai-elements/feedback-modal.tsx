"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

// Issue types for negative feedback
const ISSUE_TYPES = [
    { value: "inaccurate", label: "Inaccurate Information" },
    { value: "incomplete", label: "Incomplete Response" },
    { value: "refusal", label: "Refused to Answer" },
    { value: "formatting", label: "Formatting Issues" },
    { value: "logic", label: "Flawed Logic/reasoning" },
    { value: "other", label: "Other" }
]

interface FeedbackModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    messageId: string
    initialRating: 'like' | 'dislike' | null
    promptContext?: string
    responseContext?: string
    onSubmit?: (messageId: string, rating: 'like' | 'dislike', reasons: string[], details: string, context: any) => Promise<void>
}

export function FeedbackModal({
    isOpen,
    onOpenChange,
    messageId,
    initialRating,
    promptContext,
    responseContext,
    onSubmit
}: FeedbackModalProps) {
    const [rating, setRating] = React.useState<'like' | 'dislike' | null>(initialRating)
    const [issueType, setIssueType] = React.useState<string>("")
    const [details, setDetails] = React.useState("")
    const [includeContext, setIncludeContext] = React.useState(true)
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    // Reset state when modal opens or initialRating changes
    React.useEffect(() => {
        if (isOpen) {
            setRating(initialRating)
            setIssueType("")
            setDetails("")
            setIncludeContext(true)
            setIsSubmitting(false)
        }
    }, [isOpen, initialRating, messageId])

    const handleSubmit = async () => {
        if (!messageId || !rating) return

        setIsSubmitting(true)
        try {
            // Context payload
            const contextData = includeContext ? {
                prompt: promptContext,
                response: responseContext
            } : null

            // Format reasons as array for backend compatibility
            const reasons = issueType ? [issueType] : []

            await onSubmit?.(messageId, rating, reasons, details, contextData)
            onOpenChange(false)
        } catch (error) {
            console.error("Failed to submit feedback", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const isLike = rating === 'like'

    // Positive feedback reasons
    const POSITIVE_REASONS = [
        { value: "accurate", label: "Accurate Information" },
        { value: "comprehensive", label: "Comprehensive Response" },
        { value: "creative", label: "Creative & Original" },
        { value: "formatting", label: "Good Formatting" },
        { value: "logic", label: "Sound Logic" },
        { value: "other", label: "Other" }
    ]

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] gap-6 max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Provide Feedback</DialogTitle>
                    <DialogDescription>
                        {isLike ? "What did you like about this response?" : "What was the issue with this response?"}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-2">
                    {/* Reason Dropdown (Full Width) */}
                    <div className="space-y-2">
                        <Label>{isLike ? "Reason (Optional)" : "Issue Type (Optional)"}</Label>
                        <Select value={issueType} onValueChange={setIssueType}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder={isLike ? "Select a reason..." : "Select an issue..."} />
                            </SelectTrigger>
                            <SelectContent>
                                {(isLike ? POSITIVE_REASONS : ISSUE_TYPES).map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Details Input */}
                    <div className="space-y-2">
                        <Label>Details (Optional)</Label>
                        <Textarea
                            placeholder={isLike ? "What was satisfying about this response?" : "What was unsatisfying about this response?"}
                            value={details}
                            onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
                            maxLength={1000}
                            className="resize-none h-32 overflow-y-auto break-all"
                            style={{ fieldSizing: "fixed", wordBreak: "break-all" } as any}
                        />
                        <div className="text-xs text-muted-foreground text-right mt-1">
                            {details.length} / 1000
                        </div>
                    </div>

                    {/* Context Toggle */}
                    <div className="flex items-start space-x-3 pt-2">
                        <Checkbox
                            id="include-context"
                            checked={includeContext}
                            onCheckedChange={(checked) => setIncludeContext(!!checked)}
                            className="rounded-sm" // Ensure square grounded
                        />
                        <div className="grid gap-1.5 leading-none">
                            <label
                                htmlFor="include-context"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Share conversation context
                            </label>
                            <p className="text-xs text-muted-foreground">
                                Allow us to view the prompt and response to better understand your feedback.
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !rating}>
                        {isSubmitting ? "Submitting..." : "Submit"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
