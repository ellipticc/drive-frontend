"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { IconCopy, IconEdit, IconRefresh, IconThumbDown, IconThumbUp, IconCheck, IconX } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import ReactMarkdown from "react-markdown"
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning"

interface Message {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    isThinking?: boolean;
    createdAt?: number;
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
    const [isEditingPrompt, setIsEditingPrompt] = React.useState(false);
    const [editContent, setEditContent] = React.useState(message.content);

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

    const handleEditPromptSubmit = () => {
        if (editContent.trim() && editContent !== message.content) {
            onEdit?.(editContent);
            setIsEditingPrompt(false);
        }
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
                        {isEditingPrompt ? (
                            <div className="w-full space-y-2">
                                <div className="bg-muted rounded-2xl p-4">
                                    <Input
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        className="bg-background border"
                                        placeholder="Edit your message..."
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleEditPromptSubmit();
                                            }
                                            if (e.key === 'Escape') {
                                                setIsEditingPrompt(false);
                                            }
                                        }}
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-2 justify-end mt-2">
                                    <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => setIsEditingPrompt(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        size="sm"
                                        onClick={handleEditPromptSubmit}
                                    >
                                        Send Updated Prompt
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="bg-primary text-primary-foreground px-5 py-3.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm">
                                    {message.content}
                                </div>
                                <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                                    <ActionButton 
                                        icon={IconRefresh} 
                                        label="Retry" 
                                        onClick={onRetry} 
                                    />
                                    <ActionButton 
                                        icon={IconEdit} 
                                        label="Edit" 
                                        onClick={() => setIsEditingPrompt(true)} 
                                    />
                                    <ActionButton 
                                        icon={copied ? IconCheck : IconCopy} 
                                        label="Copy" 
                                        onClick={handleCopy} 
                                    />
                                </div>
                            </>
                        )}
                    </>
                ) : (
                    <div className="w-full space-y-2">
                        {message.isThinking && (
                            <Reasoning isStreaming={true} defaultOpen={true} duration={undefined}>
                                <ReasoningTrigger className="w-fit" />
                                <ReasoningContent>
                                    Thinking...
                                </ReasoningContent>
                            </Reasoning>
                        )}

                        <div className="prose dark:prose-invert prose-sm max-w-none text-foreground">
                            <ReactMarkdown
                                components={{
                                    h1: ({ children }) => <h1 className="text-lg font-bold mt-3 mb-2">{children}</h1>,
                                    h2: ({ children }) => <h2 className="text-base font-bold mt-2.5 mb-1.5">{children}</h2>,
                                    h3: ({ children }) => <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>,
                                    p: ({ children }) => <p className="mb-2">{children}</p>,
                                    ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                                    li: ({ children }) => <li className="ml-2">{children}</li>,
                                    code: ({ children, className }) => (
                                        <code className={cn("bg-muted px-1.5 py-0.5 rounded text-xs font-mono", className)}>
                                            {children}
                                        </code>
                                    ),
                                    pre: ({ children }) => (
                                        <pre className="bg-muted/50 p-3 rounded-lg overflow-x-auto mb-2">
                                            {children}
                                        </pre>
                                    ),
                                    blockquote: ({ children }) => (
                                        <blockquote className="border-l-4 border-primary/30 pl-3 py-1 mb-2 italic text-muted-foreground">
                                            {children}
                                        </blockquote>
                                    ),
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        </div>

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
