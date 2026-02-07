"use client"

import * as React from "react"
import { useUser } from "@/components/user-context"
import { ScrollArea } from "@/components/ui/scroll-area"
import { IconSparkles, IconWorld } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import apiClient from "@/lib/api"
// Import AI Elements
import {
    PromptInput,
    PromptInputProvider,
    PromptInputTextarea,
    PromptInputFooter,
    PromptInputSubmit,
    PromptInputTools,
    PromptInputActionMenuTrigger,
    PromptInputActionMenuContent,
    PromptInputActionAddAttachments,
    PromptInputActionMenu,
    PromptInputHeader,
    PromptInputBody,
    PromptInputButton,
    usePromptInputAttachments
} from "@/components/ai-elements/prompt-input"
import { SiteHeader } from "@/components/layout/header/site-header"
import { Streamdown } from "streamdown"
import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import { mermaid } from "@streamdown/mermaid"
import { useAICrypto } from "@/hooks/use-ai-crypto";
import { parseFile } from "@/lib/file-parser";
import { useRouter, useSearchParams } from "next/navigation"
import { Attachment, AttachmentPreview, AttachmentRemove, Attachments } from "@/components/ai-elements/attachments"
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion"
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning"

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

    // Suggestion Chips
    const suggestions = [
        "Explain quantum physics",
        "Debug a React component",
        "Write a short story",
        "Plan a 3-day trip to Paris"
    ];

    const handleSuggestionClick = (text: string) => {
        // We need to set the input value, but since PromptInput is uncontrolled/internal state might be tricky.
        // Actually, better to just submit it directly?
        // User behavior: clicking suggestion usually sends it immediately.
        handleSubmit(text, []);
    };

    return (
        <div className="flex flex-col h-full bg-background relative selection:bg-primary/20 selection:text-primary">
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
                                        className="bg-transparent border shadow-lg rounded-2xl overflow-hidden focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all"
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
                                                <PromptInputActionMenu>
                                                    <PromptInputActionMenuTrigger />
                                                    <PromptInputActionMenuContent>
                                                        <PromptInputActionAddAttachments />
                                                    </PromptInputActionMenuContent>
                                                </PromptInputActionMenu>

                                                <PromptInputButton
                                                    onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
                                                    tooltip={{ content: "Search Internet", shortcut: "⌘K" }}
                                                    className={cn("gap-2", isWebSearchEnabled ? "bg-primary/20 text-primary hover:bg-primary/30" : "text-muted-foreground")}
                                                >
                                                    <IconWorld className="size-4" />
                                                    <span className={cn("text-xs font-medium transition-all", isWebSearchEnabled ? "inline-block" : "hidden group-hover:inline-block")}>Search</span>
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
                    // CHAT STATE: Scrollable Messages + Bottom Input
                    <>
                        <ScrollArea ref={scrollAreaRef} className="flex-1 w-full">
                            <div className="max-w-3xl mx-auto px-4 py-6 space-y-8 min-h-full pb-32">
                                {messages.map((message, index) => (
                                    <div
                                        key={index}
                                        className={cn(
                                            "flex w-full gap-4",
                                            message.role === 'user' ? "flex-row-reverse" : "flex-row"
                                        )}
                                    >
                                        <div className={cn(
                                            "flex flex-col max-w-[85%] sm:max-w-[75%]",
                                            message.role === 'user' ? "items-end" : "items-start"
                                        )}>
                                            {message.role === 'user' ? (
                                                <div className="bg-primary text-primary-foreground px-5 py-3.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm selection:bg-white/20">
                                                    <Streamdown plugins={streamdownPlugins as any} className="break-words whitespace-pre-wrap">
                                                        {message.content}
                                                    </Streamdown>
                                                </div>
                                            ) : (
                                                <div className="w-full space-y-2">
                                                    {/* Thinking State / Reasoning */}
                                                    {message.isThinking && (
                                                        <Reasoning isStreaming={true} defaultOpen={true} duration={undefined}>
                                                            <ReasoningTrigger className="w-fit" />
                                                            <ReasoningContent>
                                                                Thinking process...
                                                            </ReasoningContent>
                                                        </Reasoning>
                                                    )}

                                                    {/* Main Content */}
                                                    <div className="prose dark:prose-invert prose-sm max-w-none prose-headings:font-semibold prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-code:bg-muted/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none prose-pre:bg-secondary/50 prose-pre:border">
                                                        <Streamdown plugins={streamdownPlugins as any}>
                                                            {message.content}
                                                        </Streamdown>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>

                        {/* Bottom Input */}
                        <div className="absolute bottom-0 left-0 right-0 w-full px-4 pb-4 bg-gradient-to-t from-background via-background to-transparent pt-10">
                            <div className="max-w-3xl mx-auto">
                                <div className="bg-background border shadow-lg rounded-2xl focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
                                    <PromptInputProvider>
                                        <PromptInput
                                            onSubmit={(msg: { text: string; files: any[] }) => {
                                                scrollToBottom();
                                                handleSubmit(msg.text, msg.files.map(f => f.file || f));
                                                return Promise.resolve();
                                            }}
                                            className="bg-transparent border-0 shadow-none rounded-2xl"
                                        >
                                            <PromptInputHeader className="px-4 pt-4 empty:hidden">
                                                <PromptInputAttachmentsDisplay />
                                            </PromptInputHeader>
                                            <PromptInputBody>
                                                <PromptInputTextarea
                                                    placeholder="Message Assistant..."
                                                    className="min-h-[52px] max-h-[200px] px-4 py-3.5 text-base resize-none field-sizing-content bg-transparent border-0 shadow-none focus-visible:ring-0"
                                                />
                                            </PromptInputBody>
                                            <PromptInputFooter className="px-3 pb-3 pt-0">
                                                <PromptInputTools>
                                                    <PromptInputActionMenu>
                                                        <PromptInputActionMenuTrigger />
                                                        <PromptInputActionMenuContent>
                                                            <PromptInputActionAddAttachments />
                                                        </PromptInputActionMenuContent>
                                                    </PromptInputActionMenu>

                                                    <PromptInputButton
                                                        onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
                                                        tooltip={{ content: "Search Internet", shortcut: "⌘K" }}
                                                        className={cn("gap-2", isWebSearchEnabled ? "bg-primary/20 text-primary hover:bg-primary/30" : "text-muted-foreground")}
                                                    >
                                                        <IconWorld className="size-4" />
                                                        {/* <span className={cn("text-xs font-medium transition-all", isWebSearchEnabled ? "inline-block" : "hidden group-hover:inline-block")}>Search</span> */}
                                                    </PromptInputButton>
                                                </PromptInputTools>

                                                <div className="text-xs text-muted-foreground/60 hidden sm:block ml-auto mr-2">
                                                    Enter to send
                                                </div>
                                                <PromptInputSubmit className={cn("transition-opacity", isLoading ? "opacity-50" : "opacity-100")} />
                                            </PromptInputFooter>
                                        </PromptInput>
                                    </PromptInputProvider>
                                </div>
                            </div>
                        </div>
                    </>
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
