"use client"

import * as React from "react"
import { useUser } from "@/components/user-context"
import { ScrollArea } from "@/components/ui/scroll-area"
import { IconSparkles, IconWorld } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import apiClient from "@/lib/api"
// Import AI Elements
import { PromptInput, PromptInputProvider, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input" // Simplified imports
import { SiteHeader } from "@/components/layout/header/site-header"
import { Streamdown } from "streamdown"
import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import { mermaid } from "@streamdown/mermaid"
import { useAICrypto } from "@/hooks/use-ai-crypto";
import { parseFile } from "@/lib/file-parser";
import { useRouter, useSearchParams } from "next/navigation"

const streamdownPlugins = { cjk, code, math, mermaid }

interface Message {
    role: 'user' | 'assistant';
    content: string;
    isThinking?: boolean;
}

export default function AssistantPage() {
    const { user } = useUser()
    const router = useRouter()
    const searchParams = useSearchParams()

    const [messages, setMessages] = React.useState<Message[]>([])
    const [isLoading, setIsLoading] = React.useState(false)
    const scrollAreaRef = React.useRef<HTMLDivElement>(null)
    const [model, setModel] = React.useState("llama-3.1-8b-instant") // Could become a setting
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

    React.useEffect(() => {
        scrollToBottom()
    }, [messages, isLoading])

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

    return (
        <div className="flex flex-col h-full bg-background relative isolate">
            <SiteHeader
                sticky
                customTitle={
                    <div className="flex items-center gap-2">
                        <IconSparkles className="size-4 text-primary" />
                        <h1 className="text-sm font-medium">Assistant</h1>
                    </div>
                }
            />

            <ScrollArea className="flex-1" ref={scrollAreaRef}>
                <div className="max-w-4xl mx-auto px-6 py-8 space-y-10 pb-40">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center text-muted-foreground animate-in fade-in zoom-in duration-500">
                            <div className="p-4 rounded-full bg-primary/10 mb-6">
                                <IconSparkles className="size-8 text-primary" />
                            </div>
                            <h2 className="text-2xl font-semibold mb-2 text-foreground">How can I help you today?</h2>
                            <p className="max-w-md">Ask me anything about your documents, analyze data, or just have a chat.</p>
                        </div>
                    )}

                    {messages.map((message, index) => (
                        <div
                            key={index}
                            className={cn(
                                "flex w-full flex-col",
                                message.role === 'user' ? "items-end" : "items-start"
                            )}
                        >
                            {/* User Message: Card-like, Colored */}
                            {message.role === 'user' && (
                                <div className="bg-secondary/50 dark:bg-muted/50 text-foreground px-5 py-3.5 rounded-2xl max-w-[85%] md:max-w-[75%] lg:max-w-[65%] text-sm leading-relaxed shadow-sm border border-border/50">
                                    <Streamdown plugins={streamdownPlugins as any}>
                                        {message.content}
                                    </Streamdown>
                                </div>
                            )}

                            {/* Assistant Message: Clean Text, No Background */}
                            {message.role === 'assistant' && (
                                <div className="w-full max-w-[90%] md:max-w-[85%] px-1">
                                    {message.isThinking && (
                                        <div className="flex items-center gap-2 mb-2 text-muted-foreground text-xs uppercase tracking-wider font-medium">
                                            <IconSparkles className="size-3.5 animate-pulse" />
                                            Thinking...
                                        </div>
                                    )}
                                    <div className="prose dark:prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent">
                                        <Streamdown plugins={streamdownPlugins as any}>
                                            {message.content}
                                        </Streamdown>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </ScrollArea>

            {/* Floating Input Area */}
            <div className="absolute bottom-6 left-0 right-0 px-6 z-20">
                <div className="max-w-3xl mx-auto">
                    {/* Search Toggle Pill */}
                    <div className="flex justify-start mb-2 px-1">
                        <button
                            onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border shadow-sm backdrop-blur-md",
                                isWebSearchEnabled
                                    ? "bg-primary/20 text-primary border-primary/30 hover:bg-primary/30"
                                    : "bg-background/80 text-muted-foreground border-border hover:bg-muted/80"
                            )}
                        >
                            <IconWorld className={cn("size-3.5", isWebSearchEnabled && "text-primary")} />
                            <span>Search Internet</span>
                        </button>
                    </div>

                    <div className="bg-background/80 backdrop-blur-xl border shadow-lg rounded-2xl transition-all duration-200 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
                        <PromptInputProvider>
                            <PromptInput
                                onSubmit={(msg: { text: string; files: any[] }) => {
                                    handleSubmit(msg.text, msg.files.map(f => f.file || f)); // Extract File objects
                                    return Promise.resolve();
                                }}
                                className="bg-transparent border-0 shadow-none rounded-2xl"
                            >
                                <PromptInputTextarea
                                    placeholder="Message Assistant..."
                                    className="min-h-[52px] max-h-[200px] px-4 py-3.5 text-base resize-none field-sizing-content"
                                />
                                <PromptInputFooter className="px-3 pb-3 pt-0">
                                    <div className="text-xs text-muted-foreground/60 hidden sm:block">
                                        Enter to send, Shift + Enter for new line
                                    </div>
                                    <PromptInputSubmit className="ml-auto" />
                                </PromptInputFooter>
                            </PromptInput>
                        </PromptInputProvider>
                    </div>
                </div>
            </div>
        </div >
    )
}
