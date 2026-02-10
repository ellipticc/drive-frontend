"use client"

import * as React from "react"
import { useUser } from "@/components/user-context"
import { IconSparkles, IconBookmark, IconRotateClockwise } from "@tabler/icons-react"
import { Checkpoint, CheckpointIcon, CheckpointTrigger } from "@/components/ai-elements/checkpoint"
import apiClient from "@/lib/api"

// Import AI Elements
import { EnhancedPromptInput } from "@/components/enhanced-prompt-input"
import { SiteHeader } from "@/components/layout/header/site-header"
import { useAICrypto } from "@/hooks/use-ai-crypto";
import { parseFile } from "@/lib/file-parser";
import { useRouter, useSearchParams } from "next/navigation"
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion"
import { ChatMessage } from "@/components/ai-elements/chat-message"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

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
    toolCalls?: any[]; // using any for simplicity or import ToolCall
    versions?: MessageVersion[];
    currentVersionIndex?: number;
    isCheckpoint?: boolean;
    reasoning?: string;
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

    const { isReady, kyberPublicKey, decryptHistory, decryptStreamChunk, encryptMessage, loadChats } = useAICrypto();

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
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    // Helper: Scroll to a specific message by index or ID
    const scrollToMessage = (messageId: string, behavior: ScrollBehavior = 'smooth') => {
        const container = scrollContainerRef.current;
        if (!container) return;

        // Find element by ID
        const element = document.getElementById(`message-${messageId}`);
        if (element) {
            // Calculate offset (sticky header height ~60px + padding 24px)
            const offset = 84;
            const top = element.offsetTop - offset;

            // Allow manual scroll intervention check if needed, but for now just scroll
            container.scrollTo({ top, behavior });
        }
    };

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
            const title = conversationId ? `Chat | Ellipticc` : 'New Chat | Ellipticc';
            document.title = title;
            setChatTitle(conversationId ? 'Chat' : 'New Chat');
        }
    }, [conversationId]);

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
        }
    }, [conversationId, isReady, decryptHistory, router]);

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

    const handleSubmit = async (value: string, attachments: File[] = [], thinkingMode: boolean = false, searchMode: boolean = false) => {
        if (!value.trim() && attachments.length === 0) return;

        if (!isReady || !kyberPublicKey) {
            console.warn("Crypto not ready:", { isReady, hasKey: !!kyberPublicKey });
            toast.error("Initializing secure session, please wait...");
            return;
        }

        if (isLoading) return;

        // 1. Optimistic Update (Show user message immediately)
        // Generate a temporary ID for the user message to allow scrolling
        const tempId = crypto.randomUUID();
        const tempUserMessage: Message = {
            id: tempId,
            role: 'user',
            content: value,
            // attachments: attachments.map(f => f.name) // Store names for UI if needed (schema update required)
        };
        setMessages(prev => [...prev, tempUserMessage]);

        // Scroll to this new message immediately
        setTimeout(() => scrollToMessage(tempId, 'smooth'), 10);

        // 2. Add Thinking State
        setMessages(prev => [...prev, { role: 'assistant', content: '', isThinking: true, reasoning: '' }]);
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
            let isInsideThinkingTag = false;
            let currentSessionKey: Uint8Array | undefined;
            let buffer = ""; // Buffer for incomplete SSE events
            let lastUpdateTime = 0;
            const UPDATE_INTERVAL = 0; // No throttling for real-time streaming

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
                            if (data.reasoning) {
                                assistantReasoningContent += data.reasoning;

                                // Update message with reasoning
                                const now = Date.now();
                                if (now - lastUpdateTime > UPDATE_INTERVAL) {
                                    setMessages(prev => {
                                        const newMessages = [...prev]
                                        const lastMessage = newMessages[newMessages.length - 1]
                                        if (lastMessage && lastMessage.role === 'assistant') {
                                            lastMessage.reasoning = assistantReasoningContent;
                                            lastMessage.isThinking = true;
                                        }
                                        return newMessages
                                    });
                                    lastUpdateTime = now;
                                }
                            }
                        } catch (e) {
                            console.warn('Failed to parse reasoning event', dataStr, e);
                        }
                        continue;
                    }

                    // Handle regular content events
                    if (dataStr === '[DONE]') break;

                    if (dataStr) {
                        try {
                            const data = JSON.parse(dataStr);

                            // Handle Server-side error
                            if (data.message) {
                                setMessages(prev => {
                                    const newMessages = [...prev]
                                    const lastMessage = newMessages[newMessages.length - 1]
                                    if (lastMessage && lastMessage.role === 'assistant') {
                                        lastMessage.content = data.message
                                        lastMessage.isThinking = false
                                    } else {
                                        newMessages.push({ role: 'assistant', content: data.message, isThinking: false })
                                    }
                                    return newMessages
                                })

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

                                // Use backend reasoning if available, otherwise use extracted thinking
                                const finalReasoningContent = assistantReasoningContent || thinkingBuffer;

                                // Throttle state updates
                                const now = Date.now();
                                if (now - lastUpdateTime > UPDATE_INTERVAL) {
                                    setMessages(prev => {
                                        const newMessages = [...prev]
                                        const lastMessage = newMessages[newMessages.length - 1]
                                        if (lastMessage && lastMessage.role === 'assistant') {
                                            lastMessage.content = answerBuffer.trim();
                                            lastMessage.reasoning = finalReasoningContent;
                                            lastMessage.isThinking = isInsideThinkingTag;
                                            if (data.id) lastMessage.id = data.id;
                                        }
                                        return newMessages
                                    });
                                    lastUpdateTime = now;
                                }
                            }
                        } catch (e) {
                            console.warn('Failed to parse SSE data', dataStr, e);
                        }
                    }
                }
            }

            // Final update: ensure stream is fully complete
            const finalReasoningContent = assistantReasoningContent || thinkingBuffer;
            setMessages(prev => {
                const newMessages = [...prev]
                const lastMessage = newMessages[newMessages.length - 1]
                if (lastMessage && lastMessage.role === 'assistant') {
                    lastMessage.content = answerBuffer.trim();
                    lastMessage.reasoning = finalReasoningContent;
                    lastMessage.isThinking = false;
                }
                return newMessages
            });


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
                    const newMessages = [...prev]
                    const lastMessage = newMessages[newMessages.length - 1]
                    if (lastMessage && lastMessage.role === 'assistant') {
                        lastMessage.content = display
                        lastMessage.isThinking = false
                    }
                    return newMessages
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
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage && lastMessage.role === 'assistant') {
                    lastMessage.isThinking = false;
                    if (lastMessage.content && !/Stopped by user/i.test(lastMessage.content)) {
                        lastMessage.content = lastMessage.content + "\n\n*Stopped by user.*";
                    }
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
        <div className="flex flex-col h-full bg-background relative">
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
                        {/* Messages Container - Centered with consistent max-width */}
                        <div
                            ref={scrollContainerRef}
                            className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth"
                        >
                            {/* Centered wrapper for messages */}
                            <div className="flex flex-col items-center w-full">
                            {messages.map((message, index) => (
                                <div
                                    key={message.id || index}
                                    id={`message-${message.id}`}
                                    className="w-full max-w-3xl"
                                >
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
                                                // Add selected text to input with context marker
                                                const inputRef = document.querySelector('textarea[placeholder*="Ask"]') as HTMLTextAreaElement;
                                                if (inputRef) {
                                                    const newText = (inputRef.value ? inputRef.value + '\n\n' : '') + `> ${text}`;
                                                    inputRef.value = newText;
                                                    inputRef.style.height = "auto";
                                                    inputRef.style.height = Math.min(inputRef.scrollHeight, 384) + "px";
                                                    inputRef.focus();
                                                }
                                            }}
                                        />
                                    )}
                                </div>
                            ))}
                            </div>
                            <div className="h-24" />
                        </div>

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
                                    />
                                    {/* Disclaimer Text */}
                                    <p className="text-xs text-center text-muted-foreground mt-2">
                                        AI may display inaccurate or offensive information.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}
