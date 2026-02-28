"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { IconCopy, IconEdit, IconRefresh, IconThumbDown, IconFileText, IconThumbUp, IconCheck, IconChevronRight, IconDownload, IconChevronLeft, IconListDetails, IconArrowRight, IconHandStop, IconBulb, IconWorld, IconWorldOff, IconBulbFilled, IconViewportShort, IconThumbUpFilled, IconThumbDownFilled, IconArrowUp } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Reasoning, ReasoningTrigger, ReasoningContent, detectThinkingTagType } from "@/components/ai-elements/reasoning"
import { MarkdownRenderer } from "@/components/ai-elements/markdown-renderer"
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion"
import {
    ChainOfThought,
    ChainOfThoughtHeader,
    ChainOfThoughtContent,
    ChainOfThoughtStep,
    ChainOfThoughtSearchResults,
    ChainOfThoughtSearchResult,
    ChainOfThoughtImage,
    ChainOfThoughtSearchingQueries,
    ChainOfThoughtSourceTable,
} from "@/components/ai-elements/chain-of-thought"

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
    total_time?: number | string;
    ttft?: number | string;
    tps?: number | string;
    model?: string;
    suggestions?: string[];
    sources?: { title: string; url: string; content?: string }[];
    reasoning?: string;
    reasoningDuration?: number;
    steps?: any[];
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
    ttft?: number | string;
    tps?: number | string;
    total_time?: number | string;
    model?: string;
    parent_id?: string | null;
    steps?: any[];
}

