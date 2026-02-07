"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { IconCopy, IconEdit, IconRefresh, IconThumbDown, IconThumbUp, IconCheck } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Streamdown } from "streamdown"
import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import { mermaid } from "@streamdown/mermaid"
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning"
import 'katex/dist/katex.css'

const streamdownPlugins = { cjk, code, math, mermaid }

interface Message {
    id?: string; // Add ID for feedback tracking
    role: 'user' | 'assistant';
    content: string;
    isThinking?: boolean;
    createdAt?: number; // timestamp
    feedback?: 'like' | 'dislike';
}

interface ChatMessageProps {
    message: Message;
    isLast: boolean;
    onCopy: (content: string) => void;
    onRetry?: () => void;
    onEdit?: (content: string) => void;
    onFeedback?: (messageId: string, feedback: 'like' | 'dislike') => void;
    onRegenerate?: () => void;
}

export function ChatMessage({ message, isLast, onCopy, onRetry, onEdit, onFeedback, onRegenerate }: ChatMessageProps) {
    const isUser = message.role === 'user';
    const [copied, setCopied] = React.useState(false);
    const [feedbackGiven, setFeedbackGiven] = React.useState(!!message.feedback);
    const [editOpen, setEditOpen] = React.useState(false);
    const [editContent, setEditContent] = React.useState(message.content);
    const contentRef = React.useRef<HTMLDivElement>(null);

    const handleCopy = () => {
        onCopy(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleFeedback = (feedback: 'like' | 'dislike') => {
        if (!feedbackGiven) {
            setFeedbackGiven(true);
            onFeedback?.(message.id || '', feedback);
        }
    };

    const handleEditSubmit = () => {
        onEdit?.(editContent);
        setEditOpen(false);
    };

    // Render math after content renders
    React.useEffect(() => {
        if (contentRef.current && !isUser) {
            try {
                // Dynamically import katex auto-render
                import('katex/dist/contrib/auto-render.mjs' as any).then(({ default: renderMathInElement }: any) => {
                    renderMathInElement(contentRef.current, {
                        delimiters: [
                            { left: '$$', right: '$$', display: true },
                            { left: '$', right: '$', display: false },
                        ],
                        throwOnError: false,
                    });
                }).catch((e: any) => console.warn('Math rendering error:', e));
            } catch (e) {
                console.warn('Math rendering error:', e);
            }
        }
    }, [message.content, isUser]);

    return (
        <div className={cn(
            "flex w-full gap-4 group",
            isUser ? "flex-row-reverse" : "flex-row"
        )}>
            <div className={cn(
                "flex flex-col max-w-[85%] sm:max-w-[75%]",
                isUser ? "items-end" : "items-start"
            )}>
                {isUser ? (
                    <>
                        <div className="bg-primary text-primary-foreground px-5 py-3.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm">
                            <Streamdown plugins={streamdownPlugins as any} className="break-words whitespace-pre-wrap">
                                {message.content}
                            </Streamdown>
                        </div>
                        {/* User Actions (Hover - Bottom Right) */}
                        <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                            <ActionButton 
                                icon={IconRefresh} 
                                label="Retry" 
                                onClick={onRetry} 
                            />
                            <ActionButton 
                                icon={IconEdit} 
                                label="Edit" 
                                onClick={() => setEditOpen(true)} 
                            />
                            <ActionButton 
                                icon={copied ? IconCheck : IconCopy} 
                                label="Copy" 
                                onClick={handleCopy} 
                            />
                        </div>

                        {/* Edit Dialog */}
                        <Dialog open={editOpen} onOpenChange={setEditOpen}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Edit Message</DialogTitle>
                                </DialogHeader>
                                <Textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="min-h-[120px]"
                                    placeholder="Edit your message..."
                                />
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setEditOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleEditSubmit}>
                                        Update
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </>
                ) : (
                    <div className="w-full space-y-2">
                        {/* Thinking State / Reasoning */}
                        {message.isThinking && (
                            <Reasoning isStreaming={true} defaultOpen={true} duration={undefined}>
                                <ReasoningTrigger className="w-fit" />
                                <ReasoningContent>
                                    Thinking process...
                                </ReasoningContent>
                            </Reasoning>
                        )}

                        {/* Main Content */}
                        <div 
                            ref={contentRef}
                            className="w-full prose dark:prose-invert prose-sm max-w-none break-words"
                        >
                            <Streamdown plugins={streamdownPlugins as any}>
                                {message.content}
                            </Streamdown>
                        </div>

                        {/* AI Actions (Bottom - Always Visible) */}
                        {!message.isThinking && (
                            <div className="flex items-center gap-2 pt-2">
                                <TooltipProvider>
                                    <ActionButton
                                        icon={IconThumbUp}
                                        label="Good response"
                                        onClick={() => handleFeedback('like')}
                                        active={message.feedback === 'like'}
                                        disabled={feedbackGiven}
                                    />
                                    <ActionButton
                                        icon={IconThumbDown}
                                        label="Bad response"
                                        onClick={() => handleFeedback('dislike')}
                                        active={message.feedback === 'dislike'}
                                        disabled={feedbackGiven}
                                    />
                                    <ActionButton
                                        icon={copied ? IconCheck : IconCopy}
                                        label="Copy"
                                        onClick={handleCopy}
                                    />
                                    <ActionButton
                                        icon={IconRefresh}
                                        label="Regenerate"
                                        onClick={onRegenerate}
                                    />
                                </TooltipProvider>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

function ActionButton({ icon: Icon, label, onClick, active, disabled }: { icon: any, label: string, onClick?: () => void, active?: boolean, disabled?: boolean }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-6 w-6", active && "text-primary bg-primary/10", disabled && "opacity-50 cursor-not-allowed")}
                    onClick={onClick}
                    disabled={disabled}
                >
                    <Icon className="size-3.5" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
                <p>{label}</p>
            </TooltipContent>
        </Tooltip>
    )
}
