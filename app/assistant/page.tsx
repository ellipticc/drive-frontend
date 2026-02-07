"use client"

import * as React from "react"
import { useUser } from "@/components/user-context"
import { ScrollArea } from "@/components/ui/scroll-area"
import { IconPaperclip, IconSparkles, IconWorld, IconX } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import apiClient from "@/lib/api"
// Import AI Elements
import {
    PromptInput,
    PromptInputProvider,
    PromptInputTextarea,
    PromptInputFooter,
    PromptInputSubmit,
    PromptInputTools,
    PromptInputHeader,
    PromptInputBody,
    PromptInputButton,
    usePromptInputAttachments
} from "@/components/ai-elements/prompt-input"
import { SiteHeader } from "@/components/layout/header/site-header"
import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import { mermaid } from "@streamdown/mermaid"
import { useAICrypto } from "@/hooks/use-ai-crypto";
import { parseFile } from "@/lib/file-parser";
import { useRouter, useSearchParams } from "next/navigation"
import { Attachment, AttachmentPreview, AttachmentRemove, Attachments } from "@/components/ai-elements/attachments"
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion"
import { ChatMessage } from "@/components/ai-elements/chat-message"
import { toast } from "sonner"

const streamdownPlugins = { cjk, code, math, mermaid }

interface Message {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    isThinking?: boolean;
    feedback?: 'like' | 'dislike';
    originalPromptId?: string;
}

const PromptInputUploadButton = () => {
    const { openFileDialog } = usePromptInputAttachments();
    return (
        <PromptInputButton onClick={openFileDialog} className="gap-2">
            <IconPaperclip className="size-4" />
            <span className="text-xs font-medium">Upload</span>
        </PromptInputButton>
    )
}

