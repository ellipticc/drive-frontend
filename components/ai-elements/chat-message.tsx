"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { IconCopy, IconEdit, IconRefresh, IconThumbDown, IconThumbUp, IconCheck, IconX, IconCode, IconChevronDown, IconChevronRight, IconDownload, IconChevronLeft, IconListDetails, IconArrowsMinimize, IconBrain, IconClock, IconBookmark, IconArrowRight } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Reasoning, ReasoningTrigger, ReasoningContent, detectThinkingTagType } from "@/components/ai-elements/reasoning"
import { TextSelectionMenu } from "@/components/ai-elements/text-selection-menu"
import {
  InlineCitation,
  InlineCitationText,
  InlineCitationCard,
  InlineCitationCardTrigger,
  InlineCitationCardBody,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselItem,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselPrev,
  InlineCitationCarouselNext,
  InlineCitationSource,
} from "@/components/ai-elements/inline-citation"
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
    reasoningDuration?: number; // Duration of thinking in seconds
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
    onCheckpoint?: (messageId: string) => void;
    availableModels?: { id: string; name: string }[];
    onRerunSystemWithModel?: (messageId: string, modelId: string) => void;
    onAddToChat?: (text: string) => void;
}

// Helper component to render content with inline citations using ai-elements
function InlineCitationRenderer({ content, sources = [] }: { content: string; sources: { title: string; url: string; content?: string }[] }) {
    if (!sources.length) {
        return <MarkdownRenderer content={content} compact={false} />;
    }

    // Split content by citation markers [N] or 【N】
    const citationRegex = /(?:\[(\d+)\]|【(\d+)】)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = citationRegex.exec(content)) !== null) {
        const citationNum = parseInt(match[1] || match[2], 10);
        const source = sources[citationNum - 1];

        // Add text before citation
        if (match.index > lastIndex) {
            parts.push(
                <MarkdownRenderer
                    key={`text-${lastIndex}`}
                    content={content.substring(lastIndex, match.index)}
                    compact={true}
                />
            );
        }

        // Add citation with hover card
        if (source) {
            parts.push(
                <InlineCitationCard key={`citation-${citationNum}`}>
                    <InlineCitation>
                        <InlineCitationText>
                            <MarkdownRenderer content={`[${citationNum}]`} compact={true} />
                        </InlineCitationText>
                        <InlineCitationCardTrigger sources={[source.url]} />
                    </InlineCitation>
                    <InlineCitationCardBody>
                        <InlineCitationCarousel>
                            <InlineCitationCarouselContent>
                                <InlineCitationCarouselItem>
                                    <InlineCitationSource
                                        title={source.title}
                                        url={source.url}
                                        description={source.content}
                                    />
                                </InlineCitationCarouselItem>
                            </InlineCitationCarouselContent>
                            <InlineCitationCarouselHeader>
                                <div />
                                <InlineCitationCarouselIndex />
                                <div className="flex gap-1">
                                    <InlineCitationCarouselPrev />
                                    <InlineCitationCarouselNext />
                                </div>
                            </InlineCitationCarouselHeader>
                        </InlineCitationCarousel>
                    </InlineCitationCardBody>
                </InlineCitationCard>
            );
        }

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
        parts.push(
            <MarkdownRenderer
                key={`text-${lastIndex}`}
                content={content.substring(lastIndex)}
                compact={false}
            />
        );
    }

    return <div className="space-y-2">{parts}</div>;
}


