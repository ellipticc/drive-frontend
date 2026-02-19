"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
    IconMinus,
    IconEdit,
    IconLayoutSidebar,
    IconWindowMaximize,
    IconDots,
    IconArrowUp,
    IconCloud,
    IconChevronDown,
    IconCheck,
    IconTrash,
    IconExternalLink,
    IconPencil,
    IconSparkles,
    IconThumbUp,
    IconThumbDown,
    IconCopy,
    IconRefresh
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

import { MarkdownRenderer } from "@/components/ai-elements/markdown-renderer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { nanoid } from "nanoid";

// --- Types ---
interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: number;
}

interface Model {
    id: string;
    name: string;
    icon: any;
    description: string;
}

const MODELS: Model[] = [
    { id: "auto", name: "Auto", icon: IconSparkles, description: "Automatically selects the best model" },
    { id: "llama-3-70b", name: "Llama 3 (70B)", icon: IconCloud, description: "Open source model" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo", icon: IconCloud, description: "Fast and capable model" },
    { id: "claude-3-opus", name: "Claude 3 Opus", icon: IconCloud, description: "Most capable model for complex tasks" },
];

interface PaperAIAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'floating' | 'sidebar';
    onModeChange: (mode: 'floating' | 'sidebar') => void;
    paperTitle?: string;
}

/**
 * Built-in chat hook — replaces dependency on `ai/react` package
 */
function useSimpleChat() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
        setInput(e.target.value);
    };

    const handleSubmit = async (
        e: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>,
        onSend: (msgs: ChatMessage[]) => Promise<void>
    ): Promise<void> => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: nanoid(),
            role: 'user',
            content: input.trim(),
            createdAt: Date.now(),
        };

        setInput("");
        setMessages((prev) => [...prev, userMessage]);
        setIsLoading(true);

        try {
            await onSend([...messages, userMessage]);
        } catch (error) {
            console.error("Chat error:", error);
            toast.error("Failed to send message");
        } finally {
            setIsLoading(false);
        }
    };

    const stop = (): void => {
        setIsLoading(false);
    };

    const reload = (index?: number): void => {
        if (index !== undefined && index >= 0 && index < messages.length) {
            setMessages((prev) => prev.slice(0, index + 1));
        }
    };

    return {
        messages,
        input,
        setInput,
        setMessages,
        handleInputChange,
        handleSubmit,
        isLoading,
        stop,
        reload,
    };
}

