"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { IconCopy, IconEdit, IconRefresh, IconThumbDown, IconThumbUp, IconCheck, IconX, IconCode, IconChevronDown, IconChevronRight } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Streamdown } from "streamdown"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import { cjk } from "@streamdown/cjk"
import "katex/dist/katex.min.css"
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning"


import { CitationParser } from "@/components/ai-elements/citation-parser";
import { mermaid } from "@streamdown/mermaid"

export interface ToolCall {
    id: string;
    type: string;
    function: {
        name: string;
        arguments: string;
    };
    result?: string;
}

export interface Message {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    isThinking?: boolean;
    createdAt?: number;
    feedback?: 'like' | 'dislike';
    sources?: { title: string; url: string; content?: string }[];
    toolCalls?: ToolCall[];
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


    const streamdownPlugins = React.useMemo(() => ({ code, math, cjk, mermaid } as any), []);


    return (
        <div className={cn(
            "flex w-full gap-4 max-w-3xl mx-auto group",
            isUser ? "justify-end" : "justify-start"
        )}>
            <div className={cn(
                "flex flex-col max-w-[85%]",
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
                                <div className="bg-primary text-primary-foreground px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-sm font-medium">
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

                        {/* Tool Calls (Code Execution) */}
                        {message.toolCalls && message.toolCalls.length > 0 && (
                            <div className="space-y-2 mb-2">
                                {message.toolCalls.map((tool, idx) => (
                                    <ToolCallItem key={tool.id || idx} tool={tool} />
                                ))}
                            </div>
                        )}

                        <div className="prose prose-neutral dark:prose-invert max-w-none leading-relaxed">
                            {/* Use CitationParser to handle [1] style links if sources exist */}
                            {message.sources && message.sources.length > 0 ? (
                                <CitationParser content={message.content} sources={message.sources} />
                            ) : (
                                <Streamdown plugins={streamdownPlugins}>
                                    {message.content}
                                </Streamdown>
                            )}

                        </div>

                        {/* References Footer */}
                        {message.sources && message.sources.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                                <p className="text-xs font-semibold text-muted-foreground mb-1">Sources</p>
                                <div className="flex flex-wrap gap-2">
                                    {message.sources.map((source, idx) => (
                                        <a
                                            key={idx}
                                            href={source.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs bg-muted hover:bg-muted/80 px-2 py-1 rounded transition-colors flex items-center gap-1 text-foreground no-underline"
                                        >
                                            <span className="opacity-50 font-mono">[{idx + 1}]</span>
                                            <span className="truncate max-w-[150px]">{source.title}</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                            <div className="flex items-center gap-0.5 mr-auto">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn("h-6 w-6", feedbackGiven && message.feedback === 'like' && "text-green-500")}
                                    onClick={() => handleFeedback('like')}
                                    disabled={feedbackGiven}
                                >
                                    <IconThumbUp className="size-3.5" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn("h-6 w-6", feedbackGiven && message.feedback === 'dislike' && "text-red-500")}
                                    onClick={() => handleFeedback('dislike')}
                                    disabled={feedbackGiven}
                                >
                                    <IconThumbDown className="size-3.5" />
                                </Button>
                            </div>

                            <ActionButton
                                icon={IconRefresh}
                                label="Regenerate"
                                onClick={onRegenerate}
                            />
                            <ActionButton
                                icon={copied ? IconCheck : IconCopy}
                                label="Copy"
                                onClick={handleCopy}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function ToolCallItem({ tool }: { tool: ToolCall }) {
    const [isOpen, setIsOpen] = React.useState(false);

    // Parse arguments to get code safely
    let codeContent = "";
    try {
        const args = tool.function.arguments;
        if (args.trim().startsWith('{')) {
            const parsed = JSON.parse(args);
            codeContent = parsed.code || args;
        } else {
            codeContent = args;
        }
    } catch (e) {
        codeContent = tool.function.arguments;
    }

    return (
        <div className="border rounded-lg overflow-hidden bg-muted/30">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
                <IconCode className="size-3.5" />
                <span>{tool.function.name === 'execute_code' ? 'Writing code...' : 'Using tool'}</span>
                {isOpen ? <IconChevronDown className="size-3.5 ml-auto" /> : <IconChevronRight className="size-3.5 ml-auto" />}
            </button>
            {isOpen && (
                <div className="bg-black/5 p-3 overflow-x-auto">
                    <pre className="text-xs font-mono language-javascript">
                        {codeContent}
                    </pre>
                </div>
            )}
        </div>
    )
}

function ActionButton({ icon: Icon, label, onClick }: { icon: any, label: string, onClick?: () => void }) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={onClick}>
                        <Icon className="size-3.5" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{label}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
