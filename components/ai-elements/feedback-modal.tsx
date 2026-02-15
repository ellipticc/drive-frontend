"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

interface FeedbackModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    messageId: string;
    initialRating: "like" | "dislike" | null;
    promptContext?: string;
    responseContext?: string;
}

const FEEDBACK_REASONS = [
    "Incorrect information",
    "Incomplete answer",
    "Poor formatting",
    "Not relevant",
    "Hallucination",
    "Other"
];

const POSITIVE_REASONS = [
    "Accurate",
    "Comprehensive",
    "Clean formatting",
    "Creative",
    "Fast",
    "Other"
];

const CATEGORIES = [
    "General",
    "Content Quality",
    "Formatting/Style",
    "Code Generation",
    "Performance"
];

export function FeedbackModal({
    isOpen,
    onOpenChange,
    messageId,
    initialRating,
    promptContext,
    responseContext
}: FeedbackModalProps) {
    const [reasons, setReasons] = useState<string[]>([]);
    const [category, setCategory] = useState<string>("General");
    const [details, setDetails] = useState("");
    const [includeContext, setIncludeContext] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setReasons([]);
            setCategory("General");
            setDetails("");
            setIncludeContext(true);
        }
    }, [isOpen]);

    const toggleReason = (reason: string) => {
        setReasons(prev =>
            prev.includes(reason)
                ? prev.filter(r => r !== reason)
                : [...prev, reason]
        );
    };

    const handleSubmit = async () => {
        if (!initialRating) return;

        setIsSubmitting(true);
        try {
            await apiClient.submitDetailedFeedback({
                messageId,
                rating: initialRating,
                reasons: [...reasons, `Category: ${category}`],
                details,
                promptContext: includeContext ? promptContext : undefined,
                responseContext: includeContext ? responseContext : undefined
            });
            toast.success("Thank you for your feedback!");
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to submit feedback:", error);
            toast.error("Failed to save detailed feedback.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const currentReasons = initialRating === 'like' ? POSITIVE_REASONS : FEEDBACK_REASONS;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {initialRating === 'like' ? "What did you like?" : "What went wrong?"}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Category Selector */}
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                                {CATEGORIES.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Reason Selector */}
                    <div className="space-y-2">
                        <Label>Reasons (Optional)</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {currentReasons.map(reason => (
                                <div
                                    key={reason}
                                    onClick={() => toggleReason(reason)}
                                    className={`
                                        cursor-pointer text-sm px-3 py-2 rounded-md border text-center transition-colors
                                        ${reasons.includes(reason)
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-background hover:bg-muted border-input"}
                                    `}
                                >
                                    {reason}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Details Input */}
                    <div className="space-y-2">
                        <Label>Details (Optional)</Label>
                        <Textarea
                            placeholder={initialRating === 'like' ? "What was satisfying about this response?" : "What was unsatisfying about this response?"}
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            maxLength={1000}
                            className="resize-none"
                            rows={3}
                        />
                        <div className="text-xs text-muted-foreground text-right">{details.length}/1000</div>
                    </div>

                    {/* Context Checkbox */}
                    <div className="flex items-start space-x-2">
                        <Checkbox
                            id="include-context"
                            checked={includeContext}
                            onCheckedChange={(c) => setIncludeContext(!!c)}
                        />
                        <div className="grid gap-1.5 leading-none">
                            <Label
                                htmlFor="include-context"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Include conversation context
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Helps us improve by analyzing {initialRating === 'like' ? 'good' : 'bad'} examples.
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? "Submitting..." : "Submit"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