export default function AssistantPage() {
    const { user } = useUser()
    const router = useRouter()
    const searchParams = useSearchParams()

    const [messages, setMessages] = React.useState<Message[]>([])
    const [isLoading, setIsLoading] = React.useState(false)
    const [isCancelling, setIsCancelling] = React.useState(false)
    const abortControllerRef = React.useRef<AbortController | null>(null)
    const scrollAreaRef = React.useRef<HTMLDivElement>(null)
    const [model, setModel] = React.useState("llama-3.1-8b-instant")
    const [isWebSearchEnabled, setIsWebSearchEnabled] = React.useState(false);

    const { isReady, kyberPublicKey, decryptHistory, decryptStreamChunk, encryptMessage, loadChats } = useAICrypto();

    // Derived from URL, fallback to empty (New Chat)
    const conversationId = searchParams.get('conversationId') || ""

    const lastCreatedConversationId = React.useRef<string | null>(null);

    // Load History when conversationId changes
    React.useEffect(() => {
        if (!isReady) return;

        // If this is the conversation we just created, don't clear messages!
        if (conversationId && conversationId === lastCreatedConversationId.current) {
            return;
        }

        if (conversationId) {
            setIsLoading(true);
            setMessages([]); // Clear previous messages while loading
            decryptHistory(conversationId)
                .then((msgs: Message[]) => {
                    setMessages(msgs);
                })
                .catch((err: Error) => {
                    console.error("History load error:", err);
                    router.push('/assistant');
                })
                .finally(() => setIsLoading(false));
        } else {
            // New Chat
            setMessages([]);
        }
    }, [conversationId, isReady, decryptHistory, router]);

    const scrollToBottom = () => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                // Immediate scroll is better for chat interactions
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }

    // Only auto-scroll when a NEW message is added (not during streaming updates)
    React.useEffect(() => {
        scrollToBottom()
    }, [messages.length])

    const handleSubmit = async (value: string, attachments: File[] = []) => {
        if ((!value.trim() && attachments.length === 0) || isLoading || !isReady || !kyberPublicKey) return;

        // 1. Optimistic Update (Show user message immediately)
        const tempUserMessage: Message = {
            role: 'user',
            content: value,
            // attachments: attachments.map(f => f.name) // Store names for UI if needed (schema update required)
        };
        setMessages(prev => [...prev, tempUserMessage]);

        // 2. Add Thinking State
        setMessages(prev => [...prev, { role: 'assistant', content: '', isThinking: true }]);
        setIsLoading(true);

        try {
            let finalContent = value;

            // 3. Process Attachments (RAG / Context Stuffing)
            if (attachments.length > 0) {
                // Update thinking state to show we are reading files
                setMessages(prev => {
                    const newMessages = [...prev]
                    const lastMessage = newMessages[newMessages.length - 1]
                    if (lastMessage && lastMessage.role === 'assistant') {
                        lastMessage.content = "_Reading documents..._";
                    }
                    return newMessages
                })

                const fileContents = await Promise.all(attachments.map(async (file) => {
                    try {
                        const parsed = await parseFile(file);
                        return `--- START FILE: ${parsed.title} ---\n${parsed.content}\n--- END FILE ---\n`;
                    } catch (e) {
                        return `[Failed to read file: ${file.name}]`;
                    }
                }));

                finalContent = `${value}\n\n${fileContents.join("\n")}`;

                // Clear reading status
                setMessages(prev => {
                    const newMessages = [...prev]
                    const lastMessage = newMessages[newMessages.length - 1]
                    if (lastMessage && lastMessage.role === 'assistant') {
                        lastMessage.content = "";
                    }
                    return newMessages
                })
            }

            // 4. Encrypt User Message (E2EE)
            let encryptedUserMessage;
            if (kyberPublicKey) {
                try {
                    const { encryptedContent, iv, encapsulatedKey } = await encryptMessage(finalContent);
                    encryptedUserMessage = { encryptedContent, iv, encapsulatedKey };
                } catch (e) {
                    console.error("Failed to encrypt user message:", e);
                }
            }

            // Prepare history for context (Sanitize UI flags)
            const historyPayload = messages
                .filter(m => !m.isThinking && m.content) // Remove thinking placeholders or empty msgs
                .map(m => ({ role: m.role, content: m.content }));

            // Add current user message
            const fullPayload = [...historyPayload, { role: 'user' as const, content: value }];

            // We SEND user message as plaintext (for inference) + Encrypted Blob (for storage)
            const response = await apiClient.chatAI(
                fullPayload,
                conversationId || lastCreatedConversationId.current || "", // Use new ID if we just created one
                model,
                kyberPublicKey,
                encryptedUserMessage,
                isWebSearchEnabled
            );

            if (!response.ok) throw new Error('Failed to fetch response')

            // Check for X-Conversation-Id header to redirect if it was a new chat
            const newConversationId = response.headers.get('X-Conversation-Id');
            if (newConversationId && newConversationId !== conversationId) {
                // Track this ID so we don't wipe state when the URL updates
                lastCreatedConversationId.current = newConversationId;

                // It's a new chat! Update URL without reloading
                window.history.replaceState(null, '', `/assistant?conversationId=${newConversationId}`);
                // Refresh sidebar list
                loadChats();
            }

            if (!response.body) throw new Error('No response body')

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let assistantMessageContent = ""
            let currentSessionKey: Uint8Array | undefined;

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') break;

                        try {
                            const data = JSON.parse(dataStr);

                            // Handle Encrypted Stream
                            let contentToAppend = "";

                            if (data.encrypted_content && data.iv) {
                                // Decrypt on the fly
                                const { decrypted, sessionKey } = await decryptStreamChunk(
                                    data.encrypted_content,
                                    data.iv,
                                    data.encapsulated_key,
                                    currentSessionKey
                                );
                                contentToAppend = decrypted;
                                currentSessionKey = sessionKey;
                            } else if (data.content) {
                                // Fallback for Plaintext
                                contentToAppend = data.content;
                            }

                            if (contentToAppend) {
                                assistantMessageContent += contentToAppend;

                                setMessages(prev => {
                                    const newMessages = [...prev]
                                    const lastMessage = newMessages[newMessages.length - 1]
                                    // Check if lastMessage exists and is assistant before updating
                                    if (lastMessage && lastMessage.role === 'assistant') {
                                        lastMessage.content = assistantMessageContent
                                        lastMessage.isThinking = false
                                        // Update ID if available (for feedback)
                                        if (data.id) lastMessage.id = data.id;
                                    }
                                    return newMessages
                                })
                            }
                        } catch (e) {
                            // console.warn('Failed to parse SSE line', line);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Chat error:', error)
            setMessages(prev => {
                const newMessages = [...prev]
                const lastMessage = newMessages[newMessages.length - 1]
                if (lastMessage && lastMessage.role === 'assistant') {
                    lastMessage.content = "Sorry, I encountered an error. Please try again."
                    lastMessage.isThinking = false
                }
                return newMessages
            })
        } finally {
            setIsLoading(false);
            // If we just finished a new chat response, we might want to ensure the sidebar title is updated (since backend updates title after first msg)
            if (!conversationId) {
                setTimeout(() => loadChats(), 2000);
            }
        }
    }

    // Suggestion Chips
    const suggestions = [
        "Explain quantum physics",
        "Debug a React component",
        "Write a short story",
        "Plan a 3-day trip to Paris"
    ];

    const handleSuggestionClick = (text: string) => {
        handleSubmit(text, []);
    };

    const handleRetry = (messageId: string) => {
        // Find the user message
        const message = messages.find(m => m.id === messageId);
        if (!message || message.role !== 'user') return;

        // Remove this message and all messages after it
        const messageIndex = messages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
            // Use setTimeout to ensure state updates before submit
            setTimeout(() => {
                setMessages(prev => prev.slice(0, messageIndex + 1));
                handleSubmit(message.content, []);
            }, 0);
        }
    };

    const handleRegenerate = (messageId: string) => {
        // Remove the assistant message and the thinking state before it
        setMessages(prev => {
            const newMessages = [...prev];
            const idx = newMessages.findIndex(m => m.id === messageId);
            if (idx !== -1) {
                newMessages.splice(idx, 1);
                // Also remove thinking message if it exists
                if (idx > 0 && newMessages[idx - 1]?.isThinking) {
                    newMessages.splice(idx - 1, 1);
                }
            }
            return newMessages;
        });

        // Find last user message and re-submit
        const lastUserMsg = messages.slice().reverse().find(m => m.role === 'user');
        if (lastUserMsg) {
            handleSubmit(lastUserMsg.content, []);
        }
    };

    const handleEditMessage = (messageId: string, newContent: string) => {
        // Update the user message content
        setMessages(prev => prev.map(m => 
            m.id === messageId ? { ...m, content: newContent } : m
        ));
        
        // Remove all messages after this one (including assistant response)
        const messageIndex = messages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
            setMessages(prev => prev.slice(0, messageIndex + 1));
        }

        // Re-submit with edited content
        handleSubmit(newContent, []);
    };

    const handleCopy = (content: string) => {
        navigator.clipboard.writeText(content);
    };

    const handleCancel = () => {
        if (abortControllerRef.current) {
            setIsCancelling(true);
            abortControllerRef.current.abort();
            setIsLoading(false);
            setIsCancelling(false);
        }
    };

    const handleFeedback = async (messageId: string, feedback: 'like' | 'dislike') => {
        try {
            // Check if message already has feedback
            const message = messages.find(m => m.id === messageId);
            if (message?.feedback) {
                toast.info("You've already provided feedback on this message");
                return;
            }
            
            // Update UI immediately without scrolling (by updating state first)
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, feedback } : m));
            
            // Then submit to API
            await apiClient.submitAIFeedback(messageId, feedback);
            toast.success("Thanks for your feedback!");
        } catch (error) {
            console.error("Feedback error:", error);
            toast.error("Failed to submit feedback");
        }
    };

    return (
        <div className="flex flex-col h-full bg-background relative">
            {/* Header */}
            <SiteHeader className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm" />

            {/* Main Content Area */}
            <div className="flex-1 relative flex flex-col overflow-hidden">

                {messages.length === 0 ? (
                    // ZERO STATE: Centered Input
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                        <div className="w-full max-w-2xl space-y-8 animate-in fade-in zoom-in-95 duration-500 slide-in-from-bottom-4">

                            {/* Greeting / Brand */}
                            <div className="text-center space-y-2">
                                <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 mb-4">
                                    <IconSparkles className="size-8 text-primary" />
                                </div>
                                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                                    How can I help you today?
                                </h1>
                                <p className="text-muted-foreground text-sm sm:text-base">
                                    I can help you write code, analyze documents, or plan your next project.
                                </p>
                            </div>

                            {/* Input Area */}
                            <div className="w-full">
                                <PromptInputProvider>
                                    <PromptInput
                                        onSubmit={(msg: { text: string; files: any[] }) => {
                                            handleSubmit(msg.text, msg.files.map(f => f.file || f));
                                            return Promise.resolve();
                                        }}
                                        className="bg-transparent border shadow-sm rounded-2xl overflow-hidden focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all"
                                    >
                                        <PromptInputHeader className="px-4 pt-4 empty:hidden">
                                            <PromptInputAttachmentsDisplay />
                                        </PromptInputHeader>
                                        <PromptInputBody>
                                            <PromptInputTextarea
                                                placeholder="Ask anything..."
                                                className="min-h-[60px] max-h-[200px] px-4 py-3.5 text-base resize-none field-sizing-content bg-transparent border-0 shadow-none focus-visible:ring-0"
                                            />
                                        </PromptInputBody>
                                        <PromptInputFooter className="px-3 pb-3 pt-0">
                                            <PromptInputTools>
                                                <PromptInputUploadButton />

                                                <PromptInputButton
                                                    onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
                                                    className={cn("gap-2", isWebSearchEnabled ? "bg-primary/20 text-primary hover:bg-primary/30" : "text-muted-foreground")}
                                                >
                                                    <IconWorld className="size-4" />
                                                    <span className={cn("text-xs font-medium transition-all")}>Web Search</span>
                                                </PromptInputButton>

                                            </PromptInputTools>

                                            <PromptInputSubmit className={cn("transition-opacity", isLoading ? "opacity-50" : "opacity-100")} />
                                        </PromptInputFooter>
                                    </PromptInput>
                                </PromptInputProvider>
                            </div>

                            {/* Suggestions */}
                            <div className="pt-2">
                                <Suggestions>
                                    {suggestions.map((s, i) => (
                                        <Suggestion
                                            key={i}
                                            suggestion={s}
                                            onClick={handleSuggestionClick}
                                            className="bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground border-transparent hover:border-border transition-all"
                                        />
                                    ))}
                                </Suggestions>
                            </div>
                        </div>
                    </div>
                ) : (
                    // CHAT STATE: Scrollable Messages + Sticky Bottom Input
                    <div className="flex flex-col h-full w-full">
                        {/* Messages Container */}
                        <ScrollArea ref={scrollAreaRef} className="flex-1 w-full overflow-hidden">
                            <div className="w-full h-full">
                                <div className="max-w-[920px] mx-auto px-4 py-6 space-y-8 min-h-full pb-32">
                                    {messages.map((message, index) => (
                                        <ChatMessage
                                            key={index}
                                            message={message}
                                            isLast={index === messages.length - 1}
                                            onCopy={handleCopy}
                                            onFeedback={handleFeedback}
                                            onRetry={() => handleRetry(message.id || '')}
                                            onRegenerate={() => handleRegenerate(message.id || '')}
                                            onEdit={(content) => handleEditMessage(message.id || '', content)}
                                        />
                                    ))}

                                    {/* spacer so the last message scrolls fully out before input */}
                                    <div className="h-36" aria-hidden="true" />
                                </div>
                            </div>
                        </ScrollArea>

                        {/* Sticky Input Footer */}
                        <div className="sticky bottom-0 z-40 w-full bg-background">
                            <div className="max-w-[960px] mx-auto w-full px-4 py-3">
                                <div className="mx-auto w-full max-w-[960px] bg-background shadow-sm rounded-3xl px-2 py-2 overflow-hidden focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                                    <PromptInputProvider>
                                        <PromptInput
                                            onSubmit={(msg: { text: string; files: any[] }) => {
                                                scrollToBottom();
                                                handleSubmit(msg.text, msg.files.map(f => f.file || f));
                                                return Promise.resolve();
                                            }}
                                            className="bg-background border-0 shadow-sm rounded-3xl"
                                        >
                                            <PromptInputHeader className="px-6 pt-4 empty:hidden">
                                                <PromptInputAttachmentsDisplay />
                                            </PromptInputHeader>
                                            <PromptInputBody>
                                                <PromptInputTextarea
                                                    placeholder="Message Assistant..."
                                                    className="min-h-[52px] max-h-[200px] px-6 py-4 text-base resize-none field-sizing-content bg-transparent border-0 shadow-none focus-visible:ring-0"
                                                />
                                            </PromptInputBody>
                                            <PromptInputFooter className="px-4 pb-4 pt-2 flex items-center justify-between">
                                                <PromptInputTools>
                                                    <PromptInputUploadButton />

                                                    <PromptInputButton
                                                        onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
                                                        className={cn("gap-2", isWebSearchEnabled ? "bg-primary/20 text-primary hover:bg-primary/30" : "text-muted-foreground")}
                                                    >
                                                        <IconWorld className="size-4" />
                                                        <span className={cn("text-xs font-medium transition-all")}>Web Search</span>
                                                    </PromptInputButton>
                                                </PromptInputTools>

                                                {isLoading ? (
                                                    <Button 
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={handleCancel}
                                                        className="gap-2"
                                                    >
                                                        <IconX className="size-3.5" />
                                                        Cancel
                                                    </Button>
                                                ) : (
                                                    <PromptInputSubmit />
                                                )}
                                            </PromptInputFooter>
                                        </PromptInput>
                                    </PromptInputProvider>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div >
    )
}

// Helper Component for Attachments
const PromptInputAttachmentsDisplay = () => {
    const attachments = usePromptInputAttachments();

    if (attachments.files.length === 0) {
        return null;
    }

    return (
        <Attachments variant="inline" className="px-4 pt-4">
            {attachments.files.map((attachment) => (
                <Attachment
                    data={attachment}
                    key={attachment.id}
                    onRemove={() => attachments.remove(attachment.id)}
                >
                    <AttachmentPreview />
                    <AttachmentRemove />
                </Attachment>
            ))}
        </Attachments>
    );
};
