"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
    IconMinus,
    IconEdit,
    IconLayoutSidebar,
    IconWindowMaximize,
    IconDots,
    IconArrowDown,
    IconTrash,
    IconExternalLink,
    IconX,
    IconMessage,
    IconLoader2,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EnhancedPromptInput } from "@/components/enhanced-prompt-input";
import { ChatMessage, type Message } from "@/components/ai-elements/chat-message";
import { FeedbackModal } from "@/components/ai-elements/feedback-modal";
import { useAICrypto } from "@/hooks/use-ai-crypto";
import { apiClient } from "@/lib/api";
import { trimHistoryByTokens } from "@/lib/context-calculator";
import { toast } from "sonner";
import { format } from "date-fns";

// ─── Props ──────────────────────────────────────────────────────
interface PaperAIAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'floating' | 'sidebar';
    onModeChange: (mode: 'floating' | 'sidebar') => void;
    paperTitle?: string;
}

// ─── Component ──────────────────────────────────────────────────
export function PaperAIAssistant({
    isOpen,
    onClose,
    mode,
    onModeChange,
    paperTitle = "Untitled Paper"
}: PaperAIAssistantProps) {
    // ── Crypto & Chat History ───────────────────────────────────
    const {
        isReady,
        kyberPublicKey,
        decryptStreamChunk,
        encryptMessage,
        loadChats,
        chats,
        deleteChat,
    } = useAICrypto();

    // ── Chat State ──────────────────────────────────────────────
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [model, setModel] = useState("auto");
    const [conversationId, setConversationId] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // ── Feedback Modal State ─────────────────────────────────
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [feedbackMessageId, setFeedbackMessageId] = useState<string>("");
    const [feedbackRating, setFeedbackRating] = useState<"like" | "dislike" | null>(null);
    const [feedbackPromptContext, setFeedbackPromptContext] = useState<string>("");
    const [feedbackResponseContext, setFeedbackResponseContext] = useState<string>("");

    // ── Scroll ──────────────────────────────────────────────────
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollEndRef = useRef<HTMLDivElement>(null);
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        scrollEndRef.current?.scrollIntoView({ behavior });
    }, []);

    const handleScroll = useCallback(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const threshold = 120;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
        setShowScrollToBottom(!atBottom);
    }, []);

    // Auto-scroll on new streaming content
    useEffect(() => {
        if (isLoading) scrollToBottom('smooth');
    }, [messages, isLoading, scrollToBottom]);

    // ── Handle Submit (mirrors main page streaming logic) ────
    const handleSubmit = useCallback(async (
        value: string,
        _attachments: File[] = [],
        _thinkingMode: boolean = false,
        _searchMode: boolean = false
    ) => {
        if (!value.trim()) return;
        if (!isReady || !kyberPublicKey) {
            toast.error("Initializing secure session, please wait...");
            return;
        }
        if (isLoading) return;

        // Optimistic user message
        const tempId = crypto.randomUUID();
        const optimisticUserMessage: Message = {
            id: tempId,
            role: 'user',
            content: value,
            createdAt: Date.now(),
        };
        setMessages(prev => [...prev, optimisticUserMessage]);

        // Assistant thinking placeholder
        const assistantMessageId = crypto.randomUUID();
        setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: '', isThinking: true }]);
        setIsLoading(true);

        try {
            // Encrypt user message
            let encryptedUserMessage;
            try {
                const { encryptedContent, iv, encapsulatedKey } = await encryptMessage(value);
                encryptedUserMessage = { encryptedContent, iv, encapsulatedKey };
            } catch (e) {
                console.error("Failed to encrypt user message:", e);
            }

            // Build history payload with smart trimming
            const cleanedMessages = messages.filter(m => !m.isThinking && m.content);
            const trimmedMessages = trimHistoryByTokens(
                cleanedMessages,
                model,
                value,
                undefined,
                25000
            );
            const historyPayload = trimmedMessages.map(m => ({ role: m.role, content: m.content }));
            const fullPayload = [...historyPayload, { role: 'user' as const, content: value }];

            // SSE request
            const controller = new AbortController();
            abortControllerRef.current = controller;

            const response = await apiClient.chatAI(
                fullPayload,
                conversationId || "",
                model,
                kyberPublicKey,
                encryptedUserMessage,
                false, // no web search
                false, // no thinking mode
                controller.signal
            );

            if (!response.ok) {
                let body = null;
                try { body = await response.clone().json(); } catch (e) { /* ignore */ }
                const requestId = response.headers.get('X-Request-Id') || body?.requestId || null;
                const errMsg = body?.error || 'Failed to fetch response';
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    const display = `${errMsg}${requestId ? ` Request ID: \`${requestId}\`` : ''}`;
                    if (lastMessage?.role === 'assistant') {
                        lastMessage.content = display;
                        lastMessage.isThinking = false;
                    }
                    return newMessages;
                });
                throw new Error(errMsg);
            }

            // Track conversation ID from response
            const newConversationId = response.headers.get('X-Conversation-Id');
            if (newConversationId && newConversationId !== conversationId) {
                setConversationId(newConversationId);
                loadChats();
            }

            if (!response.body) throw new Error('No response body');

            // ── SSE Stream Parsing ──────────────────────────────
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let answerBuffer = "";
            let currentSessionKey: Uint8Array | undefined;
            let buffer = "";
            let pendingRafId: number | null = null;

            try {
                while (true) {
                    const { done, value: chunk } = await reader.read();
                    if (done) break;
                    if (controller.signal.aborted) break;

                    buffer += decoder.decode(chunk, { stream: true });
                    const events = buffer.split('\n\n');
                    buffer = events.pop() || "";

                    for (const event of events) {
                        if (!event.trim()) continue;

                        const lines = event.split('\n');
                        let eventType = 'data';
                        let dataStr = '';

                        for (const line of lines) {
                            if (line.startsWith('event: ')) {
                                eventType = line.replace('event: ', '').trim();
                            } else if (line.startsWith('data: ')) {
                                dataStr = line.replace('data: ', '').trim();
                            }
                        }

                        // Skip reasoning/sources/stream-complete for this simplified assistant
                        if (eventType === 'reasoning' || eventType === 'sources' || eventType === 'stream-complete') continue;

                        if (dataStr === '[DONE]') break;

                        if (dataStr) {
                            try {
                                const data = JSON.parse(dataStr);

                                // Server-side error
                                if (data.message) {
                                    setMessages(prev => {
                                        const newMessages = [...prev];
                                        const lastMessage = newMessages[newMessages.length - 1];
                                        if (lastMessage?.role === 'assistant') {
                                            lastMessage.content = data.message;
                                            lastMessage.isThinking = false;
                                        }
                                        return newMessages;
                                    });
                                    continue;
                                }

                                // Decrypt or use plain content
                                let contentToAppend = "";
                                if (data.encrypted_content && data.iv) {
                                    const { decrypted, sessionKey } = await decryptStreamChunk(
                                        data.encrypted_content,
                                        data.iv,
                                        data.encapsulated_key,
                                        currentSessionKey
                                    );
                                    contentToAppend = decrypted;
                                    currentSessionKey = sessionKey;
                                } else if (data.content) {
                                    contentToAppend = data.content;
                                }

                                if (contentToAppend) {
                                    // Strip thinking tags for simplicity
                                    contentToAppend = contentToAppend
                                        .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
                                        .replace(/<think>[\s\S]*?<\/think>/g, '');
                                    answerBuffer += contentToAppend;

                                    // Schedule batched UI update
                                    if (pendingRafId === null) {
                                        pendingRafId = requestAnimationFrame(() => {
                                            pendingRafId = null;
                                            setMessages(prev => {
                                                const newMessages = [...prev];
                                                const lastIdx = newMessages.length - 1;
                                                const lastMessage = newMessages[lastIdx];
                                                if (lastMessage?.role === 'assistant') {
                                                    newMessages[lastIdx] = {
                                                        ...lastMessage,
                                                        content: answerBuffer.trim(),
                                                        isThinking: false
                                                    };
                                                }
                                                return newMessages;
                                            });
                                        });
                                    }
                                }
                            } catch (e) {
                                console.warn('Failed to parse SSE data', dataStr, e);
                            }
                        }
                    }
                }

                // Flush remaining buffer
                if (buffer.trim()) {
                    const lines = buffer.split('\n');
                    let dataStr = '';
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            dataStr = line.replace('data: ', '').trim();
                        }
                    }
                    if (dataStr && dataStr !== '[DONE]') {
                        try {
                            const data = JSON.parse(dataStr);
                            let contentToAppend = "";
                            if (data.encrypted_content && data.iv) {
                                const { decrypted, sessionKey } = await decryptStreamChunk(
                                    data.encrypted_content, data.iv, data.encapsulated_key, currentSessionKey
                                );
                                contentToAppend = decrypted;
                                currentSessionKey = sessionKey;
                            } else if (data.content) {
                                contentToAppend = data.content;
                            }
                            if (contentToAppend) answerBuffer += contentToAppend;
                        } catch (e) {
                            console.warn('[Stream] Failed to parse final buffer', buffer, e);
                        }
                    }
                }

                // Cancel pending rAF and do final sync flush
                if (pendingRafId !== null) {
                    cancelAnimationFrame(pendingRafId);
                    pendingRafId = null;
                }

                await new Promise(resolve => setTimeout(resolve, 50));

                // Final update
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastIdx = newMessages.length - 1;
                    const lastMessage = newMessages[lastIdx];
                    if (lastMessage?.role === 'assistant') {
                        newMessages[lastIdx] = {
                            id: lastMessage.id,
                            role: 'assistant',
                            content: answerBuffer.trim(),
                            isThinking: false,
                            createdAt: lastMessage.createdAt,
                        };
                    }
                    return newMessages;
                });

            } catch (streamError) {
                const errName = (streamError as any)?.name;
                if (errName !== 'AbortError') throw streamError;
            }

        } catch (error) {
            const errName = (error as any)?.name;
            if (errName !== 'AbortError') {
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage?.role === 'assistant') {
                        lastMessage.content = 'Sorry, I encountered an error. Please try again.';
                        lastMessage.isThinking = false;
                    }
                    return newMessages;
                });
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    }, [isReady, kyberPublicKey, isLoading, messages, model, conversationId, encryptMessage, decryptStreamChunk, loadChats]);

    // ── Cancel ────────────────────────────────────────────────
    const handleCancel = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsLoading(false);
    }, []);

    // ── New Chat ──────────────────────────────────────────────
    const handleNewChat = useCallback(() => {
        setMessages([]);
        setConversationId(null);
        setIsLoading(false);
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, []);

    // ── Copy Handler ──────────────────────────────────────────
    const handleCopy = useCallback((content: string) => {
        navigator.clipboard.writeText(content);
        toast.success("Copied to clipboard");
    }, []);

    // ── Open Chat in Full Page ────────────────────────────────
    const handleOpenInFullPage = useCallback(() => {
        if (conversationId) {
            window.open(`/new?conversationId=${conversationId}`, '_blank');
        } else {
            window.open('/new', '_blank');
        }
    }, [conversationId]);

    // ── Delete Current Chat ───────────────────────────────────
    const handleDeleteChat = useCallback(async () => {
        if (!conversationId) return;
        try {
            await deleteChat(conversationId);
            handleNewChat();
            toast.success("Chat deleted");
        } catch (e) {
            toast.error("Failed to delete chat");
        }
    }, [conversationId, deleteChat, handleNewChat]);

    // ── Chat History (sorted recent first, limit 20) ─────────
    const recentChats = useMemo(() => {
        return [...chats]
            .sort((a, b) => {
                const ta = new Date(b.lastMessageAt || b.createdAt).getTime();
                const tb = new Date(a.lastMessageAt || a.createdAt).getTime();
                return ta - tb;
            })
            .slice(0, 20);
    }, [chats]);

    // ── Load a Past Conversation ─────────────────────────────
    const handleLoadChat = useCallback(async (chatId: string) => {
        try {
            // Load the chat into this component instead of opening a new tab
            setConversationId(chatId);
            setMessages([]);
            setIsLoading(true);

            // Fetch the chat messages
            const { messages: loadedMessages } = await apiClient.getAIChatMessages(chatId, { offset: 0, limit: 50 });
            
            if (loadedMessages && Array.isArray(loadedMessages)) {
                // Map backend messages to Message type
                const mappedMessages: Message[] = loadedMessages.map((m: any) => ({
                    id: m.id || crypto.randomUUID(),
                    role: m.role,
                    content: m.content,
                    createdAt: m.createdAt ? new Date(m.createdAt).getTime() : Date.now(),
                }));
                setMessages(mappedMessages);
            }
        } catch (error) {
            console.error("Failed to load chat history:", error);
            toast.error("Failed to load chat");
        } finally {
            setIsLoading(false);
        }
    }, []);

    // ── Feedback Handler ──────────────────────────────────────
    const handleFeedback = (messageId: string, feedback: 'like' | 'dislike') => {
        const msgIndex = messages.findIndex(m => m.id === messageId);
        if (msgIndex !== -1) {
            const msg = messages[msgIndex];
            const prevMsg = messages[msgIndex - 1];

            setFeedbackMessageId(messageId);
            setFeedbackRating(feedback);
            setFeedbackResponseContext(msg.content);
            setFeedbackPromptContext(prevMsg?.role === 'user' ? prevMsg.content : "Context unavailable");
            setIsFeedbackModalOpen(true);
        }
    };

    // ── Submit Feedback ──────────────────────────────────────
    const submitFeedback = async (messageId: string, rating: 'like' | 'dislike', reasons: string[], details: string, context: any) => {
        try {
            setMessages(prev => prev.map(msg =>
                msg.id === messageId ? { ...msg, feedback: rating } : msg
            ));

            await apiClient.submitDetailedFeedback({
                messageId,
                rating,
                reasons,
                details,
                promptContext: context?.prompt,
                responseContext: context?.response
            });
        } catch (error) {
            console.error("Failed to submit feedback", error);
            toast.error("Failed to save feedback");
        }
    };

    // ── Don't render when closed ─────────────────────────────
    if (!isOpen) return null;

    const hasConversation = messages.length > 0;

    // ── Container classes per mode ───────────────────────────
    const containerClasses = mode === 'sidebar'
        ? "flex flex-col h-screen w-[420px] shrink-0 border-r bg-sidebar fixed right-0 top-0 bottom-0 z-40 shadow-lg"
        : cn(
            "fixed z-50 flex flex-col bg-sidebar border rounded-2xl shadow-2xl",
            "right-4 bottom-4 w-[440px]",
            "h-[min(560px,calc(100vh-80px))]"
        );

    return (
        <div className={containerClasses}>
            {/* ── Header ──────────────────────────────────── */}
            <div className="flex items-center justify-between px-3 py-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    {!hasConversation ? (
                        // Empty state: "New AI chat" + chat history dropdown
                        <div className="flex items-center gap-1">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-sm font-semibold px-2 hover:bg-muted/60">
                                        <IconMessage className="size-4" />
                                        <span>New AI chat</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-72 max-h-80 overflow-y-auto">
                                    <DropdownMenuLabel className="text-xs text-muted-foreground">Recent chats</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {recentChats.length === 0 ? (
                                        <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                                            No previous chats
                                        </div>
                                    ) : (
                                        recentChats.map(chat => (
                                            <DropdownMenuItem
                                                key={chat.id}
                                                onClick={() => handleLoadChat(chat.id)}
                                                className="flex flex-col items-start gap-0.5 cursor-pointer"
                                            >
                                                <span className="text-sm font-medium truncate w-full">{chat.title}</span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {format(new Date(chat.createdAt), 'MMM d, yyyy')}
                                                </span>
                                            </DropdownMenuItem>
                                        ))
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ) : (
                        // Active conversation: show title
                        <span className="text-sm font-semibold truncate">AI Assistant</span>
                    )}
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                    {/* Three dots menu — only when conversation exists */}
                    {hasConversation && (
                        <DropdownMenu>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                            <IconDots className="size-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-xs">More options</TooltipContent>
                            </Tooltip>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={handleOpenInFullPage}>
                                    <IconExternalLink className="size-4 mr-2" />
                                    Open in full page
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleDeleteChat} className="text-destructive focus:text-destructive">
                                    <IconTrash className="size-4 mr-2" />
                                    Delete chat
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    {/* New chat */}
                    {hasConversation && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleNewChat}>
                                    <IconEdit className="size-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">New chat</TooltipContent>
                        </Tooltip>
                    )}

                    {/* Mode toggle */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => onModeChange(mode === 'floating' ? 'sidebar' : 'floating')}
                            >
                                {mode === 'floating' ? <IconLayoutSidebar className="size-4" /> : <IconWindowMaximize className="size-4" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                            {mode === 'floating' ? 'Dock to sidebar' : 'Float window'}
                        </TooltipContent>
                    </Tooltip>

                    {/* Close / minimize */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onClose}>
                                {mode === 'floating' ? <IconX className="size-4" /> : <IconMinus className="size-4" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">{mode === 'floating' ? 'Close' : 'Minimize'}</TooltipContent>
                    </Tooltip>
                </div>
            </div>

            {/* ── Messages Area ───────────────────────────── */}
            {!hasConversation ? (
                // Empty state — centered greeting
                <div className="flex-1 flex flex-col items-center justify-center p-6">
                    <div className="text-center space-y-2 animate-in fade-in duration-500">
                        <h2 className="text-lg font-semibold tracking-tight">
                            How can I help?
                        </h2>
                        <p className="text-xs text-muted-foreground max-w-[260px] mx-auto">
                            Ask me anything about your paper, or get help writing, editing, and more.
                        </p>
                    </div>
                </div>
            ) : (
                // Chat messages
                <div className="flex flex-col flex-1 min-h-0 relative">
                    <div
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto px-3 py-3 scroll-smooth min-h-0 overflow-x-hidden"
                    >
                        <div className="flex flex-col items-center w-full">
                            {messages.map((message, index) => {
                                const isUserMsg = message.role === 'user';
                                const nextMsg = messages[index + 1];
                                const isFollowedByAssistant = nextMsg?.role === 'assistant';
                                const spacing = isUserMsg && isFollowedByAssistant ? 'mb-1' : 'mb-3';

                                return (
                                    <div
                                        key={message.id || index}
                                        className={cn("w-full flex justify-center animate-in fade-in duration-200", spacing)}
                                    >
                                        <div className="w-full max-w-full">
                                            <ChatMessage
                                                message={message}
                                                isLast={index === messages.length - 1}
                                                onCopy={handleCopy}
                                                onFeedback={handleFeedback}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={scrollEndRef} className="h-1 w-full" />
                        </div>
                    </div>

                    {/* Scroll to bottom */}
                    {showScrollToBottom && (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
                            <Button
                                variant="outline"
                                size="icon"
                                className="rounded-full shadow-md bg-background hover:bg-muted size-7"
                                onClick={() => scrollToBottom()}
                            >
                                <IconArrowDown className="size-3.5" />
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Input Area ──────────────────────────────── */}
            <div className="shrink-0 px-3 pb-3 pt-1">
                <EnhancedPromptInput
                    onSubmit={async (text, files, thinkingMode, searchMode) => {
                        await handleSubmit(text, files, thinkingMode, searchMode);
                    }}
                    isLoading={isLoading || !isReady}
                    onStop={handleCancel}
                    model={model}
                    onModelChange={setModel}
                />
            </div>

            {/* ── Feedback Modal ──────────────────────────── */}
            <FeedbackModal
                isOpen={isFeedbackModalOpen}
                onOpenChange={setIsFeedbackModalOpen}
                messageId={feedbackMessageId}
                initialRating={feedbackRating}
                promptContext={feedbackPromptContext}
                responseContext={feedbackResponseContext}
                onSubmit={submitFeedback}
            />
        </div>
    );
}
