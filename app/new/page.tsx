"use client"

import * as React from "react"
import { useUser } from "@/components/user-context"
import { IconPlus, IconChevronLeft, IconMessage, IconSettings, IconFolder, IconSearch, IconChevronRight, IconMenu, IconX, IconEdit, IconTrash, IconChevronDown, IconPin, IconPinFilled, IconDownload, IconPencil, IconArrowDown, IconRotateClockwise, IconBookmark, IconCaretLeftRightFilled } from "@tabler/icons-react";
import { Checkpoint, CheckpointIcon, CheckpointTrigger } from "@/components/ai-elements/checkpoint"
import apiClient from "@/lib/api"

import { Skeleton } from "@/components/ui/skeleton"
import { IconLoader2 } from "@tabler/icons-react"
// Import AI Elements
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Import AI Elements
import { EnhancedPromptInput } from "@/components/enhanced-prompt-input"
import { SiteHeader } from "@/components/layout/header/site-header"
import { useAICrypto } from "@/hooks/use-ai-crypto";
import { parseFile } from "@/lib/file-parser";
import { calculateContextBreakdown, ContextBreakdown, trimHistoryByTokens } from "@/lib/context-calculator"
import { useRouter, useSearchParams } from "next/navigation"
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion"
import { FeedbackModal } from "@/components/ai-elements/feedback-modal";
import { ChatMessage } from "@/components/ai-elements/chat-message"
import { ChatScrollNavigation } from "@/components/ai-elements/chat-navigation"
import { toast } from "sonner"

// helper to prettify model names (capitalize segments)
function formatModelName(name: string | null | undefined) {
    if (!name) return '';
    return name.split('-').map(seg => {
        let seen = false;
        return seg.split('').map(ch => {
            if (/[a-zA-Z]/.test(ch)) {
                if (!seen) { seen = true; return ch.toUpperCase(); }
                return ch.toLowerCase();
            }
            return ch;
        }).join('');
    }).join('-');
}

interface MessageVersion {
    id: string;
    content: string;
    toolCalls?: any[];
    createdAt?: number;
    feedback?: 'like' | 'dislike';
    suggestions?: string[];
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
    ttft?: number;
    tps?: number;
    total_time?: number;
    model?: string;
}


