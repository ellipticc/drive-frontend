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
import { IconThumbUp, IconThumbDown, IconCheck } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

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

    // Determine titles and placeholders based on rating
    const isLike = rating === 'like'
    const title = "Feedback"
    const description = "Help us improve the AI's responses."

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] gap-6">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-2">
                    {/* Rating Toggle */}
                    <div className="flex items-center justify-center gap-4">
                        <Button
                            variant={isLike ? "default" : "outline"}
                            size="lg"
                            className={cn(
                                "flex-1 h-12 gap-2 text-base",
                                isLike && "bg-green-600 hover:bg-green-700 text-white border-green-600"
                            )}
                            onClick={() => setRating('like')}
                        >
                            <IconThumbUp className="size-5" />
                            Helpful
                        </Button>
                        <Button
                            variant={!isLike ? "default" : "outline"}
                            size="lg"
                            className={cn(
                                "flex-1 h-12 gap-2 text-base",
                                !isLike && rating === 'dislike' && "bg-red-600 hover:bg-red-700 text-white border-red-600"
                            )}
                            onClick={() => setRating('dislike')}
                        >
                            <IconThumbDown className="size-5" />
                            Not Helpful
                        </Button>
                    </div>

                    {/* Issue Type Dropdown (Only for Dislike) */}
                    {!isLike && (
                        <div className="space-y-2">
                            <Label>What type of issue do you wish to report? (Optional)</Label>
                            <Select value={issueType} onValueChange={setIssueType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an issue..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {ISSUE_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Details Input */}
                    <div className="space-y-2">
                        <Label>Details (Optional)</Label>
                        <Textarea
                            placeholder={isLike ? "What was satisfying about this response?" : "What was (un)satisfying about this response?"}
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            maxLength={1000}
                            className="resize-none"
                            rows={3}
                        />
                    </div>

                    {/* Context Toggle */}
                    <div className="flex items-start space-x-3 pt-2">
                        <Checkbox
                            id="include-context"
                            checked={includeContext}
                            onCheckedChange={(checked) => setIncludeContext(!!checked)}
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

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !rating}>
                        {isSubmitting ? "Submitting..." : "Submit Feedback"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
