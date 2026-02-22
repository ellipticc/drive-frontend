"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { IconCopy, IconEdit, IconRefresh, IconThumbDown, IconFileText, IconThumbUp, IconCheck, IconChevronRight, IconDownload, IconChevronLeft, IconListDetails, IconArrowsMinimize, IconBrain, IconArrowRight, IconHandStop } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Reasoning, ReasoningTrigger, ReasoningContent, detectThinkingTagType } from "@/components/ai-elements/reasoning"
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
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion"

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
    suggestions?: string[];
    ttft?: number;
    tps?: number;
    total_time?: number;
    model?: string;
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
    onSuggestionClick?: (text: string) => void;
}

interface ParsedUserMessage {
    text: string;
    files: { name: string, content: string }[];
    contexts: { type: string, content: string }[];
}

function parseUserContent(rawContent: string): ParsedUserMessage {
    let text = rawContent;
    const files: { name: string, content: string }[] = [];
    const contexts: { type: string, content: string }[] = [];

    // Parse files (non-greedy match)
    const fileRegex = /--- START FILE: ([\s\S]*?) ---\n([\s\S]*?)\n--- END FILE ---\n?/g;
    text = text.replace(fileRegex, (match, name, content) => {
        files.push({ name: name.trim(), content: content.trim() });
        return '';
    });

    // Parse contexts (non-greedy match)
    const contextRegex = /\[CONTEXT \(([\s\S]*?)\)\]\n([\s\S]*?)\n\[\/CONTEXT\]\n?/g;
    text = text.replace(contextRegex, (match, type, content) => {
        contexts.push({ type: type.trim(), content: content.trim() });
        return '';
    });

    return {
        text: text.trim(),
        files,
        contexts
    };
}

// Helper component to render content with inline citations using ai-elements
function InlineCitationRenderer({ content, sources = [], isStreaming = false }: { content: string; sources: { title: string; url: string; content?: string }[]; isStreaming?: boolean }) {
    if (!sources.length) {
        return <MarkdownRenderer content={content} compact={false} isStreaming={isStreaming} />;
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
                    isStreaming={isStreaming}
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
                isStreaming={isStreaming}
            />
        );
    }

    return <div className="space-y-2">{parts}</div>;
}