export function ChatMessage({ message, isLast, onCopy, onRetry, onEdit, onFeedback, onRegenerate, onVersionChange, onCheckpoint, availableModels = [], onRerunSystemWithModel, onAddToChat }: ChatMessageProps) {
    // ... existing state ...
    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';
    const isSystem = message.role === 'system';
    const [copied, setCopied] = React.useState(false);
    const [feedbackGiven, setFeedbackGiven] = React.useState(!!message.feedback);
    const [isEditingPrompt, setIsEditingPrompt] = React.useState(false);
    const [editContent, setEditContent] = React.useState(message.content);
    const [isRegenPanelOpen, setIsRegenPanelOpen] = React.useState(false);
    const [systemModelPopoverOpen, setSystemModelPopoverOpen] = React.useState(false);

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
            "flex w-full gap-3 group",
            isUser ? "justify-end" : "justify-start"
        )}> 

            {/* Message Content */}
            <div className={cn(
                "flex flex-col flex-1",
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
                                <div className="relative flex items-start">
                                    {/* Message bubble (reduced padding slightly) */}
                                    <div className="bg-primary text-primary-foreground px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm font-medium w-full selection:bg-primary-foreground/20 selection:text-inherit">
                                        {message.content}
                                    </div>

                                    {/* Bookmark overlay commented out for now (disabled per request) */}
                                    {/*
                                    <div className="absolute left-0 right-0 -top-3 pointer-events-none">
                                        <div className="border-t border-dashed border-border/50 w-full" />
                                        <div className="flex justify-end pr-2 mt-0.5">
                                            <div className="pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            onClick={() => onCheckpoint?.(message.id || '')}
                                                            className={cn("p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors")}
                                                            aria-label="Create bookmark"
                                                        >
                                                            <IconBookmark className={cn("size-4", message.isCheckpoint ? 'text-primary' : '')} />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom">
                                                        <p>{message.isCheckpoint ? 'Bookmarked' : 'Create bookmark'}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    </div>
                                    */}
                                </div> 

                                <div className="flex items-center gap-1 mt-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
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
                                    {/* Continue button - shown when response was stopped by user */}
                                    {message.content && /Stopped by user/i.test(message.content) && (
                                        <ActionButton
                                            icon={IconArrowRight}
                                            label="Continue"
                                            onClick={() => onRegenerate?.('continue')}
                                        />
                                    )}
                                </div> 
                            </>
                        )}
                    </>
                ) : (
                    <div className="w-full space-y-2 selection:bg-primary/20 selection:text-foreground">{/* Reasoning / Chain of Thought */}
                        {message.reasoning && (
                            (() => {
                                const reasoningContent = message.reasoning;
                                const tagType = detectThinkingTagType(reasoningContent);
                                
                                return (
                                    <Reasoning
                                        key={`reasoning-${message.id}-${message.reasoningDuration ?? 'none'}`}
                                        isStreaming={isLast && message.isThinking}
                                        duration={message.reasoningDuration}
                                        thinkingType={tagType || undefined}
                                    >
                                        <ReasoningTrigger className="w-fit" />
                                        <ReasoningContent isStreaming={isLast && message.isThinking}>
                                            {reasoningContent}
                                        </ReasoningContent>
                                    </Reasoning>
                                );
                            })()
                        )}{/* Show thinking placeholder only during active streaming */}
                        {message.isThinking && isLast && !message.reasoning && (
                            <div className="text-sm text-muted-foreground italic">Thinking...</div>
                        )}
                        {/* If reasoning finished but we only have duration (no content), show duration */}
                        {!message.isThinking && message.reasoningDuration !== undefined && !message.reasoning && (
                            <div className="text-sm text-muted-foreground italic">Thought for {message.reasoningDuration}s</div>
                        )}

                        <div className="w-full">
                            {/* Use inline-citation component from ai-elements if sources exist */}
                            {message.sources && message.sources.length > 0 ? (
                                <InlineCitationRenderer content={message.content} sources={message.sources} />
                            ) : (
                                <MarkdownRenderer content={message.content} compact={false} />
                            )}
                        </div>

                        {/* Text Selection Menu for adding to chat */}
                        {onAddToChat && <TextSelectionMenu onAddToChat={onAddToChat} />}

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
                        {/* Only show assistant actions when this is an assistant message */}
                        {isAssistant && (
                        <div className="flex items-center justify-between mt-2 select-none">
                            {/* Left Actions */}
                            <div className="flex items-center gap-0.5">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn("h-6 w-6", feedbackGiven && message.feedback === 'like' ? "text-green-500" : "text-muted-foreground hover:text-green-500")}
                                            onClick={() => handleFeedback('like')}
                                            disabled={feedbackGiven}
                                        >
                                            <IconThumbUp className="size-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        <p>Like</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn("h-6 w-6", feedbackGiven && message.feedback === 'dislike' ? "text-red-500" : "text-muted-foreground hover:text-red-500")}
                                            onClick={() => handleFeedback('dislike')}
                                            disabled={feedbackGiven}
                                        >
                                            <IconThumbDown className="size-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        <p>Dislike</p>
                                    </TooltipContent>
                                </Tooltip> 
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
                        )}

                        {/* System message actions */}
                        {isSystem && availableModels.length > 0 && (
                            <div className="flex items-center justify-end mt-2 select-none">
                                {/* System rerun UI commented out for now */}
                                {/*
                                <Popover open={systemModelPopoverOpen} onOpenChange={setSystemModelPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6">
                                            <IconRefresh className="size-3.5" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent side="bottom" align="start" className="w-56">
                                        <div className="p-2 space-y-1">
                                            <p className="text-xs text-muted-foreground">Rerun this prompt with another model (this will remove the current system response)</p>
                                            <div className="pt-2">
                                                {availableModels.map(m => (
                                                    <button key={m.id} onClick={() => { onRerunSystemWithModel?.(message.id || '', m.id); setSystemModelPopoverOpen(false); }} className="w-full text-left px-2 py-1 rounded hover:bg-muted">{m.name}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                */}
                            </div>
                        )} 
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
            <Tooltip>
                <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-6 w-6 text-muted-foreground hover:text-foreground", isOpen && "text-foreground bg-muted")}
                        >
                            <IconRefresh className="size-3.5" />
                        </Button>
                    </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Regenerate</p></TooltipContent>
            </Tooltip>
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
                            onClick={() => { setSelectedOption('try-again'); onSubmit(); onOpenChange(false); }}
                            disabled={!!instruction}
                        />
                        <QuickOption
                            icon={IconListDetails}
                            label="Add Details"
                            ariaLabel="Regenerate with more details and explanation"
                            selected={selectedOption === 'details'}
                            onClick={() => { setSelectedOption('details'); onSubmit("Provide a more detailed and expanded version."); onOpenChange(false); }}
                            disabled={!!instruction}
                        />
                        <QuickOption
                            icon={IconArrowsMinimize}
                            label="More Concise"
                            ariaLabel="Regenerate a shorter, more concise response"
                            selected={selectedOption === 'concise'}
                            onClick={() => { setSelectedOption('concise'); onSubmit("Provide a shorter, more concise version."); onOpenChange(false); }}
                            disabled={!!instruction}
                        />
                        <QuickOption
                            icon={IconBrain}
                            label="Think Longer"
                            ariaLabel="Regenerate with deeper reasoning and analysis"
                            selected={selectedOption === 'think'}
                            onClick={() => { setSelectedOption('think'); onSubmit("Take more time to reason and provide a deeper answer."); onOpenChange(false); }}
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