interface ChatMessageProps {
    message: Message;
    isLast: boolean;
    onCopy: (content: string) => void;
    onRetry?: () => void;
    onEdit?: (content: string) => void;
    onFeedback?: (messageId: string, feedback: 'like' | 'dislike') => void;
    onRegenerate?: (instruction?: string, overrides?: { thinkingMode?: boolean }) => void;
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

export function ChatMessage({ message, isLast, onCopy, onEdit, onFeedback, onRegenerate, onVersionChange, onCheckpoint, availableModels = [], onRerunSystemWithModel, onAddToChat, onSuggestionClick }: ChatMessageProps) {
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

    // Determine if content is being "simulated" via thinking tags vs actual markdown answer
    const hasThinkingTags = message.content?.includes('<thinking>') || message.content?.includes('</thinking>');
    const isAssistantThinking = message.role === 'assistant' && (message.isThinking || hasThinkingTags);

    // Parse display parts - we only want to show the non-thinking part of the content
    const displayContent = React.useMemo(() => {
        if (!message.content) return '';
        if (hasThinkingTags) {
            return message.content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        }
        return message.content;
    }, [message.content, hasThinkingTags]);

    const isUser = message.role === 'user';
    const parsedUserContent = React.useMemo(() => isUser ? parseUserContent(message.content) : null, [isUser, message.content]);

    const isAssistant = message.role === 'assistant';
    const isSystem = message.role === 'system';
    const [copied, setCopied] = React.useState(false);
    const [feedbackGiven, setFeedbackGiven] = React.useState(!!message.feedback);
    const [isEditingPrompt, setIsEditingPrompt] = React.useState(false);
    const [isCotOpen, setIsCotOpen] = React.useState(false);
    const [editContent, setEditContent] = React.useState(message.content);
    const [regenInput, setRegenInput] = React.useState("");
    const [isRegenOpen, setIsRegenOpen] = React.useState(false);

    const versionCount = message.versions?.length || 1;
    const currentVersionIndex = message.currentVersionIndex || 0;
    const currentVersion = currentVersionIndex + 1;

    const displayRes = React.useMemo(() => {
        const v = message.versions?.[currentVersionIndex];
        if (!v) return message;
        return {
            ...message,
            content: v.content,
            toolCalls: v.toolCalls || message.toolCalls,
            feedback: v.feedback || message.feedback,
            createdAt: v.createdAt || message.createdAt,
            total_time: v.total_time !== undefined ? v.total_time : message.total_time,
            ttft: v.ttft !== undefined ? v.ttft : message.ttft,
            tps: v.tps !== undefined ? v.tps : message.tps,
            model: v.model || message.model,
            suggestions: v.suggestions || message.suggestions,
            sources: v.sources || message.sources,
            reasoning: v.reasoning || message.reasoning,
            reasoningDuration: v.reasoningDuration !== undefined ? v.reasoningDuration : message.reasoningDuration,
            steps: v.steps || message.steps
        };
    }, [message, currentVersionIndex]);

    React.useEffect(() => {
        if (displayRes.isThinking) {
            setIsCotOpen(true);
        } else {
            const timer = setTimeout(() => {
                setIsCotOpen(false);
            }, 250);
            return () => clearTimeout(timer);
        }
    }, [displayRes.isThinking]);

    const handleCopy = () => {
        onCopy(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleFeedback = (feedback: 'like' | 'dislike') => {
        setFeedbackGiven(true);
        onFeedback?.(message.id || '', feedback);
    };

    const handleRegenerateOption = (type: string) => {
        setIsRegenOpen(false);
        setRegenInput("");
        switch (type) {
            case 'retry': onRegenerate?.(); break;
            case 'custom': if (regenInput.trim()) onRegenerate?.(`Please rewrite: ${regenInput.trim()}`); break;
            case 'details': onRegenerate?.("Provide more detail."); break;
            case 'concise': onRegenerate?.("Be more concise."); break;
            case 'think': onRegenerate?.(undefined, { thinkingMode: true }); break;
        }
    };

    const handleEditPromptSubmit = () => {
        if (editContent.trim() && editContent.trim() !== message.content.trim()) {
            onEdit?.(editContent.trim());
        }
        setIsEditingPrompt(false);
    };

    const handleDownload = () => {
        const ts = message.createdAt ? new Date(message.createdAt) : new Date();
        const header = `# Message export\nMessage ID: ${message.id || 'N/A'}\nCreated: ${ts.toLocaleString()}\n---\n\n`;
        let body = header + (isUser ? "# User\n\n" : "# Assistant\n\n") + message.content;
        const blob = new Blob([body], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `msg-${message.id || Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const feedbackValue = displayRes.feedback;
    const isInterrupted = displayContent && /Stopped by user/i.test(displayContent);

    return (
        <div id={message.id} className={cn("flex w-full gap-3 group scroll-mt-24", isUser ? "justify-end" : "justify-start")}>
            <div className={cn("flex flex-col min-w-0 transition-all duration-200", isUser ? (isEditingPrompt ? "w-full items-start" : "items-end max-w-[90%]") : "items-start flex-1 max-w-full")}>
                {isUser ? (
                    <div className={cn("group relative flex flex-col items-end w-full")}>
                        {isEditingPrompt ? (
                            <div className="w-full space-y-2">
                                <Textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="text-[15px] leading-relaxed w-full min-h-[100px]"
                                    autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="outline" onClick={() => setIsEditingPrompt(false)}>Cancel</Button>
                                    <Button size="sm" onClick={handleEditPromptSubmit}>Send</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 items-end">
                                {parsedUserContent?.text && (
                                    <div className="bg-primary text-primary-foreground px-4 py-3 rounded-2xl text-[15px] leading-relaxed shadow-sm font-medium w-fit break-words">
                                        {parsedUserContent.text}
                                    </div>
                                )}
                                {(parsedUserContent?.files.length || 0) > 0 && (
                                    <div className="flex flex-wrap gap-2 justify-end mt-1">
                                        {parsedUserContent?.files.map((file, i) => (
                                            <Sheet key={i} modal={false}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <SheetTrigger asChild>
                                                            <button className="flex items-center gap-2 px-3 py-1.5 bg-muted/60 border rounded-xl text-xs font-medium hover:bg-muted/90">
                                                                <IconFileText className="size-3.5 text-primary/70" />
                                                                <span className="truncate max-w-[150px]">{file.name}</span>
                                                            </button>
                                                        </SheetTrigger>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom"><p>{file.name}</p></TooltipContent>
                                                </Tooltip>
                                                <SheetContent side="right" className="w-[400px]">
                                                    <SheetHeader><SheetTitle>{file.name}</SheetTitle></SheetHeader>
                                                    <ScrollArea className="h-full mt-4">
                                                        <pre className="p-4 bg-muted/30 rounded-xl text-[13px] whitespace-pre-wrap font-mono">{file.content}</pre>
                                                    </ScrollArea>
                                                </SheetContent>
                                            </Sheet>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="w-full space-y-2 selection:bg-primary/20 selection:text-foreground">
                        {displayRes.reasoning && (
                            <Reasoning
                                key={`reasoning-${displayRes.id}`}
                                isStreaming={displayRes.isThinking}
                                duration={displayRes.reasoningDuration}
                                thinkingType={detectThinkingTagType(displayRes.reasoning) || undefined}
                            >
                                <ReasoningTrigger className="w-fit" />
                                <ReasoningContent isStreaming={displayRes.isThinking}>{displayRes.reasoning}</ReasoningContent>
                            </Reasoning>
                        )}

                        {displayRes.isThinking && isLast && !displayRes.reasoning && (
                            <div className="flex items-center text-sm text-muted-foreground italic animate-pulse">
                                <IconBulb className="size-3 mr-2" /> Thinking...
                            </div>
                        )}

                        {displayRes.steps && displayRes.steps.length > 0 && (
                            <ChainOfThought open={isCotOpen} onOpenChange={setIsCotOpen} className="mb-2">
                                <ChainOfThoughtHeader label={displayRes.isThinking ? "Thinking..." : "Thought process"} />
                                <ChainOfThoughtContent>
                                    {displayRes.steps.map((step: any, idx: number) => (
                                        <ChainOfThoughtStep key={idx} stepType={step.stepType} label={step.label} status={step.status || "complete"} content={step.content} code={step.code} stdout={step.stdout}>
                                            {step.stepType === 'searching' && step.queries && <ChainOfThoughtSearchingQueries queries={step.queries} />}
                                            {step.stepType === 'search' && step.results && <ChainOfThoughtSourceTable sources={step.results} />}
                                        </ChainOfThoughtStep>
                                    ))}
                                </ChainOfThoughtContent>
                            </ChainOfThought>
                        )}

                        <div className="w-full max-w-full break-words overflow-hidden text-foreground leading-relaxed font-geist tracking-tight">
                            <MarkdownRenderer
                                content={displayContent || ''}
                                sources={message.sources}
                                isStreaming={isLast && isAssistantThinking}
                                className="text-[15px]"
                            />
                        </div>

                        {displayRes.suggestions && displayRes.suggestions.length > 0 && !displayRes.isThinking && (
                            <Suggestions className="mt-4">
                                {displayRes.suggestions.map((s, i) => (
                                    <Suggestion key={i} suggestion={s} onClick={onSuggestionClick} />
                                ))}
                            </Suggestions>
                        )}
                    </div>
                )}

                {/* Footer Actions */}
                <div className={cn("flex items-center w-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity justify-between", isUser && "justify-end")}>
                    {!isUser && (
                        <div className="flex items-center gap-0.5">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className={cn("h-6 w-6 rounded-md", feedbackGiven && feedbackValue === 'like' ? "text-foreground bg-sidebar-accent/40" : "text-muted-foreground hover:bg-sidebar-accent/30")} onClick={() => handleFeedback('like')}>
                                        {feedbackGiven && feedbackValue === 'like' ? <IconThumbUpFilled className="size-3.5" /> : <IconThumbUp className="size-3.5" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">Like</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className={cn("h-6 w-6 rounded-md", feedbackGiven && feedbackValue === 'dislike' ? "text-foreground bg-sidebar-accent/40" : "text-muted-foreground hover:bg-sidebar-accent/30")} onClick={() => handleFeedback('dislike')}>
                                        {feedbackGiven && feedbackValue === 'dislike' ? <IconThumbDownFilled className="size-3.5" /> : <IconThumbDown className="size-3.5" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">Dislike</TooltipContent>
                            </Tooltip>
                            <ActionButton icon={copied ? IconCheck : IconCopy} label="Copy" onClick={handleCopy} />
                            <DropdownMenu open={isRegenOpen} onOpenChange={setIsRegenOpen}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground"><IconRefresh className="size-3.5" /></Button></DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">Regenerate</TooltipContent>
                                </Tooltip>
                                <DropdownMenuContent align="start" side="top" className="w-[200px] p-2">
                                    <Input value={regenInput} onChange={(e) => setRegenInput(e.target.value)} placeholder="Modify response..." className="h-8 text-xs mb-2" onKeyDown={(e) => e.key === 'Enter' && handleRegenerateOption('custom')} />
                                    <DropdownMenuItem onClick={() => handleRegenerateOption('retry')} className="text-sm">Retry</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleRegenerateOption('think')} className="text-sm">Think Longer</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <ActionButton icon={IconDownload} label="Download" onClick={handleDownload} />
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        {isUser && onEdit && <ActionButton icon={IconEdit} label="Edit" onClick={() => { setEditContent(message.content); setIsEditingPrompt(true); }} />}
                        {isUser && <ActionButton icon={copied ? IconCheck : IconCopy} label="Copy" onClick={handleCopy} />}
                        {versionCount > 1 && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/20 px-1 rounded-md">
                                <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => onVersionChange?.('prev')} disabled={currentVersion <= 1}><IconChevronLeft className="size-2.5" /></Button>
                                <span className="min-w-[20px] text-center font-mono">{currentVersion}/{versionCount}</span>
                                <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => onVersionChange?.('next')} disabled={currentVersion >= versionCount}><IconChevronRight className="size-2.5" /></Button>
                            </div>
                        )}
                        {!isUser && displayRes.total_time && <span className="text-[10px] text-muted-foreground/40 font-mono">{Number(displayRes.total_time).toFixed(1)}s</span>}
                    </div>
                </div>
            </div>
        </div>
    )
}

function ActionButton({ icon: Icon, label, onClick, className }: { icon: any, label: string, onClick?: () => void, className?: string }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className={cn("h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 rounded-md transition-colors", className)} onClick={onClick}>
                    <Icon className="size-3.5" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>{label}</p></TooltipContent>
        </Tooltip>
    )
}
