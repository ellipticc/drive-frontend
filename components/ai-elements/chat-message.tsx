"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { IconCopy, IconEdit, IconRefresh, IconThumbDown, IconThumbUp, IconCheck, IconX, IconCode, IconChevronDown, IconChevronRight, IconDownload, IconChevronLeft, IconListDetails, IconArrowsMinimize, IconBrain, IconClock } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning"

import { CitationParser } from "@/components/ai-elements/citation-parser";
import { MarkdownRenderer } from "@/components/ai-elements/markdown-renderer"

export interface ToolCall {
    id: string;
    type: string;
    function: {
        name: string;
        arguments: string;
    };
    result?: string;
}

export interface MessageVersion {
    id: string;
    content: string;
    toolCalls?: ToolCall[];
    createdAt?: number;
    feedback?: 'like' | 'dislike';
}

export interface Message {
    id?: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    isThinking?: boolean;
    createdAt?: number | string;
    feedback?: 'like' | 'dislike';
    sources?: { title: string; url: string; content?: string }[];
    toolCalls?: ToolCall[];
    versions?: MessageVersion[];
    currentVersionIndex?: number;
    isCheckpoint?: boolean;
    checkpointId?: string;
    reasoning?: string; // Content inside <think> tags
}

interface ChatMessageProps {
    message: Message;
    isLast: boolean;
    onCopy: (content: string) => void;
    onRetry?: () => void;
    onEdit?: (content: string) => void;
    onFeedback?: (messageId: string, feedback: 'like' | 'dislike') => void;
    onRegenerate?: (instruction?: string) => void;
    onVersionChange?: (direction: 'prev' | 'next') => void;
}


