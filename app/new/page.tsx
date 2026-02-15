"use client"

import * as React from "react"
import { useUser } from "@/components/user-context"
import { IconSparkles, IconBookmark, IconRotateClockwise, IconPlus } from "@tabler/icons-react"
import { Checkpoint, CheckpointIcon, CheckpointTrigger } from "@/components/ai-elements/checkpoint"
import apiClient from "@/lib/api"

import { Skeleton } from "@/components/ui/skeleton"
import { IconLoader2 } from "@tabler/icons-react"
// Import AI Elements
import { EnhancedPromptInput } from "@/components/enhanced-prompt-input"
import { SiteHeader } from "@/components/layout/header/site-header"
import { useAICrypto } from "@/hooks/use-ai-crypto";
import { parseFile } from "@/lib/file-parser";
import { useRouter, useSearchParams } from "next/navigation"
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion"
import { ChatMessage } from "@/components/ai-elements/chat-message"
import { ChatScrollNavigation } from "@/components/ai-elements/chat-navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface MessageVersion {
    id: string;
    content: string;
    toolCalls?: any[];
    createdAt?: number;
    feedback?: 'like' | 'dislike';
}

interface Message {
    id?: string;
    role: 'user' | 'assistant' | 'system'; // Added system
    content: string;
    isThinking?: boolean;
    createdAt?: number | string; // Allow string date
    feedback?: 'like' | 'dislike';
    originalPromptId?: string;
    sources?: { title: string; url: string; content?: string }[];
    toolCalls?: any[]; // using any for simplicity or import ToolCall
    versions?: MessageVersion[];
    currentVersionIndex?: number;
    isCheckpoint?: boolean;
    reasoning?: string;
    reasoningDuration?: number;
    suggestions?: string[];
}