export function ChatMessage({ message, isLast, onCopy, onRetry, onEdit, onFeedback, onRegenerate, onVersionChange, onCheckpoint, availableModels = [], onRerunSystemWithModel, onAddToChat, onSuggestionClick }: ChatMessageProps) {
    // Helper to display pretty model names
    const formatModelName = (name?: string) => {
        if (!name) return '';
        return name.split('-').map(seg => {
            let seenLetter = false;
            return seg.split('').map(ch => {
                if (/[a-zA-Z]/.test(ch)) {
                    if (!seenLetter) {
                        seenLetter = true;
                        return ch.toUpperCase();
                    }
                    return ch.toLowerCase();
                }
                return ch;
            }).join('');
        }).join('-');
    };
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
        const ts = message.createdAt ? new Date(message.createdAt) : new Date();
        const exportedAt = new Date();
        const header = [
            `# Message export`,
            `This message was downloaded from Ellipticc (https://ellipticc.com). AI chats may display inaccurate or offensive information (see https://ellipticc.com/privacy-policy for more info).`,
            `Message ID: ${message.id || 'N/A'}`,
            `Exported: ${exportedAt.toLocaleString()}`,
            `Message timestamp: ${ts.toLocaleString()}`,
            '---',
            ''
        ].join('\n');

        const body = `${header}\n**${message.role.toUpperCase()}** — ${ts.toLocaleString()}\n\n${message.content}\n`;
        const blob = new Blob([body], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safeDate = ts.toISOString().replace(/[:.]/g, '-');
        a.href = url;
        a.download = `message-${message.id || Date.now()}-${safeDate}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleFeedback = (feedback: 'like' | 'dislike') => {
        setFeedbackGiven(true);
        onFeedback?.(message.id || '', feedback);
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
        <div
            id={message.id}
            className={cn(
                "flex w-full gap-3 group scroll-mt-24", // optimized scroll margin for sticky header
                isUser ? "justify-end" : "justify-start"
            )}>

            {/* Message Content */}
            <div className={cn(
                "flex flex-col min-w-0 transition-all duration-200",
                isUser
                    ? (isEditingPrompt ? "w-full max-w-full items-start" : "items-end max-w-[85%]")
                    : "items-start flex-1 max-w-full"
            )}>
                {isUser ? (
                    // ... User Message Render ...
                    <>
                        {/* Edit Mode Overlay */}
                        <div className="group relative flex flex-col items-end">
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
                                            Send
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Parse content for file and context pills */}
                                    {(() => {
                                        const parsed = parseUserContent(message.content);
                                        return (
                                            <div className="flex flex-col gap-2 w-full items-end">
                                                {/* Message bubble */}
                                                {parsed.text && (
                                                    <div className={cn(
                                                        "px-4 py-3 rounded-2xl text-[15px] leading-relaxed shadow-sm font-medium w-fit selection:bg-primary-foreground/20 selection:text-inherit break-words whitespace-pre-wrap",
                                                        "bg-primary text-primary-foreground"
                                                    )}>
                                                        {parsed.text}
                                                    </div>
                                                )}

                                                {/* File & Context Pills Area */}
                                                {(parsed.files.length > 0 || parsed.contexts.length > 0) && (
                                                    <div className="flex flex-wrap gap-2 justify-end mt-1.5">
                                                        {parsed.contexts.map((ctx, i) => (
                                                            <Sheet key={`ctx-${i}`} modal={false}>
                                                                <SheetTrigger asChild>
                                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/60 border border-border/50 rounded-lg text-xs font-medium cursor-pointer hover:bg-muted/90 transition-colors shadow-sm select-none data-[state=open]:bg-muted">
                                                                        <IconFileText className="w-3.5 h-3.5 text-primary/70" />
                                                                        <span className="truncate max-w-[150px] text-foreground/80">Context Reference</span>
                                                                    </div>
                                                                </SheetTrigger>
                                                                <SheetContent side="right" className="w-[400px] sm:w-[540px] px-0 pb-0 flex flex-col" hideOverlay>
                                                                    <SheetHeader className="px-6 pb-2 text-left space-y-1">
                                                                        <SheetTitle className="flex items-center gap-2">
                                                                            <IconFileText className="w-5 h-5 text-primary/80 shrink-0" />
                                                                            <span className="truncate" title="Context Snippet">Context Snippet</span>
                                                                        </SheetTitle>
                                                                        <SheetDescription className="pl-7">Manually added context via user interaction</SheetDescription>
                                                                    </SheetHeader>
                                                                    <ScrollArea className="flex-1 px-6 pb-6 mt-2">
                                                                        <div className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed bg-muted/30 p-4 rounded-xl border border-border/50">
                                                                            {ctx.content}
                                                                        </div>
                                                                    </ScrollArea>
                                                                </SheetContent>
                                                            </Sheet>
                                                        ))}
                                                        {parsed.files.map((file, i) => (
                                                            <Sheet key={`file-${i}`} modal={false}>
                                                                <SheetTrigger asChild>
                                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/60 border border-border/50 rounded-xl text-xs font-medium cursor-pointer hover:bg-muted/90 transition-colors shadow-sm select-none data-[state=open]:bg-muted">
                                                                        <IconFileText className="w-3.5 h-3.5 text-primary/70" />
                                                                        <span className="truncate max-w-[200px] text-foreground/80">{file.name}</span>
                                                                    </div>
                                                                </SheetTrigger>
                                                                <SheetContent side="right" className="w-[400px] sm:w-[540px] px-0 pb-0 flex flex-col" hideOverlay>
                                                                    <SheetHeader className="px-6 pb-2 text-left space-y-1">
                                                                        <SheetTitle className="flex items-center gap-2">
                                                                            <IconFileText className="w-5 h-5 text-primary/80 shrink-0" />
                                                                            <span className="truncate" title={file.name}>{file.name}</span>
                                                                        </SheetTitle>
                                                                        <SheetDescription className="pl-7">Extracted Document Text for LLM Context</SheetDescription>
                                                                    </SheetHeader>
                                                                    <ScrollArea className="flex-1 px-6 pb-6 mt-2">
                                                                        <div className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed bg-muted/30 p-4 rounded-xl border border-border/50">
                                                                            {file.content}
                                                                        </div>
                                                                    </ScrollArea>
                                                                </SheetContent>
                                                            </Sheet>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Actions Row - Below message */}
                                    <div className="flex items-center gap-3 mt-1 mr-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                        {/* Timestamp - Explicitly to the left of buttons */}
                                        {message.createdAt && (
                                            <span className="text-[10px] text-muted-foreground/60 select-none">
                                                {new Date(message.createdAt).toLocaleString(undefined, {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: 'numeric',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        )}

                                        <div className="flex items-center gap-1">
                                            <ActionButton
                                                icon={IconRefresh}
                                                label="Retry"
                                                onClick={onRetry}
                                            />
                                            <ActionButton
                                                icon={IconEdit}
                                                label="Edit"
                                                onClick={() => {
                                                    setEditContent(parseUserContent(message.content).text);
                                                    setIsEditingPrompt(true);
                                                }}
                                            />
                                            <ActionButton
                                                icon={copied ? IconCheck : IconCopy}
                                                label="Copy"
                                                onClick={handleCopy}
                                            />
                                            {message.content && /Stopped by user/i.test(message.content) && (
                                                <ActionButton
                                                    icon={IconArrowRight}
                                                    label="Continue"
                                                    onClick={() => onRegenerate?.('continue')}
                                                    delayDuration={700}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="w-full space-y-0.5 selection:bg-primary/20 selection:text-foreground">{/* Reasoning / Chain of Thought */}
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
                                        className="mb-1"
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
                            <div className="flex items-center text-sm text-muted-foreground italic animate-pulse">
                                <IconBrain className="size-3 mr-2" />
                                Thinking...
                            </div>
                        )}
                        {/* If reasoning finished but we only have duration (no content), show duration */}
                        {!message.isThinking && message.reasoningDuration !== undefined && message.reasoningDuration > 0 && !message.reasoning && (
                            <div className="flex items-center text-sm text-muted-foreground italic">
                                <IconBrain className="size-3 mr-2" />
                                Thought for {message.reasoningDuration}s
                            </div>
                        )}

                        <div className="w-full max-w-full break-words overflow-hidden">
                            {/* Use inline-citation component from ai-elements if sources exist */}
                            {message.sources && message.sources.length > 0 ? (
                                <InlineCitationRenderer content={message.content} sources={message.sources} isStreaming={isLast && !!message.isThinking} />
                            ) : (
                                <MarkdownRenderer content={message.content} compact={false} isStreaming={isLast && !!message.isThinking} />
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
                                                className={cn("h-6 w-6 rounded-md transition-colors", feedbackGiven && message.feedback === 'like' ? "text-green-500" : "text-muted-foreground hover:text-green-500 hover:bg-sidebar-accent/30 dark:hover:bg-sidebar-accent/40")}
                                                onClick={() => handleFeedback('like')}
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
                                                className={cn("h-6 w-6 rounded-md transition-colors", feedbackGiven && message.feedback === 'dislike' ? "text-red-500" : "text-muted-foreground hover:text-red-500 hover:bg-sidebar-accent/30 dark:hover:bg-sidebar-accent/40")}
                                                onClick={() => handleFeedback('dislike')}
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

                                    {/* Timing Metrics Indicator / Interrupted State */}
                                    {message.content && /Stopped by user/i.test(message.content) ? (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-1 px-1.5 py-0.5 rounded-md select-none cursor-default">
                                            <IconHandStop className="size-3.5" />
                                            <span>Interrupted</span>
                                        </div>
                                    ) : null}

                                    {/* display model badge on every assistant response */}
                                    {message.model && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="text-xs text-muted-foreground ml-1 px-1 py-0.5 rounded hover:bg-sidebar-accent/20 dark:hover:bg-sidebar-accent/30 transition-colors">
                                                    {formatModelName(message.model)}
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom">
                                                <p>Model used: {formatModelName(message.model)}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    )}

                                    {message.total_time !== undefined && Number(message.total_time) > 0 && (() => {
                                        const totalTime = Number(message.total_time);
                                        const ttft = Number(message.ttft);
                                        const tps = Number(message.tps);
                                        // Show TTFT as the visible label, fallback to total time
                                        const displayValue = ttft > 0 ? ttft : totalTime;
                                        const displayText = displayValue < 1000
                                            ? `${Math.round(displayValue)}ms`
                                            : `${(displayValue / 1000).toFixed(1)}s`;
                                        return (
                                            <HoverCard>
                                                <HoverCardTrigger className="flex items-center text-xs text-muted-foreground ml-1 px-1.5 py-0.5 rounded-md hover:bg-sidebar-accent/10 dark:hover:bg-sidebar-accent/20 transition-colors cursor-default select-none">
                                                    {displayText}
                                                </HoverCardTrigger>
                                                <HoverCardContent side="right" align="center" className="flex flex-col gap-1.5 p-3 text-sm min-w-[180px] w-auto">
                                                    <div className="font-medium text-xs text-muted-foreground pb-1 border-b">Timing Metrics</div>
                                                    {ttft > 0 && (
                                                        <div className="flex justify-between gap-4 text-xs">
                                                            <span className="text-muted-foreground">Time to First Token:</span>
                                                            <span className="font-mono">{ttft < 1000 ? `${Math.round(ttft)}ms` : `${(ttft / 1000).toFixed(2)}s`}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between gap-4 text-xs">
                                                        <span className="text-muted-foreground">Response Time:</span>
                                                        <span className="font-mono">{totalTime < 1000 ? `${Math.round(totalTime)}ms` : `${(totalTime / 1000).toFixed(2)}s`}</span>
                                                    </div>
                                                    {tps > 0 && (
                                                        <div className="flex justify-between gap-4 text-xs">
                                                            <span className="text-muted-foreground">Speed:</span>
                                                            <span className="font-mono">{tps.toFixed(1)} tok/s</span>
                                                        </div>
                                                    )}
                                                </HoverCardContent>
                                            </HoverCard>
                                        );
                                    })()}
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
                        {/* Follow-up Suggestions */}
                        {message.suggestions && message.suggestions.length > 0 && (
                            <Suggestions>
                                {message.suggestions.map((s, i) => (
                                    <Suggestion
                                        key={i}
                                        suggestion={s}
                                        onClick={onSuggestionClick}
                                    />
                                ))}
                            </Suggestions>
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
                            className={cn("h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/20 dark:hover:bg-sidebar-accent/30 rounded-md transition-colors", isOpen && "text-foreground bg-muted")}
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

function ActionButton({ icon: Icon, label, onClick, className, delayDuration }: { icon: any, label: string, onClick?: () => void, className?: string, delayDuration?: number }) {
    return (
        <TooltipProvider>
            <Tooltip delayDuration={delayDuration}>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className={cn("h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/20 dark:hover:bg-sidebar-accent/30 rounded-md transition-colors", className)} onClick={onClick}>
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
