"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { IconCopy, IconEdit, IconRefresh, IconThumbDown, IconThumbUp, IconCheck } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Streamdown } from "streamdown"
import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import { mermaid } from "@streamdown/mermaid"
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning"

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

    const handleCopy = () => {
        onCopy(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
                            <ActionButton icon={IconRefresh} label="Retry" onClick={onRetry} />
                            <ActionButton icon={IconEdit} label="Edit" onClick={() => onEdit?.(message.content)} />
                            <ActionButton icon={copied ? IconCheck : IconCopy} label="Copy" onClick={handleCopy} />
                        </div>
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
                        <div className="prose dark:prose-invert prose-sm max-w-none prose-headings:font-semibold prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-code:bg-muted/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none prose-pre:bg-secondary/50 prose-pre:border">
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
                                        onClick={() => message.id && onFeedback?.(message.id, 'like')}
                                        active={message.feedback === 'like'}
                                    />
                                    <ActionButton
                                        icon={IconThumbDown}
                                        label="Bad response"
                                        onClick={() => message.id && onFeedback?.(message.id, 'dislike')}
                                        active={message.feedback === 'dislike'}
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

function ActionButton({ icon: Icon, label, onClick, active }: { icon: any, label: string, onClick?: () => void, active?: boolean }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-6 w-6", active && "text-primary bg-primary/10")}
                    onClick={onClick}
                >
                    <Icon className="size-3.5" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
                <p>{label}</p>
            </TooltipContent>
        </Tooltip>
    )
}