export default function AssistantPage() {
    const { user } = useUser()
    const router = useRouter()
    const searchParams = useSearchParams()

    const [messages, setMessages] = React.useState<Message[]>([])
    const [isLoading, setIsLoading] = React.useState(false)
    const [isCancelling, setIsCancelling] = React.useState(false)
    const abortControllerRef = React.useRef<AbortController | null>(null)
    const [model, setModel] = React.useState("llama-3.3-70b-versatile")
    const [isWebSearchEnabled, setIsWebSearchEnabled] = React.useState(false);
    const [chatTitle, setChatTitle] = React.useState<string>('Chat');
    const lastScrollTopRef = React.useRef(0)
    const [isLoadingOlder, setIsLoadingOlder] = React.useState(false)
    const [pagination, setPagination] = React.useState({ offset: 0, limit: 50, total: 0, hasMore: false })
    const isLoadingOlderRef = React.useRef(false)

    const { isReady, kyberPublicKey, decryptHistory, decryptStreamChunk, encryptMessage, loadChats, chats } = useAICrypto();

    // Available models for system rerun popovers
    const availableModels = [
        { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B" },
        { id: "qwen/qwen3-32b", name: "Qwen 3 32B" },
        { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B" },
    ];

    const handleRerunSystemWithModel = async (systemMessageId: string, modelId: string) => {
        // Find the system message index
        const systemIndex = messages.findIndex(m => m.id === systemMessageId);
        if (systemIndex === -1) return;

        // Find the preceding user message
        let userIndex = -1;
        for (let i = systemIndex - 1; i >= 0; i--) {
            if (messages[i].role === 'user') { userIndex = i; break; }
        }
        if (userIndex === -1) {
            toast.error('No user message to rerun');
            return;
        }

        const userMessage = messages[userIndex];
        if (!userMessage) return;

        // Remove system response (and anything after it) so we replace the assistant reply
        setMessages(prev => prev.slice(0, userIndex + 1));

        // Temporarily set the model and resubmit the user prompt
        setModel(modelId);
        await handleSubmit(userMessage.content, []);
    };

    // Derived from URL, fallback to empty (New Chat)
    const conversationId = searchParams.get('conversationId') || ""

    const lastCreatedConversationId = React.useRef<string | null>(null);

    // Scroll Container Ref
    const scrollContainerRef = React.useRef<HTMLDivElement>(null)
    const virtualParentRef = React.useRef<HTMLDivElement>(null)

    // Standard scrolling state
    const [isAtBottom, setIsAtBottom] = React.useState(true);
    const scrollEndRef = React.useRef<HTMLDivElement>(null);
    const [showScrollToBottom, setShowScrollToBottom] = React.useState(false); // Show button when user scrolls up

    const scrollToMessage = (messageId: string, behavior: ScrollBehavior = 'smooth') => {
        // Only auto-scroll if user hasn't manually scrolled away from bottom
        if (!shouldAutoScrollRef.current && behavior !== 'auto') return;

        const element = document.getElementById(`message-${messageId}`);
        if (element) {
            element.scrollIntoView({ behavior, block: 'start' });
        }
    };

    // Robust scroll-to-bottom
    const scrollToBottom = React.useCallback((behavior: ScrollBehavior = 'smooth') => {
        scrollEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    }, []);

    // Effect to auto-scroll when messages change and we are "sticking" to bottom
    React.useEffect(() => {
        if (shouldAutoScrollRef.current) {
            scrollToBottom('smooth');
        }
    }, [messages, scrollToBottom]);

    const handleVersionChange = (messageId: string, direction: 'prev' | 'next') => {
        setMessages(prev => {
            const newMessages = [...prev];
            const msgIndex = newMessages.findIndex(m => m.id === messageId);
            if (msgIndex === -1) return prev;

            const msg = newMessages[msgIndex];
            if (!msg.versions || msg.versions.length <= 1) return prev;

            const currentIndex = msg.currentVersionIndex || 0;
            const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;

            if (newIndex >= 0 && newIndex < msg.versions.length) {
                // Swap content to main object
                const version = msg.versions[newIndex];
                msg.content = version.content;
                msg.toolCalls = version.toolCalls;
                msg.id = version.id; // Although ID might change if backend treats them as diff messages, usually nice to keep stable unless backend returns new ID.
                msg.feedback = version.feedback;
                msg.currentVersionIndex = newIndex;
            }
            return newMessages;
        });
    };

    // Update page title based on chat
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            let title = 'New Chat | Ellipticc';
            let chatTitle = 'New Chat';

            if (conversationId) {
                const currentChat = chats.find(chat => chat.id === conversationId);
                if (currentChat) {
                    title = `${currentChat.title} | Ellipticc`;
                    chatTitle = currentChat.title;
                } else {
                    title = 'Chat | Ellipticc';
                    chatTitle = 'Chat';
                }
            }

            document.title = title;
            setChatTitle(chatTitle);
        }
    }, [conversationId, chats]);

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
                    setChatTitle('Chat');

                    setPagination({
                        offset: 0,
                        limit: 50,
                        total: msgs.length,
                        hasMore: msgs.length >= 50
                    });

                    // Scroll to last user message after render
                    setTimeout(() => {
                        const lastUserMsg = msgs.slice().reverse().find(m => m.role === 'user');
                        if (lastUserMsg && lastUserMsg.id) {
                            scrollToMessage(lastUserMsg.id, 'auto'); // Instant jump on load
                        }
                    }, 100);
                })
                .catch((err: Error) => {
                    console.error("History load error:", err);
                    router.push('/assistant');
                })
                .finally(() => setIsLoading(false));
        } else {
            // New Chat
            setChatTitle('New Chat');
            setMessages([]);
            setPagination({ offset: 0, limit: 50, total: 0, hasMore: false });
        }
    }, [conversationId, isReady, decryptHistory, router]);

    const [contextItems, setContextItems] = React.useState<Array<{ id: string; type: 'text' | 'code'; content: string }>>([]);

    // We use a ref to track if we should auto-scroll, to avoid state updates causing re-renders/race conditions during scroll events
    const shouldAutoScrollRef = React.useRef(true);



    // Keyboard shortcut: Esc to stop active generation
    React.useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isLoading && !isCancelling) {
                e.preventDefault();
                handleCancel();
            }
        };
        if (isLoading) {
            document.addEventListener('keydown', handler);
        }
        return () => document.removeEventListener('keydown', handler);
    }, [isLoading, isCancelling]);

    // Auto-scroll interruption detection: stop auto-scroll if user manually scrolls
    // Also handle pagination when scrolling to top
    React.useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        // Debounced scroll handler to avoid excessive pagination loads
        let scrollTimeout: NodeJS.Timeout | null = null;
        const SCROLL_THRESHOLD = 500; // px from top to trigger load
        const DEBOUNCE_MS = 300; // Wait 300ms before checking pagination

        const handleScroll = () => {
            const scrollTop = container.scrollTop;
            const scrollHeight = container.scrollHeight;
            const clientHeight = container.clientHeight;

            // Check if user is at the bottom (with tolerance)
            const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
            shouldAutoScrollRef.current = isAtBottom;
            setIsAtBottom(isAtBottom);
            setShowScrollToBottom(!isAtBottom); // Show button only if scrolled up

            // Debounced pagination check
            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(async () => {
                // Check if should load older messages
                if (
                    scrollTop < SCROLL_THRESHOLD &&
                    pagination.hasMore &&
                    !isLoadingOlderRef.current &&
                    conversationId
                ) {
                    // Prevent concurrent loads
                    isLoadingOlderRef.current = true;
                    setIsLoadingOlder(true);

                    try {
                        const nextOffset = pagination.offset + pagination.limit;

                        const result = await apiClient.getAIChatMessages(conversationId, {
                            offset: nextOffset,
                            limit: pagination.limit,
                        });

                        if (result.messages && result.messages.length > 0) {
                            // Prepend older messages to the beginning
                            setMessages(prev => {
                                // Ensure no duplicates by checking IDs
                                const existingIds = new Set(prev.map(m => m.id));
                                const newMessages = result.messages.filter(m => !existingIds.has(m.id));
                                return [...newMessages, ...prev];
                            });

                            // Update pagination state AFTER message update
                            setPagination(prev => ({
                                offset: result.pagination.offset,
                                limit: result.pagination.limit,
                                total: result.pagination.total,
                                hasMore: result.pagination.hasMore,
                            }));
                        }
                    } catch (err) {
                        console.error("Failed to load older messages:", err);
                        toast.error("Failed to load older messages");
                    } finally {
                        isLoadingOlderRef.current = false;
                        setIsLoadingOlder(false);
                    }
                }
            }, DEBOUNCE_MS);

            lastScrollTopRef.current = scrollTop;
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            container.removeEventListener('scroll', handleScroll);
            if (scrollTimeout) clearTimeout(scrollTimeout);
        };
    }, [conversationId, pagination.hasMore, pagination.offset, pagination.limit]);

    const handleSubmit = async (value: string, attachments: File[] = [], thinkingMode: boolean = false, searchMode: boolean = false) => {
        if (!value.trim() && attachments.length === 0 && contextItems.length === 0) return;

        if (!isReady || !kyberPublicKey) {
            console.warn("Crypto not ready:", { isReady, hasKey: !!kyberPublicKey });
            toast.error("Initializing secure session, please wait...");
            return;
        }

        if (isLoading) return;

        // Prepare content with context items if present
        let finalContent = value;
        if (contextItems.length > 0) {
            const contextString = contextItems.map(item =>
                `[CONTEXT (${item.type})]\n${item.content}\n[/CONTEXT]`
            ).join('\n\n');

            // Append context to the message
            finalContent = `${contextString}\n\n${value}`;

            // Clear context items after sending
            setContextItems([]);
        }

        // Optimistic Update
        // Generate a temporary ID for the user message to allow scrolling
        const tempId = crypto.randomUUID();
        const tempUserMessage: Message = {
            id: tempId,
            role: 'user',
            content: finalContent,
            // attachments: attachments.map(f => f.name) // Store names for UI if needed (schema update required)
        };
        setMessages(prev => [...prev, tempUserMessage]);

        // Force scroll to bottom on new message
        shouldAutoScrollRef.current = true;
        setTimeout(() => scrollToMessage(tempId, 'smooth'), 10);

        // Add Thinking State & Reset auto-scroll
        const assistantMessageId = crypto.randomUUID();
        setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: '', isThinking: true, reasoning: '' }]);
        setIsLoading(true);

        try {
            let finalContent = value;

            // Process Attachments (RAG / Context Stuffing)
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

            // Encrypt User Message (E2EE)
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
            // Optimization: Only send last 30 messages to save bandwidth/tokens
            const historyPayload = messages
                .filter(m => !m.isThinking && m.content) // Remove thinking placeholders or empty msgs
                .slice(-30)
                .map(m => ({ role: m.role, content: m.content }));

            // Add current user message
            const fullPayload = [...historyPayload, { role: 'user' as const, content: value }];

            // We SEND user message as plaintext (for server inference) + Encrypted Blob (for storage)
            const controller = new AbortController();
            abortControllerRef.current = controller;

            const response = await apiClient.chatAI(
                fullPayload,
                conversationId || lastCreatedConversationId.current || "", // Use new ID if we just created one
                model,
                kyberPublicKey,
                encryptedUserMessage,
                searchMode,
                thinkingMode,
                controller.signal
            );

            if (!response.ok) {
                // Attempt to parse JSON body for error and requestId
                let body = null;
                try {
                    body = await response.clone().json();
                } catch (e) {
                    // ignore
                }
                const requestId = response.headers.get('X-Request-Id') || body?.requestId || null;
                const errMsg = body?.error || 'Failed to fetch response';

                // Show message inline in assistant chat with request ID
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    const display = `${errMsg}${requestId ? ` Request ID: \`${requestId}\`` : ''}`;
                    if (lastMessage && lastMessage.role === 'assistant') {
                        lastMessage.content = display;
                        lastMessage.isThinking = false;
                    } else {
                        newMessages.push({ role: 'assistant', content: display, isThinking: false });
                    }
                    return newMessages;
                });

                throw new Error(JSON.stringify({ message: errMsg, requestId }));
            }

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
            // Three separate buffers for proper content separation
            let thinkingBuffer = ""; // Content inside <>thinking>...</thinking>
            let answerBuffer = ""; // Content outside thinking tags
            let assistantReasoningContent = ""; // Processed thinking (from backend reasoning event)
            let messageSources: any[] = []; // Track sources for citations
            let isInsideThinkingTag = false;
            let currentSessionKey: Uint8Array | undefined;
            let buffer = ""; // Buffer for incomplete SSE events
            let pendingRafId: number | null = null; // requestAnimationFrame ID for batched UI updates

            try {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    const chunk = decoder.decode(value, { stream: true })
                    buffer += chunk;

                    // Split by event separator and keep incomplete event
                    const events = buffer.split('\n\n');
                    buffer = events.pop() || ""; // Keep incomplete event in buffer

                    for (const event of events) {
                        if (!event.trim()) continue;

                        const lines = event.split('\n');
                        let eventType = 'data'; // Default event type
                        let dataStr = '';

                        // Parse event type and data
                        for (const line of lines) {
                            if (line.startsWith('event: ')) {
                                eventType = line.replace('event: ', '').trim();
                            } else if (line.startsWith('data: ')) {
                                dataStr = line.replace('data: ', '').trim();
                            }
                        }

                        // Handle reasoning events (from backend)
                        if (eventType === 'reasoning' && dataStr) {
                            try {
                                const data = JSON.parse(dataStr);
                                let chunkReasoning = '';

                                // Support encrypted reasoning payloads
                                if (data.encrypted_reasoning && data.reasoning_iv) {
                                    const { decrypted, sessionKey } = await decryptStreamChunk(
                                        data.encrypted_reasoning,
                                        data.reasoning_iv,
                                        data.encapsulated_key,
                                        currentSessionKey
                                    );
                                    chunkReasoning = decrypted;
                                    currentSessionKey = sessionKey;
                                } else if (data.reasoning) {
                                    chunkReasoning = data.reasoning;
                                }

                                if (chunkReasoning) {
                                    assistantReasoningContent += chunkReasoning;

                                    // Schedule UI update (batched per animation frame)
                                    if (pendingRafId === null) {
                                        pendingRafId = requestAnimationFrame(() => {
                                            pendingRafId = null;
                                            setMessages(prev => {
                                                const newMessages = [...prev];
                                                const lastIdx = newMessages.length - 1;
                                                const lastMessage = newMessages[lastIdx];
                                                if (lastMessage && lastMessage.role === 'assistant') {
                                                    newMessages[lastIdx] = {
                                                        ...lastMessage,
                                                        reasoning: assistantReasoningContent,
                                                        isThinking: true
                                                    };
                                                }
                                                return newMessages;
                                            });
                                        });
                                    }
                                }
                            } catch (e) {
                                console.warn('Failed to parse reasoning event', dataStr, e);
                            }

                            continue;
                        }

                        // Handle stream-complete signal (backend finished streaming all events)
                        if (eventType === 'stream-complete') {
                            console.log('[Stream] Received stream-complete marker from backend');
                            // This ensures we process any remaining buffer before the while loop exits
                            continue;
                        }

                        // Handle sources events (citations from web search)
                        if (eventType === 'sources' && dataStr) {
                            try {
                                const data = JSON.parse(dataStr);
                                let sourcesData = null;

                                // Support encrypted sources payloads
                                if (data.encrypted_sources && data.sources_iv) {
                                    const { decrypted, sessionKey } = await decryptStreamChunk(
                                        data.encrypted_sources,
                                        data.sources_iv,
                                        data.encapsulated_key,
                                        currentSessionKey
                                    );
                                    currentSessionKey = sessionKey;
                                    sourcesData = JSON.parse(decrypted);
                                } else if (data.sources) {
                                    sourcesData = data.sources || data;
                                }

                                if (sourcesData && Array.isArray(sourcesData.sources)) {
                                    messageSources = sourcesData.sources.map((s: any, idx: number) => ({
                                        title: s.title,
                                        url: s.url,
                                        content: s.description || s.content || ''
                                    }));

                                    // Update message with sources
                                    setMessages(prev => {
                                        const newMessages = [...prev];
                                        const lastIdx = newMessages.length - 1;
                                        const lastMessage = newMessages[lastIdx];
                                        if (lastMessage && lastMessage.role === 'assistant') {
                                            newMessages[lastIdx] = {
                                                ...lastMessage,
                                                sources: messageSources
                                            };
                                        }
                                        return newMessages;
                                    });
                                } else if (Array.isArray(sourcesData)) {
                                    messageSources = sourcesData.map((s: any) => ({
                                        title: s.title,
                                        url: s.url,
                                        content: s.description || s.content || ''
                                    }));

                                    setMessages(prev => {
                                        const newMessages = [...prev];
                                        const lastIdx = newMessages.length - 1;
                                        const lastMessage = newMessages[lastIdx];
                                        if (lastMessage && lastMessage.role === 'assistant') {
                                            newMessages[lastIdx] = {
                                                ...lastMessage,
                                                sources: messageSources
                                            };
                                        }
                                        return newMessages;
                                    });
                                }
                            } catch (e) {
                                console.warn('Failed to parse sources event', dataStr, e);
                            }
                            continue;
                        }

                        // Handle regular content events
                        if (dataStr === '[DONE]') {
                            console.log('[Stream] Received [DONE]. answerBuffer.length:', answerBuffer.length, 'reasoning.length:', assistantReasoningContent.length);
                            break;
                        }

                        if (dataStr) {
                            try {
                                const data = JSON.parse(dataStr);

                                // Handle Server-side error
                                if (data.message) {
                                    setMessages(prev => {
                                        const newMessages = [...prev];
                                        const lastIdx = newMessages.length - 1;
                                        const lastMessage = newMessages[lastIdx];
                                        if (lastMessage && lastMessage.role === 'assistant') {
                                            newMessages[lastIdx] = {
                                                ...lastMessage,
                                                content: data.message,
                                                isThinking: false
                                            };
                                        } else {
                                            newMessages.push({ role: 'assistant', content: data.message, isThinking: false });
                                        }
                                        return newMessages;
                                    });

                                    try {
                                        const m = data.message;
                                        const match = m && m.match(/`([^`]+)`/);
                                        const id = match ? match[1] : null;
                                        if (id) {
                                            toast.error(`Server error (Request ID: ${id})`)
                                        } else {
                                            toast.error('Server error')
                                        }
                                    } catch (e) {
                                        // ignore
                                    }

                                    continue;
                                }

                                // Handle Encrypted/Plain Stream Content
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
                                    // Process thinking tags: extract thinking content, keep answer separate
                                    let remaining = contentToAppend;
                                    let currentTagFormat = { open: '', close: '' };

                                    const thinkingTags = [
                                        { open: '<thinking>', close: '</thinking>' },
                                        { open: '<think>', close: '</think>' }
                                    ];

                                    while (remaining.length > 0) {
                                        if (isInsideThinkingTag) {
                                            // Look for closing thinking tag
                                            const closeIdx = remaining.indexOf(currentTagFormat.close);
                                            if (closeIdx !== -1) {
                                                // Found closing tag - extract thinking content
                                                thinkingBuffer += remaining.substring(0, closeIdx);
                                                remaining = remaining.substring(closeIdx + currentTagFormat.close.length);
                                                isInsideThinkingTag = false;
                                                currentTagFormat = { open: '', close: '' };
                                            } else {
                                                // No closing tag - everything is thinking
                                                thinkingBuffer += remaining;
                                                remaining = '';
                                            }
                                        } else {
                                            // Look for opening thinking tag (check both formats)
                                            let openIdx = -1;
                                            let foundTag = null;

                                            for (const tag of thinkingTags) {
                                                const idx = remaining.indexOf(tag.open);
                                                if (idx !== -1 && (openIdx === -1 || idx < openIdx)) {
                                                    openIdx = idx;
                                                    foundTag = tag;
                                                }
                                            }

                                            if (openIdx !== -1 && foundTag) {
                                                // Found opening tag - add content before it to answer
                                                answerBuffer += remaining.substring(0, openIdx);
                                                remaining = remaining.substring(openIdx + foundTag.open.length);
                                                currentTagFormat = foundTag;
                                                isInsideThinkingTag = true;
                                            } else {
                                                // No opening tag - everything is answer
                                                answerBuffer += remaining;
                                                remaining = '';
                                            }
                                        }
                                    }

                                    // Schedule UI update (batched per animation frame — no tokens dropped)
                                    if (pendingRafId === null) {
                                        pendingRafId = requestAnimationFrame(() => {
                                            pendingRafId = null;
                                            setMessages(prev => {
                                                const newMessages = [...prev];
                                                const lastIdx = newMessages.length - 1;
                                                const lastMessage = newMessages[lastIdx];
                                                if (lastMessage && lastMessage.role === 'assistant') {
                                                    newMessages[lastIdx] = {
                                                        ...lastMessage,
                                                        content: answerBuffer.trim(),
                                                        reasoning: assistantReasoningContent || thinkingBuffer,
                                                        isThinking: isInsideThinkingTag
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

                // CRITICAL: Flush any remaining buffered data (fixes incomplete final chunk issue)
                if (buffer.trim()) {
                    console.log('[Stream] Processing remaining buffer:', buffer.substring(0, 100));
                    const lines = buffer.split('\n');
                    let eventType = 'data';
                    let dataStr = '';

                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            eventType = line.replace('event: ', '').trim();
                        } else if (line.startsWith('data: ')) {
                            dataStr = line.replace('data: ', '').trim();
                        }
                    }

                    // Process final buffered event
                    if (dataStr && eventType === 'data' && dataStr !== '[DONE]') {
                        try {
                            const data = JSON.parse(dataStr);
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
                                answerBuffer += contentToAppend;
                                console.log('[Stream] Added final buffered content, total length now:', answerBuffer.length);
                            }
                        } catch (e) {
                            console.warn('[Stream] Failed to parse final buffer', buffer, e);
                        }
                    }
                }

                // Cancel any pending rAF so it doesn't overwrite the final sync flush
                if (pendingRafId !== null) {
                    cancelAnimationFrame(pendingRafId);
                    pendingRafId = null;
                }

                // CRITICAL: Wait for all async operations to settle before final update
                // This ensures all decryption is complete before we save state
                await new Promise(resolve => setTimeout(resolve, 50));

                // Final update: ensure stream is fully complete
                const finalReasoningContent = assistantReasoningContent || thinkingBuffer;
                console.log('[Stream Final] About to call final setMessages:', {
                    answerLength: answerBuffer.length,
                    reasoningLength: finalReasoningContent.length,
                    sourcesCount: messageSources.length,
                    answerPreview: answerBuffer.trim().substring(0, 100),
                    reasoningPreview: finalReasoningContent.substring(0, 100)
                });

                // Create completely new message object to force React re-render without memo blocking
                setMessages(prev => {
                    console.log('[Stream Final] Inside setMessages callback, prev.length:', prev.length);
                    const newMessages = [...prev];
                    const lastIdx = newMessages.length - 1;
                    const lastMessage = newMessages[lastIdx];
                    console.log('[Stream Final] lastMessage:', lastMessage?.role, 'content.length:', lastMessage?.content?.length);
                    if (lastMessage && lastMessage.role === 'assistant') {
                        // Create a completely new object to force React to detect the change
                        newMessages[lastIdx] = {
                            id: lastMessage.id,
                            role: 'assistant',
                            content: answerBuffer.trim(),
                            reasoning: finalReasoningContent,
                            sources: messageSources.length > 0 ? messageSources : lastMessage.sources,
                            isThinking: false,
                            createdAt: lastMessage.createdAt,
                            feedback: lastMessage.feedback,
                            toolCalls: lastMessage.toolCalls,
                            versions: lastMessage.versions,
                            currentVersionIndex: lastMessage.currentVersionIndex,
                            reasoningDuration: lastMessage.reasoningDuration,
                        };
                        console.log('[Stream Final] Updated lastMessage, new content.length:', newMessages[lastIdx].content.length, 'sources:', messageSources.length);
                    }
                    return newMessages;
                });
                console.log('[Stream Final] setState completed');

                // Trigger Smart Suggestions
                // Only if the last message was assistant and not stopped
                if (!isCancelling && !abortControllerRef.current?.signal.aborted && answerBuffer.trim().length > 0) {
                    // Run in background, don't await
                    apiClient.getAISuggestions(
                        fullPayload[fullPayload.length - 1].content, // Last user message
                        answerBuffer.trim(), // Assistant response
                        // Optional: pass summary if we had one (not easily available here without state, but strict recent context is okay)
                    ).then(res => {
                        if (res.success && res.data?.suggestions) {
                            setMessages(prev => {
                                const newMessages = [...prev];
                                const lastIdx = newMessages.length - 1;
                                if (newMessages[lastIdx].role === 'assistant') {
                                    newMessages[lastIdx] = {
                                        ...newMessages[lastIdx],
                                        suggestions: res.data!.suggestions
                                    };
                                }
                                return newMessages;
                            });
                        }
                    }).catch(err => console.error("Failed to fetch suggestions", err));
                }

                // Force scroll to bottom if user was following along
                if (shouldAutoScrollRef.current) {
                    setTimeout(() => scrollToBottom('smooth'), 10);
                    setShowScrollToBottom(false);
                }

            } catch (streamError) {
                // Catch stream reading errors (abort, timeout, connection loss, etc.)
                const errName = (streamError as any)?.name;
                console.error('[Stream Error]', errName);

                if (errName !== 'AbortError') {
                    // Only throw non-abort errors; AbortError means user intentionally stopped
                    throw streamError;
                }
                // AbortError will be handled in the outer catch below
                throw streamError;
            }
        } catch (error) {
            console.error('Chat error:', error)
            // If this was an abort, we already handled stopping in handleCancel; avoid overwriting the stopped content
            const errName = (error as any)?.name;
            if (errName === 'AbortError') {
                // Do nothing - user intentionally stopped the response
            } else {
                // Try to extract requestId from thrown error (we may have thrown a JSON string)
                let display = 'Sorry, I encountered an error. Please try again.';
                try {
                    if (typeof (error as any).message === 'string') {
                        const parsed = JSON.parse((error as any).message);
                        if (parsed && parsed.requestId) {
                            display += ` Request ID: \`${parsed.requestId}\``;
                        } else if (parsed && parsed.message) {
                            display = `${parsed.message}${parsed.requestId ? ` Request ID: \`${parsed.requestId}\`` : ''}`;
                        }
                    }
                } catch (e) {
                    // ignore parse errors
                }

                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastIdx = newMessages.length - 1;
                    const lastMessage = newMessages[lastIdx];
                    if (lastMessage && lastMessage.role === 'assistant') {
                        newMessages[lastIdx] = {
                            ...lastMessage,
                            content: display,
                            isThinking: false
                        };
                    }
                    return newMessages;
                })
            }
        } finally {
            setIsLoading(false);
            setIsCancelling(false);
            abortControllerRef.current = null;
            // If we just finished a new chat response, we might want to ensure the sidebar title is updated (since backend updates title after first msg)
            if (!conversationId) {
                setTimeout(() => loadChats(), 2000);
            }
            // Don't force shouldAutoScroll to false - let the current scroll position determine it
            // This allows auto-scroll to remain enabled if user stayed at bottom during streaming
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

    const handleRegenerate = async (messageId: string, instruction?: string) => {
        const messageIndex = messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) return;

        // Special case: Continue the previous response
        if (instruction === 'continue') {
            const lastMessage = messages[messageIndex];
            if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content) {
                // Removed "Stopped by user" marker will be done naturally by the API
                // Send appropriate continuation message
                setTimeout(() => {
                    handleSubmit('Please continue the previous answer from where it left off. Do not repeat what was already said.', []);
                }, 0);
                return;
            }
        }

        // 1. Prepare Versioning
        setMessages(prev => {
            const newMessages = prev.map((m, idx) => {
                if (idx !== messageIndex) return m;

                const msg = { ...m };
                // Initialize versions if needed
                if (!msg.versions) {
                    msg.versions = [{
                        id: msg.id || 'initial',
                        content: msg.content,
                        toolCalls: msg.toolCalls,
                        createdAt: Date.now(),
                        feedback: msg.feedback
                    }];
                    msg.currentVersionIndex = 0;
                } else {
                    // Update current version with latest state
                    const currentIdx = msg.currentVersionIndex || 0;
                    if (msg.versions[currentIdx]) {
                        msg.versions[currentIdx] = {
                            ...msg.versions[currentIdx],
                            content: msg.content,
                            toolCalls: msg.toolCalls,
                            feedback: msg.feedback
                        };
                    }
                }

                // Create new version slot
                const newVersionIndex = msg.versions.length;
                msg.versions.push({
                    id: `pending-${Date.now()}`,
                    content: "",
                    createdAt: Date.now()
                });
                msg.currentVersionIndex = newVersionIndex;

                // Reset main display
                msg.content = "";
                msg.toolCalls = [];
                msg.isThinking = true;
                msg.feedback = undefined;

                return msg;
            });
            return newMessages;
        });

        const historyPayload = messages.slice(0, messageIndex).map(m => ({
            role: m.role,
            content: m.content
        }));

        if (instruction) {
            historyPayload.push({
                role: 'user',
                content: instruction
            });
        }

        setIsLoading(true);
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const response = await apiClient.chatAI(
                historyPayload,
                conversationId || lastCreatedConversationId.current || "",
                model,
                kyberPublicKey || undefined,
                undefined,
                isWebSearchEnabled,
                false,
                controller.signal
            );

            if (!response.ok) throw new Error('Failed to regenerate');
            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessageContent = "";
            let currentSessionKey: Uint8Array | undefined;
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                const events = buffer.split('\n\n');
                buffer = events.pop() || "";

                for (const event of events) {
                    if (!event.trim()) continue;
                    const lines = event.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.replace('data: ', '').trim();
                            if (dataStr === '[DONE]') break;

                            try {
                                const data = JSON.parse(dataStr);

                                // Decryption Handling
                                let decryptedContent = "";
                                if (data.encrypted_content && data.iv) {
                                    const { decrypted, sessionKey } = await decryptStreamChunk(
                                        data.encrypted_content,
                                        data.iv,
                                        data.encapsulated_key,
                                        currentSessionKey
                                    );
                                    decryptedContent = decrypted;
                                    currentSessionKey = sessionKey;
                                }

                                setMessages(prev => {
                                    const newMessages = [...prev];
                                    const msg = newMessages[messageIndex];
                                    if (!msg) return newMessages;

                                    if (data.tool_calls) {
                                        const currentToolCalls = msg.toolCalls || [];
                                        const newToolCalls = [...currentToolCalls];
                                        for (const tc of data.tool_calls) {
                                            if (!newToolCalls[tc.index]) {
                                                newToolCalls[tc.index] = { id: tc.id, type: tc.type, function: { name: tc.function?.name, arguments: "" } };
                                            }
                                            if (tc.function?.arguments) {
                                                newToolCalls[tc.index].function.arguments += tc.function.arguments;
                                            }
                                        }
                                        msg.toolCalls = newToolCalls;
                                        msg.isThinking = false;
                                        if (msg.versions && typeof msg.currentVersionIndex === 'number') {
                                            if (msg.versions[msg.currentVersionIndex]) {
                                                msg.versions[msg.currentVersionIndex].toolCalls = newToolCalls;
                                            }
                                        }
                                    }

                                    const contentToAdd = decryptedContent || data.content || "";
                                    if (contentToAdd) {
                                        assistantMessageContent += contentToAdd;
                                        msg.content = assistantMessageContent;
                                        msg.isThinking = false;
                                        if (msg.versions && typeof msg.currentVersionIndex === 'number') {
                                            if (msg.versions[msg.currentVersionIndex]) {
                                                msg.versions[msg.currentVersionIndex].content = assistantMessageContent;
                                            }
                                        }
                                    }

                                    if (data.id) {
                                        msg.id = data.id;
                                        if (msg.versions && typeof msg.currentVersionIndex === 'number') {
                                            if (msg.versions[msg.currentVersionIndex]) {
                                                msg.versions[msg.currentVersionIndex].id = data.id;
                                            }
                                        }
                                    }

                                    return newMessages;
                                });

                            } catch (e) { console.error(e); }
                        }
                    }
                }
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to regenerate");
            setMessages(prev => {
                const newMessages = [...prev];
                if (newMessages[messageIndex]) newMessages[messageIndex].isThinking = false;
                return newMessages;
            });
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
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
        const controller = abortControllerRef.current;
        if (controller) {
            // Mark we're cancelling; do NOT set isLoading false here so UI indicates stopping
            setIsCancelling(true);
            try {
                controller.abort();
            } catch (e) {
                console.error('Abort failed', e);
            }

            // Update UI to reflect immediate stop intent (partial content preserved)
            setMessages(prev => {
                const newMessages = [...prev];
                const lastIdx = newMessages.length - 1;
                const lastMessage = newMessages[lastIdx];
                if (lastMessage && lastMessage.role === 'assistant') {
                    const newContent = lastMessage.content && !/Stopped by user/i.test(lastMessage.content)
                        ? lastMessage.content + "\n\n*Stopped by user.*"
                        : lastMessage.content;
                    newMessages[lastIdx] = {
                        ...lastMessage,
                        isThinking: false,
                        content: newContent
                    };
                }
                return newMessages;
            });
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

    const handleAddCheckpoint = async () => {
        if (!conversationId) {
            toast.error("Cannot add checkpoint to a new chat. Please send a message first.");
            return;
        }

        try {
            const data = await apiClient.createCheckpoint(conversationId);
            setMessages(prev => [
                ...prev,
                {
                    id: data.checkpointId,
                    role: 'system',
                    content: 'Checkpoint',
                    isCheckpoint: true,
                    createdAt: new Date(data.timestamp).getTime()
                }
            ]);
            toast.success("Checkpoint added");
        } catch (error) {
            console.error("Failed to add checkpoint", error);
            toast.error("Failed to save checkpoint");
        }
    };

    const handleRestoreCheckpoint = async (checkpointId: string) => {
        if (!conversationId) return;

        try {
            const result = await apiClient.restoreCheckpoint(conversationId, checkpointId);
            if (result.success) {
                setMessages(prev => {
                    const index = prev.findIndex(m => m.id === checkpointId);
                    if (index === -1) return prev;
                    return prev.slice(0, index + 1);
                });
                toast.success("Restored to checkpoint");
            }
        } catch (error) {
            console.error("Failed to restore checkpoint", error);
            toast.error("Failed to restore checkpoint");
        }
    };


    return (
        <div className="flex flex-col h-full bg-background relative overflow-x-hidden">


            {/* Header */}
            <SiteHeader className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm" />

            {/* Main Content Area */}
            <div className="flex-1 relative flex flex-col overflow-hidden">

                {messages.length === 0 ? (
                    // ZERO STATE: Centered Input
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                        <div className="w-full max-w-4xl mx-auto px-4 space-y-8 animate-in fade-in zoom-in-95 duration-500 slide-in-from-bottom-4">

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

                            {/* Center Input Area */}
                            <div className="w-full max-w-5xl mx-auto px-4 z-20 mx-auto">
                                <EnhancedPromptInput
                                    onSubmit={async (text, files, thinkingMode, searchMode) => {
                                        await handleSubmit(text, files, thinkingMode, searchMode);
                                    }}
                                    model={model}
                                    onModelChange={setModel}
                                    isLoading={!isReady}
                                />
                            </div>

                            {/* Suggestions */}
                            <div className="pt-2">
                                <Suggestions variant="row" label={undefined}>
                                    {suggestions.map((s, i) => (
                                        <Suggestion
                                            key={i}
                                            suggestion={s}
                                            variant="chip"
                                            onClick={handleSuggestionClick}
                                        />
                                    ))}
                                </Suggestions>
                            </div>
                        </div>
                    </div>
                ) : (

                    // CHAT STATE: Scrollable Messages + Sticky Bottom Input
                    <div className="flex flex-col h-full w-full">
                        {/* Messages Container - Virtual List for Performance */}
                        <div
                            ref={scrollContainerRef}
                            className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth min-h-0 max-w-full overflow-x-hidden"
                        >
                            {/* Standard List Rendering */}
                            <div className="flex flex-col items-center w-full min-h-full">
                                {/* Loading skeleton when initial messages are fetching */}
                                {isLoading && messages.length === 0 ? (
                                    <div className="w-full max-w-4xl mx-auto py-8 space-y-4 break-words">
                                        <div className="text-center">
                                            <IconLoader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                            <p className="text-sm text-muted-foreground">Loading chat…</p>
                                        </div>

                                        {/* Sample skeleton message blocks */}
                                        {[...Array(6)].map((_, i) => (
                                            <div key={i} className={`p-4 rounded-xl bg-muted/10 border border-border/50 ${i % 2 === 0 ? 'self-start' : 'self-end'} w-full`}>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <Skeleton className="h-4 w-24" />
                                                    <Skeleton className="h-3 w-14" />
                                                </div>
                                                <Skeleton className="h-4 w-5/6 mb-2" />
                                                <Skeleton className="h-4 w-2/3" />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    messages.map((message, index) => (
                                        <div
                                            key={message.id || index}
                                            id={`message-${message.id}`}
                                            className="w-full flex justify-center mb-4 animate-in fade-in duration-300"
                                        >
                                            <div className="w-full max-w-3xl">
                                                {message.isCheckpoint ? (
                                                    <Checkpoint className="my-4">
                                                        <CheckpointIcon>
                                                            <IconBookmark className="size-4 shrink-0" />
                                                        </CheckpointIcon>
                                                        <span className="text-xs font-medium">Checkpoint {index + 1}</span>
                                                        <CheckpointTrigger
                                                            tooltip="Restore checkpoint"
                                                            onClick={() => handleRestoreCheckpoint(message.id || '')}
                                                        >
                                                            <IconRotateClockwise className="size-3" />
                                                        </CheckpointTrigger>
                                                    </Checkpoint>
                                                ) : (
                                                    <ChatMessage
                                                        message={message}
                                                        isLast={index === messages.length - 1}
                                                        onCopy={handleCopy}
                                                        onFeedback={handleFeedback}
                                                        onRetry={() => handleRetry(message.id || '')}
                                                        onRegenerate={(instruction) => handleRegenerate(message.id || '', instruction)}
                                                        onEdit={(content) => handleEditMessage(message.id || '', content)}
                                                        onVersionChange={(dir) => handleVersionChange(message.id || '', dir)}
                                                        onCheckpoint={() => handleAddCheckpoint()}
                                                        availableModels={availableModels}
                                                        onRerunSystemWithModel={handleRerunSystemWithModel}
                                                        onAddToChat={(text) => {
                                                            setContextItems(prev => [...prev, {
                                                                id: crypto.randomUUID(),
                                                                type: 'text',
                                                                content: text
                                                            }]);
                                                            toast.success("Added to context");
                                                            const inputRef = document.querySelector('textarea[placeholder*="How can I help"]') as HTMLTextAreaElement;
                                                            if (inputRef) inputRef.focus();
                                                        }}
                                                        onSuggestionClick={(text) => handleSubmit(text)}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                                {/* Scroll Anchor */}
                                <div ref={scrollEndRef} className="h-1 w-full" />
                            </div>
                        </div>

                        {/* Floating "Scroll to Bottom" Button - Shows when user scrolls up */}
                        {showScrollToBottom && (
                            <div className="absolute bottom-24 right-4 z-30">
                                <button
                                    onClick={() => {
                                        shouldAutoScrollRef.current = true;
                                        scrollToBottom('smooth');
                                        setShowScrollToBottom(false);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl hover:bg-primary/90 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
                                    title="Auto-scroll is paused. Click to resume."
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                    </svg>
                                    <span className="text-sm font-medium">Latest</span>
                                </button>
                            </div>
                        )}

                        {/* Sticky Input Footer - Centered with consistent max-width */}
                        <div className="sticky bottom-0 z-40 w-full bg-background/95 backdrop-blur-sm pb-4 pt-0">
                            <div className="flex justify-center w-full">
                                <div className="max-w-4xl w-full px-4">
                                    <EnhancedPromptInput
                                        onSubmit={async (text, files, thinkingMode, searchMode) => {
                                            await handleSubmit(text, files, thinkingMode, searchMode);
                                        }}
                                        isLoading={isLoading || isCancelling || !isReady}
                                        onStop={handleCancel}
                                        model={model}
                                        onModelChange={setModel}
                                        contextItems={contextItems}
                                        onRemoveContextItem={(id) => setContextItems(prev => prev.filter(i => i.id !== id))}
                                    />
                                    {/* Disclaimer Text */}
                                    <p className="text-xs text-center text-muted-foreground mt-2 select-none" aria-hidden="false">
                                        AI may display inaccurate or offensive information.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <ChatScrollNavigation messages={messages} />
            </div>
        </div >
    );
}