export function ChatMessage({ message, isLast, onCopy, onRetry, onEdit, onFeedback, onRegenerate, onVersionChange }: ChatMessageProps) {
    // ... existing state ...
    const isUser = message.role === 'user';
    const [copied, setCopied] = React.useState(false);
    const [feedbackGiven, setFeedbackGiven] = React.useState(!!message.feedback);
    const [isEditingPrompt, setIsEditingPrompt] = React.useState(false);
    const [editContent, setEditContent] = React.useState(message.content);
    const [isRegenPanelOpen, setIsRegenPanelOpen] = React.useState(false);

    // ... existing handlers ...
    const handleCopy = () => {
        onCopy(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const blob = new Blob([message.content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `response-${message.id || Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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

    const handleRegenerateSubmit = (instruction?: string) => {
        setIsRegenPanelOpen(false);
        onRegenerate?.(instruction);
    };


    // MarkdownRenderer handles all Markdown parsing with Shiki highlighting
    // Uses Remark + Rehype AST pipeline for streaming-safe rendering

    // Version Navigation
    const versionCount = message.versions?.length || 1;
    const currentVersion = (message.currentVersionIndex || 0) + 1;

    return (
        <div className={cn(
            "flex w-full gap-4 max-w-4xl mx-auto group",
            isUser ? "justify-end" : "justify-start"
        )}> 
            {/* ... existing render logic ... */}
            <div className={cn(
                "flex flex-col max-w-[85%]",
                isUser ? "items-end" : "items-start"
            )}>
                {isUser ? (
                    // ... User Message Render ...
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
                        {/* Reasoning / Chain of Thought */}
                        {(message.reasoning || message.isThinking) && (
                            <Reasoning
                                isStreaming={isLast && message.isThinking}
                                defaultOpen={true}
                            >
                                <ReasoningTrigger className="w-fit" />
                                <ReasoningContent>
                                    {message.reasoning || "Thinking..."}
                                </ReasoningContent>
                            </Reasoning>
                        )}



                        <div className="w-full">
                            {/* Use CitationParser to handle [1] style links if sources exist */}
                            {message.sources && message.sources.length > 0 ? (
                                <CitationParser content={message.content} sources={message.sources} />
                            ) : (
                                <MarkdownRenderer content={message.content} compact={false} />
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

                        {/* Actions Footer - Always Visible for Assistant */}
                        <div className="flex items-center justify-between mt-2 select-none">
                            {/* Left Actions */}
                            <div className="flex items-center gap-0.5">
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
                                <ActionButton
                                    icon={copied ? IconCheck : IconCopy}
                                    label="Copy"
                                    onClick={handleCopy}
                                />

                                <RegeneratePanel
                                    isOpen={isRegenPanelOpen}
                                    onOpenChange={setIsRegenPanelOpen}
                                    onSubmit={handleRegenerateSubmit}
                                />

                                <ActionButton
                                    icon={IconDownload}
                                    label="Download"
                                    onClick={handleDownload}
                                />
                            </div>

                            {/* Right Actions - Version Navigation */}
                            {versionCount > 1 && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/30 rounded-md px-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5"
                                        onClick={() => onVersionChange?.('prev')}
                                        disabled={currentVersion <= 1}
                                    >
                                        <IconChevronLeft className="size-3" />
                                    </Button>
                                    <span className="px-1 min-w-[30px] text-center font-mono">
                                        {currentVersion} / {versionCount}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5"
                                        onClick={() => onVersionChange?.('next')}
                                        disabled={currentVersion >= versionCount}
                                    >
                                        <IconChevronRight className="size-3" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function RegeneratePanel({ isOpen, onOpenChange, onSubmit }: { isOpen: boolean, onOpenChange: (open: boolean) => void, onSubmit: (instruction?: string) => void }) {
    const [instruction, setInstruction] = React.useState("");
    const [selectedOption, setSelectedOption] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!isOpen) {
            setInstruction("");
            setSelectedOption(null);
        }
    }, [isOpen]);

    const handleSubmit = () => {
        if (instruction.trim()) {
            onSubmit(`User requested the following changes to the previous answer: ${instruction}`);
        } else if (selectedOption) {
            switch (selectedOption) {
                case 'try-again': onSubmit(); break; // Default regen
                case 'details': onSubmit("Provide a more detailed and expanded version."); break;
                case 'concise': onSubmit("Provide a shorter, more concise version."); break;
                case 'think': onSubmit("Take more time to reason and provide a deeper answer."); break;
                default: onSubmit();
            }
        } else {
            onSubmit(); // Default try again
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-6 w-6 text-muted-foreground hover:text-foreground", isOpen && "text-foreground bg-muted")}
                >
                    <IconRefresh className="size-3.5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start" side="bottom">
                <div className="p-3 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground">Describe desired changes...</p>
                    <Textarea
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        placeholder="What needs to be changed?"
                        className="min-h-[80px] text-sm resize-none"
                        maxLength={500}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
                    />

                    <div className="grid grid-cols-2 gap-2">
                        <QuickOption
                            icon={IconRefresh}
                            label="Try Again"
                            ariaLabel="Regenerate the response without changes"
                            selected={selectedOption === 'try-again'}
                            onClick={() => setSelectedOption('try-again')}
                            disabled={!!instruction}
                        />
                        <QuickOption
                            icon={IconListDetails}
                            label="Add Details"
                            ariaLabel="Regenerate with more details and explanation"
                            selected={selectedOption === 'details'}
                            onClick={() => setSelectedOption('details')}
                            disabled={!!instruction}
                        />
                        <QuickOption
                            icon={IconArrowsMinimize}
                            label="More Concise"
                            ariaLabel="Regenerate a shorter, more concise response"
                            selected={selectedOption === 'concise'}
                            onClick={() => setSelectedOption('concise')}
                            disabled={!!instruction}
                        />
                        <QuickOption
                            icon={IconBrain}
                            label="Think Longer"
                            ariaLabel="Regenerate with deeper reasoning and analysis"
                            selected={selectedOption === 'think'}
                            onClick={() => setSelectedOption('think')}
                            disabled={!!instruction}
                        />
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

function QuickOption({ icon: Icon, label, ariaLabel, selected, onClick, disabled }: { icon: any, label: string, ariaLabel: string, selected: boolean, onClick: () => void, disabled?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            aria-label={ariaLabel}
            className={cn(
                "flex items-center gap-2 p-2 rounded-md border text-xs font-medium transition-all",
                selected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted text-muted-foreground hover:text-foreground",
                disabled && "opacity-50 cursor-not-allowed"
            )}
        >
            <Icon className="size-3.5" />
            <span>{label}</span>
        </button>
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
                <TooltipContent side="bottom">
                    <p>{label}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