export function PaperAIAssistant({
    isOpen,
    onClose,
    mode,
    onModeChange,
    paperTitle = "Untitled Paper"
}: PaperAIAssistantProps) {
    // --- State ---
    const [selectedModel, setSelectedModel] = useState<Model>(MODELS[0]);
    const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
    const [conversationId, setConversationId] = useState<string>("");

    // Initialize conversation ID
    useEffect(() => {
        setConversationId(nanoid());
    }, []);

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // --- Simple Chat Hook ---
    const { messages, input, handleInputChange, handleSubmit: baseHandleSubmit, isLoading, stop, reload, setMessages } = useSimpleChat();

    // --- Enhanced Submit Handler (with API call) ---
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>): Promise<void> => {
        await baseHandleSubmit(e, async (msgs: ChatMessage[]) => {
            if (!conversationId) {
                const newId = nanoid();
                setConversationId(newId);
            }

            // Extract last message (user message)
            const lastMsg = msgs[msgs.length - 1];
            if (!lastMsg || lastMsg.role !== 'user') return;

            // Build clean message history for API
            const cleanMessages = msgs.map((m: ChatMessage) => ({
                role: m.role,
                content: m.content
            }));

            try {
                const response = await apiClient.chatAI(
                    cleanMessages,
                    conversationId,
                    selectedModel.id,
                );

                if (!response.ok) {
                    throw new Error(`API Error: ${response.statusText}`);
                }

                // Parse streaming response
                if (!response.body) {
                    throw new Error('No response body');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let assistantContent = "";
                let buffer = "";

                const assistantMessage: ChatMessage = {
                    id: nanoid(),
                    role: 'assistant',
                    content: "",
                    createdAt: Date.now(),
                };

                setMessages((prev: ChatMessage[]) => [...prev, assistantMessage]);

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;

                    // Process complete SSE events
                    const events = buffer.split('\n\n');
                    buffer = events.pop() || "";

                    for (const event of events) {
                        if (!event.trim()) continue;

                        const lines = event.split('\n');
                        let dataStr = "";

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                dataStr = line.replace('data: ', '').trim();
                            }
                        }

                        if (dataStr === '[DONE]') break;

                        if (dataStr) {
                            try {
                                const data = JSON.parse(dataStr);
                                const content = data.content || data.delta?.content || "";
                                if (content) {
                                    assistantContent += content;
                                    setMessages((prev: ChatMessage[]) => {
                                        const updated = [...prev];
                                        if (updated[updated.length - 1]?.role === 'assistant') {
                                            updated[updated.length - 1].content = assistantContent;
                                        }
                                        return updated;
                                    });
                                }
                            } catch {
                                // Skip malformed JSON
                            }
                        }
                    }
                }
            } catch (error: unknown) {
                toast.error("Failed to get response: " + (error instanceof Error ? error.message : "Unknown error"));
                throw error;
            }
        });

        scrollToBottom();
    };

    const scrollToBottom = useCallback(() => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, []);

    // Scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);


    // --- Handlers ---
    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (input.trim() && !isLoading) {
                handleSubmit(e as any);
            }
        }
    };

    const handleCopy = (content: string): void => {
        navigator.clipboard.writeText(content);
        toast.success("Copied to clipboard");
    };

    const handleNewChat = (): void => {
        stop();
        const newId = nanoid();
        setConversationId(newId);
        setMessages([]);
        toast.info("Started new chat");
    };

    if (!isOpen) return null;

    // --- Render Helpers ---
    const CurrentModelIcon = selectedModel.icon;

    // --- Component for Model Selector Trigger ---
    const ModelSelectorTrigger = React.forwardRef<
        HTMLButtonElement,
        React.ComponentPropsWithoutRef<typeof Button>
    >(({ className, ...props }, ref) => (
        <Button
            ref={ref}
            variant="ghost"
            size="sm"
            role="combobox"
            aria-expanded={isModelSelectorOpen}
            className={cn("h-7 gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg", className)}
            {...props}
        >
            <CurrentModelIcon className="h-3.5 w-3.5" />
            <span className="inline max-w-[80px] truncate">{selectedModel.name}</span>
            <IconChevronDown className="shrink-0 opacity-75 w-3 h-3" />
        </Button>
    ));
    ModelSelectorTrigger.displayName = "ModelSelectorTrigger";

    // --- Component for Model Selector Content ---
    const ModelSelectorContent = ({ children, className, ...props }: React.ComponentPropsWithoutRef<typeof Command>) => (
        <Command className={cn("rounded-lg border shadow-md", className)} {...props}>
            {children}
        </Command>
    );

    return (
        <TooltipProvider>
            <div
                className={cn(
                    "flex flex-col bg-background border transition-all duration-300 ease-in-out shadow-2xl z-40 overflow-hidden",
                    // Mode Styles
                    mode === 'floating'
                        ? "fixed bottom-6 right-6 w-[400px] h-[600px] rounded-3xl"
                        : "w-[400px] border-l h-full rounded-none static shrink-0" // Sidebar: static position in flex container
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <IconSparkles className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold">AI Assistant</span>
                            <span className="text-[10px] text-muted-foreground">Always here to help</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        {/* New Chat / Reset */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewChat}>
                                    <IconEdit className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">New Chat</TooltipContent>
                        </Tooltip>

                        {/* Mode Switcher */}
                        <DropdownMenu>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7">
                                            {mode === 'floating' ? <IconWindowMaximize className="h-4 w-4 text-muted-foreground" /> : <IconLayoutSidebar className="h-4 w-4 text-muted-foreground" />}
                                        </Button>
                                    </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">Switch View</TooltipContent>
                            </Tooltip>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onModeChange('floating')} className="justify-between">
                                    Floating
                                    {mode === 'floating' && <IconCheck className="h-4 w-4 ml-2" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onModeChange('sidebar')} className="justify-between">
                                    Sidebar
                                    {mode === 'sidebar' && <IconCheck className="h-4 w-4 ml-2" />}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Options Menu (Dots) */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <IconDots className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                    Last updated {format(new Date(), 'MMM d, yyyy')}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                    <IconPencil className="mr-2 h-4 w-4" />
                                    Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive focus:text-destructive">
                                    <IconTrash className="mr-2 h-4 w-4" />
                                    Delete Chat
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                    <IconExternalLink className="mr-2 h-4 w-4" />
                                    Open in new tab
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>


                        {/* Minimize / Close */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                                    <IconMinus className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">Minimize</TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                {/* Chat Area */}
                <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
                    <div className="space-y-6">
                        {messages.length === 0 ? (
                            // Empty State / Greeting
                            <div className="flex flex-col items-center justify-center h-[300px] text-center space-y-4 opacity-50">
                                <div className="bg-muted p-4 rounded-full">
                                    <IconSparkles className="h-8 w-8 text-primary" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-semibold text-lg">How can I help you?</h3>
                                    <p className="text-sm text-muted-foreground max-w-[250px]">
                                        Ask me anything about your paper, or let me generate content for you.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            // Message List
                            messages.map((m: ChatMessage) => (
                                <div key={m.id} className={cn("flex flex-col gap-2", m.role === 'user' ? "items-end" : "items-start")}>
                                    <div className={cn(
                                        "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                                        m.role === 'user'
                                            ? "bg-primary text-primary-foreground rounded-br-none"
                                            : "bg-muted text-foreground rounded-bl-none"
                                    )}>
                                        {/* Use Markdown Renderer for AI messages, simplistic text for User */}
                                        {m.role === 'assistant' ? (
                                            <div className="prose dark:prose-invert prose-sm max-w-none">
                                                <MarkdownRenderer content={m.content} />
                                            </div>
                                        ) : (
                                            <div className="whitespace-pre-wrap">{m.content}</div>
                                        )}
                                    </div>

                                    {/* Action Buttons for Assistant Messages */}
                                    {m.role === 'assistant' && (
                                        <div className="flex items-center gap-1 ml-1">
                                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => handleCopy(m.content)}>
                                                <IconCopy className="h-3 w-3 text-muted-foreground" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                                                <IconThumbUp className="h-3 w-3 text-muted-foreground" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                                                <IconThumbDown className="h-3 w-3 text-muted-foreground" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => reload()}>
                                                <IconRefresh className="h-3 w-3 text-muted-foreground" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                        {isLoading && (
                            <div className="flex items-start gap-2">
                                <div className="bg-muted px-4 py-3 rounded-2xl rounded-bl-none text-sm">
                                    <span className="animate-pulse">Thinking...</span>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="p-4 bg-background border-t">
                    <div className="relative flex flex-col gap-2 bg-muted/50 p-2 rounded-xl border border-transparent focus-within:bg-background focus-within:border-primary/20 transition-all">
                        {/* Context Pill (Optional) */}
                        <div className="flex items-center px-2 pt-1">
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 font-normal text-muted-foreground bg-background/50 border-border/50">
                                Context: {paperTitle}
                            </Badge>
                        </div>

                        <Textarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={onKeyDown}
                            placeholder="Ask me anything..."
                            className="min-h-[40px] max-h-[120px] resize-none border-none shadow-none focus-visible:ring-0 bg-transparent px-2 py-1 text-sm scrollbar-hide w-full"
                            rows={1}
                        />

                        <div className="flex items-center justify-between px-1 pb-1">
                            {/* Model Selector Button */}
                            <Popover open={isModelSelectorOpen} onOpenChange={setIsModelSelectorOpen}>
                                <PopoverTrigger asChild>
                                    <ModelSelectorTrigger />
                                </PopoverTrigger>
                                <PopoverContent className="w-[220px] p-0" align="start" side="top">
                                    <ModelSelectorContent>
                                        <CommandInput placeholder="Search models..." />
                                        <CommandList>
                                            <CommandEmpty>No model found.</CommandEmpty>
                                            <CommandGroup>
                                                {MODELS.map((model: Model) => (
                                                    <CommandItem
                                                        key={model.id}
                                                        value={model.id}
                                                        onSelect={(currentValue: string): void => {
                                                            const m = MODELS.find((m: Model) => m.id === currentValue);
                                                            if (m) setSelectedModel(m);
                                                            setIsModelSelectorOpen(false);
                                                        }}
                                                        className="flex flex-col items-start py-2 gap-1"
                                                    >
                                                        <div className="flex items-center gap-2 w-full">
                                                            <model.icon className="h-4 w-4 text-muted-foreground" />
                                                            <span className="font-medium">{model.name}</span>
                                                            {selectedModel.id === model.id && (
                                                                <IconCheck className="ml-auto h-3 w-3 opacity-100" />
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] text-muted-foreground pl-6 line-clamp-1">{model.description}</span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </ModelSelectorContent>
                                </PopoverContent>
                            </Popover>

                            <Button
                                size="icon"
                                className="h-7 w-7 rounded-lg shrink-0"
                                disabled={!input.trim() || isLoading}
                                onClick={(e) => handleSubmit(e as any)}
                            >
                                <IconArrowUp className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