export default function AssistantPage() {
    const { user } = useUser()
    const router = useRouter()
    const searchParams = useSearchParams()

    const [messages, setMessages] = React.useState<Message[]>([])
    const [isInitialLoading, setIsInitialLoading] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(false)
    const [isContentReady, setIsContentReady] = React.useState(false)
    const [isCancelling, setIsCancelling] = React.useState(false);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = React.useState(false);
    const [feedbackMessageId, setFeedbackMessageId] = React.useState<string>("");
    const [feedbackRating, setFeedbackRating] = React.useState<"like" | "dislike" | null>(null);
    const [feedbackPromptContext, setFeedbackPromptContext] = React.useState<string>("");
    const [feedbackResponseContext, setFeedbackResponseContext] = React.useState<string>("");
    const abortControllerRef = React.useRef<AbortController | null>(null)
    const [model, setModel] = React.useState("auto")
    const [isWebSearchEnabled, setIsWebSearchEnabled] = React.useState(false);
    const [chatTitle, setChatTitle] = React.useState<string>('Chat');
    const lastScrollTopRef = React.useRef(0)
    const [isLoadingOlder, setIsLoadingOlder] = React.useState(false)
    const [pagination, setPagination] = React.useState({ offset: 0, limit: 50, total: 0, hasMore: false })
    const isLoadingOlderRef = React.useRef(false)
    const hasScrolledRef = React.useRef(false);
    const shouldAutoScrollRef = React.useRef(true);
    const [isMobile, setIsMobile] = React.useState(false);
    const scrollToMessageIdRef = React.useRef<string | null>(null);

    // Detect mobile on mount
    React.useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.matchMedia('(max-width: 768px)').matches);
        };
        checkMobile();
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        mediaQuery.addEventListener('change', checkMobile);
        return () => mediaQuery.removeEventListener('change', checkMobile);
    }, []);

    // Watch for scroll-to target message and scroll when it appears in DOM
    React.useEffect(() => {
        if (scrollToMessageIdRef.current) {
            const messageId = scrollToMessageIdRef.current;
            const attemptScroll = () => {
                const element = document.getElementById(`message-${messageId}`);
                if (element && scrollContainerRef.current) {
                    // Use scrollContainer as scroll boundary
                    const elementRect = element.getBoundingClientRect();
                    const containerRect = scrollContainerRef.current.getBoundingClientRect();

                    // Only scroll if element is not visible at top
                    if (elementRect.top > containerRect.top + 100) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    scrollToMessageIdRef.current = null;
                } else if (!element) {
                    // Element not in DOM yet, retry after a short delay
                    setTimeout(attemptScroll, 50);
                }
            };
            attemptScroll();
        }
    }, [messages]);

    const { isReady, kyberPublicKey, decryptHistory, decryptStreamChunk, encryptMessage, encryptWithSessionKey, loadChats, updateChatTimestamp, chats, renameChat, pinChat, deleteChat } = useAICrypto();

    // Available models for system rerun popovers
    const availableModels = [
        { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B" },
        { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B" },
        { id: "qwen/qwen3-32b", name: "Qwen 3 32B" },
        { id: "moonshotai/kimi-k2-instruct-0905", name: "Kimi K2" },
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

    // Context breakdown for displaying token usage
    const [contextBreakdown, setContextBreakdown] = React.useState<ContextBreakdown | null>(null);

    // Scroll Container Ref
    const scrollContainerRef = React.useRef<HTMLDivElement>(null)
    const virtualParentRef = React.useRef<HTMLDivElement>(null)

    // Standard scrolling state
    const [isAtBottom, setIsAtBottom] = React.useState(true);
    const scrollEndRef = React.useRef<HTMLDivElement>(null);
    const [showScrollToBottom, setShowScrollToBottom] = React.useState(false);

    const handleScroll = () => {
        if (!scrollContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowScrollToBottom(!isNearBottom);
        setIsAtBottom(isNearBottom);
    };

    // Track metrics during streaming so they persist in final message
    const currentMetricsRef = React.useRef<{
        ttft?: number;
        tps?: number;
        total_time?: number;
    }>({});

    // Chat Title State
    const [isEditingTitle, setIsEditingTitle] = React.useState(false);
    const [isRenameDialogOpen, setIsRenameDialogOpen] = React.useState(false);
    const [tempTitle, setTempTitle] = React.useState("");
    const [isStarred, setIsStarred] = React.useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

    // Track active session key for cancel action
    const latestSessionKeyRef = React.useRef<Uint8Array | null>(null);

    // Typing effect state
    const [displayedTitle, setDisplayedTitle] = React.useState("");
    const [isTypingTitle, setIsTypingTitle] = React.useState(false);

    // Fetch Chat Title/Status from already-loaded chats (avoids redundant API call)
    React.useEffect(() => {
        if (!conversationId) {
            setChatTitle("New Chat");
            setDisplayedTitle("New Chat");
            return;
        }

        // Use the chats array from useAICrypto() which is already loaded
        const currentChat = chats.find((c) => c.id === conversationId);
        if (currentChat) {
            const newTitle = currentChat.title || "New Chat";
            setChatTitle(newTitle);
            setIsStarred(!!currentChat.pinned);

            // Typing effect for title
            setIsTypingTitle(true);
            let i = 0;
            setDisplayedTitle("");
            const interval = setInterval(() => {
                setDisplayedTitle(newTitle.substring(0, i + 1));
                i++;
                if (i >= newTitle.length) {
                    clearInterval(interval);
                    setIsTypingTitle(false);
                }
            }, 30);
            return () => clearInterval(interval);
        }
    }, [conversationId, chats]);

    const scrollToMessage = (messageId: string, behavior: ScrollBehavior = 'smooth') => {
        const element = document.getElementById(`message-${messageId}`);
        if (element) {
            element.scrollIntoView({ behavior, block: 'start' });
        }
    };

    // Robust scroll-to-bottom
    const scrollToBottom = React.useCallback((behavior: ScrollBehavior = 'smooth') => {
        scrollEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    }, []);

    // Auto-scroll to bottom when messages update (if authorized by ref)
    // On mobile, disable auto-scroll during streaming to prevent scroll fighting
    React.useEffect(() => {
        // Only auto-scroll if: (1) allowed by ref, (2) loading, (3) not on mobile
        if (shouldAutoScrollRef.current && isLoading && !isMobile) {
            scrollToBottom('auto');
        }
    }, [messages, isLoading, isMobile, scrollToBottom]);

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
            let chatTitleToSet: string | null = null;

            if (conversationId) {
                const currentChat = chats.find(chat => chat.id === conversationId);
                if (currentChat) {
                    title = `${currentChat.title} | Ellipticc`;
                    chatTitleToSet = currentChat.title;
                }
                // Don't default to 'Chat' - let the API fetch handle it
            } else {
                title = 'New Chat | Ellipticc';
                chatTitleToSet = 'New Chat';
            }

            document.title = title;

            // Only update chatTitle if we have a new value from chats array
            // Otherwise keep what was set by the API fetch
            document.title = title;
            setChatTitle(chatTitleToSet || 'New Chat'); // Ensure chatTitle is always set

            // Force update displayed title if we found a valid chat title that differs
            if (chatTitleToSet && chatTitleToSet !== 'Chat' && chatTitleToSet !== 'New Chat' && displayedTitle !== chatTitleToSet) {
                setDisplayedTitle(chatTitleToSet);
            } else if (!displayedTitle || displayedTitle === "") {
                setDisplayedTitle(chatTitleToSet || 'New Chat');
            }
        }
    }, [conversationId, chats, displayedTitle]);

    // Load History when conversationId changes
    React.useEffect(() => {
        if (!isReady) return;

        // If this is the conversation we just created, don't clear messages!
        if (conversationId && conversationId === lastCreatedConversationId.current) {
            return;
        }

        if (conversationId) {
            setIsInitialLoading(true);
            setMessages([]); // Clear previous messages while loading
            decryptHistory(conversationId)
                .then((msgs: Message[]) => {
                    setMessages(msgs);
                    // Don't reset title to 'Chat' here, let the useEffect handle it or keep current
                    // setChatTitle('Chat');

                    setPagination({
                        offset: 0,
                        limit: 50,
                        total: msgs.length,
                        hasMore: msgs.length >= 50
                    });

                    // Scroll to last user message after render
                    setTimeout(() => {
                        const lastUserMessage = msgs.slice().reverse().find(m => m.role === 'user');
                        if (lastUserMessage && lastUserMessage.id) {
                            scrollToMessage(lastUserMessage.id, 'instant');
                            hasScrolledRef.current = true;
                        }
                    }, 500);
                })
                .catch((err: Error) => {
                    console.error("History load error:", err);
                    router.push('/new');
                })
                .finally(() => setIsInitialLoading(false));
        } else {
            // New Chat
            setChatTitle('New Chat');
            setMessages([]);
            setPagination({ offset: 0, limit: 50, total: 0, hasMore: false });
        }
    }, [conversationId, isReady, decryptHistory, router]);

    const [contextItems, setContextItems] = React.useState<Array<{ id: string; type: 'text' | 'code'; content: string }>>([]);

    // Calculate context breakdown whenever messages or model changes
    React.useEffect(() => {
        if (messages.length > 0 && conversationId) {
            const breakdown = calculateContextBreakdown(
                messages,
                model,
                // Standard system prompt estimation
                undefined,
                // Tool definitions (if applicable)
                undefined
            );
            setContextBreakdown(breakdown);
        } else {
            setContextBreakdown(null);
        }
    }, [messages, model, conversationId]);

    // Track content readiness - production-grade rendering detection
    React.useEffect(() => {
        if (!isInitialLoading && messages.length > 0) {
            // Use MutationObserver and ResizeObserver to detect actual rendering completion
            const messagesContainer = scrollContainerRef.current;
            if (!messagesContainer) {
                setIsContentReady(true);
                return;
            }

            let renderStabilityTimer: NodeJS.Timeout | null = null;
            let lastMutationTime = Date.now();
            const STABILITY_THRESHOLD = 100; // Wait 100ms without mutations to consider rendering complete

            const clearStabilityTimer = () => {
                if (renderStabilityTimer) {
                    clearTimeout(renderStabilityTimer);
                    renderStabilityTimer = null;
                }
            };

            const scheduleStabilityCheck = () => {
                clearStabilityTimer();
                lastMutationTime = Date.now();

                renderStabilityTimer = setTimeout(() => {
                    // Verify all message elements exist and have content
                    const messageElements = messagesContainer.querySelectorAll('[id^="message-"]');
                    if (messageElements.length === messages.length) {
                        setIsContentReady(true);
                        observer.disconnect();
                        resizeObserver.disconnect();
                    }
                }, STABILITY_THRESHOLD);
            };

            // MutationObserver to detect DOM changes
            const observer = new MutationObserver(() => {
                scheduleStabilityCheck();
            });

            // ResizeObserver to detect layout changes
            const resizeObserver = new ResizeObserver(() => {
                scheduleStabilityCheck();
            });

            // Start observing
            observer.observe(messagesContainer, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true,
                attributeFilter: ['class', 'style', 'data-state'],
            });

            resizeObserver.observe(messagesContainer);

            // Initial stability check after a short delay to let React render
            scheduleStabilityCheck();

            // Cleanup
            return () => {
                clearStabilityTimer();
                observer.disconnect();
                resizeObserver.disconnect();
            };
        } else if (!isInitialLoading && messages.length === 0 && !conversationId) {
            // New chat is ready immediately
            setIsContentReady(true);
        } else {
            setIsContentReady(false);
        }
    }, [isInitialLoading, messages.length, conversationId]);

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
        // Generate a temporary ID for the user message
        const tempId = crypto.randomUUID();
        const optimisticUserMessage: Message = {
            id: tempId,
            role: 'user',
            content: finalContent,
            createdAt: Date.now(),
        };

        setMessages(prev => [...prev, optimisticUserMessage]);
        // optimistic chat timestamp for ordering
        if (conversationId) {
            updateChatTimestamp(conversationId, new Date().toISOString());
        }

        // Disable auto-scroll-to-bottom so user message stays at top of viewport
        shouldAutoScrollRef.current = false;

        // Mark this message for scrolling (will scroll when messages array updates and DOM renders)
        scrollToMessageIdRef.current = tempId;

        // Reset metrics for new stream
        currentMetricsRef.current = {};

        // Add Thinking State
        const assistantMessageId = crypto.randomUUID();
        setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: '', isThinking: true, reasoning: '', model }]);
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

            // Prepare history for context - Smart trimming (VS Code approach)
            // Token-counts messages and dynamically removes old ones when approaching 85% threshold
            // Preserves most recent messages and is model-aware
            const cleanedMessages = messages.filter(m => !m.isThinking && m.content);
            const trimmedMessages = trimHistoryByTokens(
                cleanedMessages,
                model,
                finalContent,
                undefined,
                25000 // Reserve 25k tokens for response generation
            );
            const historyPayload = trimmedMessages.map(m => ({ role: m.role, content: m.content }));

            // Add current user message
            const fullPayload = [...historyPayload, { role: 'user' as const, content: finalContent }];

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
                        newMessages.push({ role: 'assistant', content: display, isThinking: false, model });
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
                window.history.replaceState(null, '', `/new?conversationId=${newConversationId}`);
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
            let currentSuggestions: string[] = []; // Track suggestions locally to survive state batching

            try {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    // Check if abort was signaled - stop immediately
                    if (controller.signal.aborted) {
                        console.log('[Stream] Abort signal detected, stopping reader');
                        break;
                    }

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
                                    currentSessionKey = sessionKey; latestSessionKeyRef.current = sessionKey;
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
                                    currentSessionKey = sessionKey; latestSessionKeyRef.current = sessionKey;
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

                        // Handle metrics events
                        if (eventType === 'metrics' && dataStr) {
                            try {
                                const metricsData = JSON.parse(dataStr);
                                // Track in ref so they persist after stream ends
                                currentMetricsRef.current = {
                                    ttft: metricsData.ttft,
                                    tps: metricsData.tps,
                                    total_time: metricsData.total_time
                                };
                                setMessages(prev => {
                                    const newMessages = [...prev];
                                    const lastIdx = newMessages.length - 1;
                                    const lastMessage = newMessages[lastIdx];
                                    if (lastMessage && lastMessage.role === 'assistant') {
                                        newMessages[lastIdx] = {
                                            ...lastMessage,
                                            ttft: metricsData.ttft,
                                            tps: metricsData.tps,
                                            total_time: metricsData.total_time
                                        };
                                    }
                                    return newMessages;
                                });
                            } catch (e) {
                                console.warn('Failed to parse metrics event', dataStr, e);
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
                                            newMessages.push({ role: 'assistant', content: data.message, isThinking: false, model });
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
                                    currentSessionKey = sessionKey; latestSessionKeyRef.current = sessionKey;
                                } else if (data.encrypted_suggestions && data.suggestions_iv) {
                                    // Decrypt suggestions if they come encrypted
                                    const { decrypted, sessionKey } = await decryptStreamChunk(
                                        data.encrypted_suggestions,
                                        data.suggestions_iv,
                                        data.encapsulated_key,
                                        currentSessionKey
                                    );
                                    currentSessionKey = sessionKey; latestSessionKeyRef.current = sessionKey;
                                    currentSuggestions = JSON.parse(decrypted);
                                    setMessages(prev => {
                                        const newMessages = [...prev];
                                        const lastIdx = newMessages.length - 1;
                                        const lastMessage = newMessages[lastIdx];
                                        if (lastMessage && lastMessage.role === 'assistant') {
                                            newMessages[lastIdx] = {
                                                ...lastMessage,
                                                suggestions: currentSuggestions
                                            };
                                        }
                                        return newMessages;
                                    });
                                } else if (data.suggestions) {
                                    currentSuggestions = data.suggestions; // Update local tracker
                                    setMessages(prev => {
                                        const newMessages = [...prev];
                                        const lastIdx = newMessages.length - 1;
                                        const lastMessage = newMessages[lastIdx];
                                        if (lastMessage && lastMessage.role === 'assistant') {
                                            newMessages[lastIdx] = {
                                                ...lastMessage,
                                                suggestions: data.suggestions
                                            };
                                        }
                                        return newMessages;
                                    });
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
                                currentSessionKey = sessionKey; latestSessionKeyRef.current = sessionKey;
                            } else if (data.encrypted_suggestions && data.suggestions_iv) {
                                // Decrypt suggestions if they come encrypted in final buffer
                                const { decrypted, sessionKey } = await decryptStreamChunk(
                                    data.encrypted_suggestions,
                                    data.suggestions_iv,
                                    data.encapsulated_key,
                                    currentSessionKey
                                );
                                currentSessionKey = sessionKey; latestSessionKeyRef.current = sessionKey;
                                currentSuggestions = JSON.parse(decrypted);
                                console.log('[Stream] Found encrypted suggestions in final buffer');
                            } else if (data.suggestions) {
                                currentSuggestions = data.suggestions; // Update local tracker
                                console.log('[Stream] Found suggestions in final buffer');
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
                            suggestions: currentSuggestions.length > 0 ? currentSuggestions : lastMessage.suggestions,
                            // Include metrics from ref so they persist after streaming ends
                            ttft: currentMetricsRef.current.ttft,
                            tps: currentMetricsRef.current.tps,
                            total_time: currentMetricsRef.current.total_time,
                            model: model,
                        };
                        console.log('[Stream Final] Updated lastMessage, new content.length:', newMessages[lastIdx].content.length, 'sources:', messageSources.length, 'metrics:', currentMetricsRef.current);
                    }
                    return newMessages;
                });
                console.log('[Stream Final] setState completed');

                // No auto-scroll after stream completion — user controls scroll position

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
            // reconcile chats ordering/timestamps with server after every attempt
            loadChats(true);
            // If we just finished a new chat response, we might want to ensure the sidebar title is updated (since backend updates title after first msg)
            if (!conversationId) {
                setTimeout(() => loadChats(), 2000);
            }
            // Don't force shouldAutoScroll to false - let the current scroll position determine it
            // This allows auto-scroll to remain enabled if user stayed at bottom during streaming
        }
    }

    // Suggestion Chips
    // Suggestion Chips
    const suggestions: string[] = [];

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

        // Smart context trimming for regenerate (model-aware, token-based)
        const contextMessages = messages.slice(0, messageIndex);
        const cleanedContextMessages = contextMessages.filter(m => !m.isThinking && m.content);
        const trimmedContext = trimHistoryByTokens(
            cleanedContextMessages,
            model,
            instruction || "",
            undefined,
            25000
        );
        const historyPayload = trimmedContext.map(m => ({
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
                    let eventType = 'data';
                    let dataStr = '';

                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            eventType = line.replace('event: ', '').trim();
                        } else if (line.startsWith('data: ')) {
                            dataStr += line.replace('data: ', '').trim();
                        }
                    }

                    if (dataStr === '[DONE]') break;

                    if (eventType === 'metrics' && dataStr) {
                        try {
                            const data = JSON.parse(dataStr);
                            setMessages(prev => {
                                const newMessages = [...prev];
                                const msg = newMessages[messageIndex];
                                if (!msg) return newMessages;

                                msg.ttft = data.ttft;
                                msg.tps = data.tps;
                                msg.total_time = data.total_time;

                                return newMessages;
                            });
                        } catch (e) { }
                        continue;
                    }

                    if (dataStr && eventType !== 'metrics' && eventType !== 'sources' && eventType !== 'stream-complete') {
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
                                currentSessionKey = sessionKey; latestSessionKeyRef.current = sessionKey;
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

                                if (data.suggestions) {
                                    msg.suggestions = data.suggestions;
                                    if (msg.versions && typeof msg.currentVersionIndex === 'number') {
                                        if (msg.versions[msg.currentVersionIndex]) {
                                            msg.versions[msg.currentVersionIndex].suggestions = data.suggestions;
                                        }
                                    }
                                }

                                return newMessages;
                            });

                        } catch (e) { console.error(e); }
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
            // Mark we're cancelling
            setIsCancelling(true);
            try {
                controller.abort();
            } catch (e) {
                console.error('Abort failed', e);
            }

            // Update UI to reflect immediate stop intent (partial content preserved)
            const lastMessage = messages[messages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
                const newContent = lastMessage.content && !/Stopped by user/i.test(lastMessage.content)
                    ? lastMessage.content + "\n\n*Stopped by user.*"
                    : lastMessage.content;

                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastIdx = newMessages.length - 1;
                    if (newMessages[lastIdx] && newMessages[lastIdx].role === 'assistant') {
                        newMessages[lastIdx] = {
                            ...newMessages[lastIdx],
                            isThinking: false,
                            content: newContent
                        };
                    }
                    return newMessages;
                });

                console.log('[Cancel] User stopped generation, truncated content shown');

                // Send PATCH request to backend to trim the saved message
                if (lastMessage.id && latestSessionKeyRef.current && isReady) {
                    const sessionKey = latestSessionKeyRef.current;
                    const messageId = lastMessage.id;
                    const reasoning = lastMessage.reasoning || "";

                    (async () => {
                        try {
                            const updates: any = {};

                            if (newContent) {
                                const encContent = await encryptWithSessionKey(newContent, sessionKey);
                                updates.encrypted_content = encContent.encryptedContent;
                                updates.iv = encContent.iv;
                            }

                            if (reasoning) {
                                const encReasoning = await encryptWithSessionKey(reasoning, sessionKey);
                                updates.reasoning = encReasoning.encryptedContent;
                                updates.reasoning_iv = encReasoning.iv;
                            }

                            if (Object.keys(updates).length > 0) {
                                await apiClient.updateAIChatMessage(messageId, updates);
                                console.log('[Cancel] Successfully updated trimmed message on backend');
                            }
                        } catch (err) {
                            console.error('[Cancel] Failed to update trimmed message on backend', err);
                        }
                    })();
                }
            }
        }
    };

    const handleFeedback = (messageId: string, feedback: 'like' | 'dislike') => {
        // Find message and context for modal
        const msgIndex = messages.findIndex(m => m.id === messageId);
        if (msgIndex !== -1) {
            const msg = messages[msgIndex];
            const prevMsg = messages[msgIndex - 1]; // Try to get prompt context

            setFeedbackMessageId(messageId);
            setFeedbackRating(feedback);
            setFeedbackResponseContext(msg.content);
            setFeedbackPromptContext(prevMsg?.role === 'user' ? prevMsg.content : "Context unavailable");
            setIsFeedbackModalOpen(true);
        }
    };

    const submitFeedback = async (messageId: string, rating: 'like' | 'dislike', reasons: string[], details: string, context: any) => {
        try {
            // Optimistic Update
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

    const handleRenameChat = async () => {
        if (!conversationId || !tempTitle.trim()) return;
        if (tempTitle === chatTitle) {
            setIsEditingTitle(false);
            return;
        }

        // Store previous title for rollback
        const previousTitle = chatTitle;
        const previousDisplayedTitle = displayedTitle;

        // Optimistic update - update UI immediately
        setChatTitle(tempTitle);
        setDisplayedTitle(tempTitle);
        setIsEditingTitle(false);

        try {
            // Call API in background
            await renameChat(conversationId, tempTitle);
            toast.success("Chat renamed");
        } catch (e) {
            console.error("Failed to rename chat", e);

            // Rollback on failure
            setChatTitle(previousTitle);
            setDisplayedTitle(previousDisplayedTitle);
            toast.error("Failed to rename chat");
        }
    };

    const handleDeleteChat = async () => {
        setIsDeleteDialogOpen(true);
    };

    const confirmDeleteChat = async () => {
        if (!conversationId) return;
        try {
            await deleteChat(conversationId);
            setIsDeleteDialogOpen(false);
            router.push('/new');
            toast.success("Chat deleted");
        } catch (e) {
            console.error("Failed to delete chat", e);
            toast.error("Failed to delete chat");
        }
    };

    const handleToggleStar = async () => {
        if (!conversationId) return;
        const newPinned = !isStarred;
        setIsStarred(newPinned); // Optimistic local UI
        try {
            await pinChat(conversationId, newPinned);
            toast.success(newPinned ? "Chat pinned" : "Chat unpinned");
        } catch (e) {
            console.error("Failed to update chat", e);
            setIsStarred(!newPinned); // Revert
            toast.error("Failed to update chat");
        }
    };

    const ChatTitleHeader = (
        <div className="inline-flex items-center gap-0.5 group max-w-full">
            {isEditingTitle ? (
                <div className="relative flex items-center">
                    {/* Hidden span for width measurement */}
                    <span className="invisible absolute whitespace-pre font-semibold px-2 text-sm pointer-events-none" style={{ minWidth: '80px', maxWidth: '400px' }}>
                        {tempTitle || displayedTitle}
                    </span>
                    <Input
                        value={tempTitle}
                        onChange={(e) => setTempTitle(e.target.value.substring(0, 70))}
                        className="h-8 font-semibold px-2 bg-secondary/30 border-none focus-visible:ring-1 focus-visible:ring-primary/50 transition-all duration-200"
                        style={{ width: `${Math.max(120, Math.min(400, (tempTitle.length || (displayedTitle?.length || 8)) * 9))}px` }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameChat();
                            if (e.key === 'Escape') setIsEditingTitle(false);
                        }}
                        onBlur={handleRenameChat}
                        autoFocus
                        onFocus={(e) => e.target.select()}
                        maxLength={70}
                    />
                </div>
            ) : (
                // Use a grouped control so title + chevron share hover
                <div className="inline-flex items-center gap-0.5 group/control">
                    <Button
                        variant="ghost"
                        className={cn(
                            "h-8 font-semibold px-2 shrink-0 max-w-[300px] sm:max-w-[400px] justify-start rounded-md transition-colors",
                            isTypingTitle || displayedTitle === "New Chat"
                                ? "cursor-default bg-transparent"
                                : "cursor-pointer hover:bg-sidebar-accent/20 dark:hover:bg-sidebar-accent/30 group-hover/control:bg-sidebar-accent/20"
                        )}
                        onClick={() => {
                            if (!isTypingTitle && displayedTitle !== "New Chat") {
                                setTempTitle(displayedTitle);
                                setIsEditingTitle(true);
                            }
                        }}
                        disabled={isTypingTitle || displayedTitle === "New Chat"}
                    >
                        <span className="truncate">
                            {displayedTitle}
                        </span>
                    </Button>

                    {/* Chevron immediately adjacent and shares hover via group-control */}
                    {(!isTypingTitle && displayedTitle && displayedTitle !== "New Chat") && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-6 text-muted-foreground/70 rounded-md transition-colors hover:bg-sidebar-accent/20 dark:hover:bg-sidebar-accent/30 group-hover/control:bg-sidebar-accent/20">
                                    <IconChevronDown className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48">
                                <DropdownMenuItem onClick={handleToggleStar}>
                                    {isStarred ? <IconPinFilled className="mr-2 size-4 text-primary" /> : <IconPin className="mr-2 size-4" />}
                                    {isStarred ? "Unpin" : "Pin"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                    setTempTitle(chatTitle || "New Chat");
                                    setIsRenameDialogOpen(true);
                                }}>
                                    <IconPencil className="mr-2 size-4" />
                                    Rename
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => setIsDeleteDialogOpen(true)}
                                    className="text-destructive focus:bg-destructive/10 focus:text-destructive-foreground hover:bg-destructive/10 hover:text-destructive-foreground group/del"
                                >
                                    <IconTrash className="mr-2 size-4 group-hover/del:text-destructive-foreground transition-colors" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            )}
        </div>
    );

    // Chat Header Actions - Star, Download, Menu (positioned on extreme right)
    const ChatHeaderActions = (!isTypingTitle && displayedTitle && displayedTitle !== "New Chat") ? (
        <div className="flex items-center gap-1">
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50 hover:text-foreground hover:bg-sidebar-accent/20 dark:hover:bg-sidebar-accent/30 rounded-md transition-colors" onClick={handleToggleStar}>
                        {isStarred ? <IconPinFilled className="size-4 text-primary" /> : <IconPin className="size-4" />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                    <p>{isStarred ? "Unpin" : "Pin"}</p>
                </TooltipContent>
            </Tooltip>

            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50 hover:text-foreground hover:bg-sidebar-accent/20 dark:hover:bg-sidebar-accent/30 rounded-md transition-colors" onClick={() => router.push('/new')}>
                        <IconEdit className="size-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                    <p>New Chat</p>
                </TooltipContent>
            </Tooltip>

            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50 hover:text-foreground hover:bg-sidebar-accent/20 dark:hover:bg-sidebar-accent/30 rounded-md transition-colors" onClick={() => {
                        // Conversation export with timestamps + Ellipticc notice
                        const lines: string[] = [];
                        const exportedAt = new Date();
                        lines.push(`# Conversation export`);
                        lines.push(`This conversation was generated with Ellipticc (https://ellipticc.com). AI chats may display inaccurate or offensive information (see https://ellipticc.com/privacy-policy for more info).`);
                        lines.push(`Exported: ${exportedAt.toLocaleString()}`);
                        if (conversationId) lines.push(`Conversation ID: ${conversationId}`);
                        if (model) lines.push(`Model: ${formatModelName(model)}`);
                        lines.push('---\n');

                        for (const m of messages) {
                            const ts = m.createdAt ? new Date(m.createdAt).toLocaleString() : '';
                            lines.push(`**${m.role.toUpperCase()}**${ts ? ` — ${ts}` : ''}`);
                            lines.push('');
                            lines.push(m.content || '');
                            lines.push('\n---\n');
                        }

                        const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        const safeDate = exportedAt.toISOString().replace(/[:.]/g, '-');
                        a.href = url;
                        a.download = `conversation-${conversationId || 'export'}-${safeDate}.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }}>
                        <IconDownload className="size-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                    <p>Download</p>
                </TooltipContent>
            </Tooltip>


        </div>
    ) : null;

    return (
        <div className="flex flex-col h-full bg-background relative overflow-x-hidden">


            {/* Header */}
            <SiteHeader className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm" customTitle={ChatTitleHeader} rightContent={ChatHeaderActions} />

            {/* Main Content Area */}
            <div className="flex-1 relative flex flex-col overflow-hidden">

                {isInitialLoading || (!isContentReady && messages.length === 0) ? (
                    // LOADING SKELETON - Simple pulsating paragraph (only on initial load)
                    <div className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth">
                        <div className="max-w-4xl mx-auto space-y-2">
                            {/* Pulsating skeleton lines - simulating paragraph text */}
                            <Skeleton className="h-4 w-full animate-pulse" />
                            <Skeleton className="h-4 w-[95%] animate-pulse" style={{ animationDelay: '100ms' }} />
                            <Skeleton className="h-4 w-full animate-pulse" style={{ animationDelay: '200ms' }} />
                            <Skeleton className="h-4 w-[90%] animate-pulse" style={{ animationDelay: '300ms' }} />
                            <Skeleton className="h-4 w-full animate-pulse" style={{ animationDelay: '400ms' }} />
                            <Skeleton className="h-4 w-[85%] animate-pulse" style={{ animationDelay: '100ms' }} />
                            <Skeleton className="h-4 w-full animate-pulse" style={{ animationDelay: '200ms' }} />
                            <Skeleton className="h-4 w-[80%] animate-pulse" style={{ animationDelay: '300ms' }} />
                            <Skeleton className="h-4 w-full animate-pulse" style={{ animationDelay: '100ms' }} />
                            <Skeleton className="h-4 w-[75%] animate-pulse" style={{ animationDelay: '200ms' }} />
                            <Skeleton className="h-4 w-full animate-pulse" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                ) : messages.length === 0 ? (
                    // ZERO STATE: Centered Input
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                        <div className="w-full max-w-4xl mx-auto px-4 space-y-8 animate-in fade-in zoom-in-95 duration-500 slide-in-from-bottom-4">

                            {/* Greeting / Brand */}
                            <div className="text-center space-y-2">
                                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center justify-center gap-2">
                                    <IconCaretLeftRightFilled className="size-6" />
                                    How can I help you today?
                                </h1>
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

                                {/* Suggestions */}
                                {suggestions.length > 0 && (
                                    <div className="pt-2">
                                        <Suggestions>
                                            {suggestions.map((s, i) => (
                                                <Suggestion
                                                    key={i}
                                                    suggestion={s}
                                                    onClick={handleSuggestionClick}
                                                />
                                            ))}
                                        </Suggestions>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (

                    // CHAT STATE: Scrollable Messages + Sticky Bottom Input
                    <div className="flex flex-col h-full w-full relative">
                        {/* Messages Container - Virtual List for Performance */}
                        <div
                            ref={scrollContainerRef}
                            onScroll={handleScroll}
                            className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth min-h-0 max-w-full overflow-x-hidden"
                        >
                            {/* Standard List Rendering */}
                            <div className="flex flex-col items-center w-full min-h-full">
                                {messages.map((message, index) => {
                                    // Determine spacing: more gap between follow-ups (assistant) and user prompt, less between user prompt and assistant response
                                    const isUserMsg = message.role === 'user';
                                    const nextMsg = messages[index + 1];
                                    const isFollowedByAssistant = nextMsg?.role === 'assistant';
                                    const spacing = isUserMsg && isFollowedByAssistant ? 'mb-1' : 'mb-4';

                                    return (
                                        <div
                                            key={message.id || index}
                                            id={`message-${message.id}`}
                                            className={cn("w-full flex justify-center animate-in fade-in duration-300", spacing)}
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
                                                        onSuggestionClick={(text) => {
                                                            handleSubmit(text);
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                                }
                                {/* Scroll Anchor */}
                                <div ref={scrollEndRef} className="h-1 w-full" />
                            </div>
                        </div>

                        {/* Sticky Input Footer - Centered with consistent max-width */}
                        <div
                            className="sticky bottom-0 z-40 w-full bg-background/95 pb-4 pt-0 transition-all duration-300 ease-in-out"
                        >
                            {/* Scroll to Bottom Button - Absolute to top of footer */}
                            {showScrollToBottom && (
                                <div className="absolute top-[-3.5rem] left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
                                    <Tooltip delayDuration={500}>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="rounded-full shadow-md bg-background border-border/50 size-8 dark:bg-muted dark:border-border/60 text-foreground ring-1 ring-border/10 hover:bg-sidebar-accent/20 hover:text-foreground dark:hover:bg-sidebar-accent/30 dark:hover:text-foreground transition-none"
                                                onClick={() => scrollToBottom()}
                                            >
                                                <IconArrowDown className="size-4 text-foreground" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">Scroll to bottom</TooltipContent>
                                    </Tooltip>
                                </div>
                            )}

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
                                        conversationId={conversationId}
                                        maxContextTokens={contextBreakdown?.maxTokens || 128000}
                                        usedContextTokens={contextBreakdown?.totalUsed || 0}
                                        systemTokens={contextBreakdown?.systemTokens || 0}
                                        toolDefinitionTokens={contextBreakdown?.toolDefinitionTokens || 0}
                                        messageTokens={contextBreakdown?.messageTokens || 0}
                                        userMessageTokens={contextBreakdown?.userMessageTokens || 0}
                                        assistantMessageTokens={contextBreakdown?.assistantMessageTokens || 0}
                                        toolResultTokens={contextBreakdown?.toolResultTokens || 0}
                                    />
                                    {/* Disclaimer Text */}
                                    <p className="text-xs text-center text-muted-foreground mt-2 select-none" aria-hidden="false">
                                        AI may display inaccurate or offensive information.
                                    </p>
                                </div>
                            </div>
                        </div>
                        {/* Chat Navigation (DeepSeek Style) */}
                        <ChatScrollNavigation
                            messages={messages}
                            scrollToMessage={scrollToMessage}
                        />
                    </div>
                )}

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

            {/* Rename Dialog */}
            <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
                <DialogContent className="sm:max-w-md bg-sidebar/95 backdrop-blur-sm border-sidebar-border">
                    <DialogHeader>
                        <DialogTitle>Rename chat</DialogTitle>
                        <DialogDescription className="text-muted-foreground text-sm">
                            Enter a new name for this conversation.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={tempTitle}
                            onChange={(e) => setTempTitle(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleRenameChat();
                                    setIsRenameDialogOpen(false);
                                }
                            }}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => {
                            handleRenameChat();
                            setIsRenameDialogOpen(false);
                        }}>
                            Submit
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete Chat?</DialogTitle>
                        <DialogDescription>
                            This will permanently delete this chat history. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDeleteChat}
                            className="bg-destructive hover:bg-destructive/90 text-white font-semibold"
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
