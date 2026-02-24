import { useState, useEffect, useCallback, useRef } from 'react';
import { masterKeyManager } from '@/lib/master-key';
import { keyManager } from '@/lib/key-manager';
import type { UserKeypairs } from '@/lib/key-manager';
import apiClient from '@/lib/api';
import { sortChatsByLastMessage } from '@/lib/chat-utils';

// Module-level singletons shared across all useAICrypto instances.
// Ensures only one in-flight fetch for /ai/chats regardless of how many
// components mount and call loadChats() concurrently.
let _chatsLoadedOnce = false;
let _inflightFetch: Promise<void> | null = null;

export interface DecryptedMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    id?: string;
    createdAt?: string;
    isThinking?: boolean;
    reasoning?: string;
    suggestions?: string[];
}

export interface UseAICryptoReturn {
    isReady: boolean;
    kyberPublicKey: string | null;
    userKeys: { keypairs: UserKeypairs } | null;
    chats: { id: string, title: string, pinned: boolean, archived: boolean, createdAt: string, lastMessageAt?: string }[];
    loadChats: (forceRefresh?: boolean) => Promise<void>;
    updateChatTimestamp: (chatId: string, timestamp: string) => void;
    renameChat: (conversationId: string, newTitle: string) => Promise<void>;
    pinChat: (conversationId: string, pinned: boolean) => Promise<void>;
    archiveChat: (conversationId: string, archived: boolean) => Promise<void>;
    deleteChat: (conversationId: string) => Promise<void>;
    decryptHistory: (conversationId: string) => Promise<DecryptedMessage[]>;
    decryptStreamChunk: (encryptedContent: string, iv: string, encapsulatedKey?: string, existingSessionKey?: Uint8Array) => Promise<{ decrypted: string, sessionKey: Uint8Array }>;
    encryptMessage: (content: string) => Promise<{ encryptedContent: string, iv: string, encapsulatedKey: string }>;
    encryptWithSessionKey: (content: string, sessionKey: Uint8Array) => Promise<{ encryptedContent: string, iv: string }>;
    error: string | null;
}

export function useAICrypto(): UseAICryptoReturn {
    // Check master key availability directly
    const hasMasterKey = typeof window !== 'undefined' && masterKeyManager.hasMasterKey();

    const [isReady, setIsReady] = useState(false);
    const [kyberPublicKey, setKyberPublicKey] = useState<string | null>(null);
    const [userKeys, setUserKeys] = useState<{ keypairs: UserKeypairs } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [chats, setChats] = useState<{ id: string, title: string, pinned: boolean, archived: boolean, createdAt: string, lastMessageAt?: string }[]>([]);

    // Cross-instance sync: dispatch and listen for chat mutations via custom events
    const instanceId = useRef(Math.random().toString(36));

    const broadcastChats = useCallback((updatedChats: typeof chats) => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('chat-mutation', { detail: { chats: updatedChats, source: instanceId.current } }));
        }
    }, []);

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail.source !== instanceId.current) {
                setChats(detail.chats);
            }
        };
        window.addEventListener('chat-mutation', handler);
        return () => window.removeEventListener('chat-mutation', handler);
    }, []);

    // Per-instance ref used only to avoid double-calling within the same instance
    // across StrictMode double-invocations. Cross-instance deduplication is handled
    // by the module-level _inflightFetch promise and _chatsLoadedOnce flag.
    const hasLoadedChats = useRef(false);

    useEffect(() => {
        let mounted = true;

        const init = async () => {
            try {
                // 1. Ensure keys are available
                if (!keyManager.hasKeys()) {
                    throw Error("No keys available")
                }

                try {
                    const keys = await keyManager.getUserKeys();
                    if (!mounted) return;

                    setUserKeys(keys);
                    setKyberPublicKey(keys.keypairs.kyberPublicKey);
                    setIsReady(true);
                } catch (err) {
                    console.error("Failed to load user keys for AI Crypto:", err);
                    if (mounted) setError("Failed to load encryption keys.");
                }
            } catch (e) {
                if (mounted) setError("Crypto initialization failed.");
            }
        };

        if (hasMasterKey) init();

        return () => {
            mounted = false;
        };
    }, [hasMasterKey]);

    const decryptTitle = useCallback(async (encryptedTitle: string, iv: string, encapsulatedKey: string) => {
        if (!userKeys) return "Encrypted Chat";
        try {
            const { decryptData } = await import('@/lib/crypto');
            const { ml_kem768 } = await import('@noble/post-quantum/ml-kem');

            const encKeyBytes = Uint8Array.from(atob(encapsulatedKey), c => c.charCodeAt(0));
            const kyberPriv = userKeys.keypairs.kyberPrivateKey;
            const sharedSecret = ml_kem768.decapsulate(encKeyBytes, kyberPriv);
            const decryptedBytes = decryptData(encryptedTitle, sharedSecret, iv);
            return new TextDecoder().decode(decryptedBytes);
        } catch (e) {
            console.error("Title decryption failed:", e);
            return "Decryption Failed";
        }
    }, [userKeys]);

    const loadChats = useCallback(async (forceRefresh = false) => {
        if (!userKeys) return;

        // Use module-level cache: if loaded and not forcing, skip entirely
        if (_chatsLoadedOnce && !forceRefresh) return;

        // If another instance already has a fetch in-flight, wait for it instead
        // of firing a duplicate request. This coalesces all concurrent callers.
        if (_inflightFetch) {
            await _inflightFetch;
            return;
        }

        // Own the in-flight slot
        let resolveFlight!: () => void;
        _inflightFetch = new Promise(r => { resolveFlight = r; });

        try {
            const res = await apiClient.getChats();
            const responseData = res as any;
            const rawChats: any[] = responseData.chats || responseData.data?.chats || [];

            const processed = await Promise.all(rawChats.map(async (chat: any) => {
                let title = "New Chat";
                if (chat.encrypted_title && chat.iv && chat.encapsulated_key) {
                    title = await decryptTitle(chat.encrypted_title, chat.iv, chat.encapsulated_key);

                    // Defensive sanitization to strip surrounding quotes/prefixes and stray trailing counts (including newline + digits like "\n0")
                    title = title.replace(/^\s*["'`]+|["'`]+\s*$/g, '')
                        .replace(/^Title:\s*/i, '')
                        .replace(/^Conversation\s*Start\s*[:\-\s]*/i, '')
                        .replace(/\s*[:\-\|]\s*0+$/g, '')
                        .replace(/(?:\n|\r|\s*[:\-\|]\s*)0+\s*$/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();

                    const words = title.split(/\s+/).filter(Boolean);
                    if (words.length > 10) title = words.slice(0, 10).join(' ');
                    if (!/[A-Za-z0-9]/.test(title) || title.length === 0) title = 'New Chat';
                }
                return {
                    id: chat.id,
                    title,
                    pinned: chat.pinned,
                    archived: !!chat.archived,
                    createdAt: chat.created_at,
                    lastMessageAt: chat.last_message_at || undefined
                };
            }));

            // sort by last message timestamp before storing
            const sorted = sortChatsByLastMessage(processed);
            setChats(sorted);
            broadcastChats(sorted);
            _chatsLoadedOnce = true;
            hasLoadedChats.current = true;
        } catch (e) {
            console.error("Failed to load chats:", e);
        } finally {
            _inflightFetch = null;
            resolveFlight();
        }
    }, [userKeys, decryptTitle, broadcastChats]);

    // helper to update a chat's lastMessageAt and reorder
    const updateChatTimestamp = useCallback((chatId: string, timestamp: string) => {
        setChats(prev => {
            const updated = prev.map(c => c.id === chatId ? { ...c, lastMessageAt: timestamp } : c);
            const sorted = sortChatsByLastMessage(updated);
            broadcastChats(sorted);
            return sorted;
        });
    }, [broadcastChats]);

    // Load chats once ready
    useEffect(() => {
        if (isReady && userKeys) {
            loadChats();
        }
    }, [isReady, userKeys, loadChats]);

    const renameChat = useCallback(async (conversationId: string, newTitle: string) => {
        if (!userKeys || !kyberPublicKey) return;
        try {
            const { encryptForUser } = await import('@/lib/ai-crypto');

            // Encrpyt new title
            const { encryptedContent, iv, encapsulatedKey } = await encryptForUser(newTitle, kyberPublicKey);

            await apiClient.updateChat(conversationId, {
                title: encryptedContent,
                iv,
                encapsulated_key: encapsulatedKey
            });

            // Optimistic Update
            const updated = chats.map(c => c.id === conversationId ? { ...c, title: newTitle } : c);
            setChats(sortChatsByLastMessage(updated));
            broadcastChats(updated);
        } catch (e) {
            console.error("Failed to rename chat:", e);
            throw e;
        }
    }, [userKeys, kyberPublicKey, chats, broadcastChats]);

    const pinChat = useCallback(async (conversationId: string, pinned: boolean) => {
        // Optimistic update
        const updated = chats.map(c => c.id === conversationId ? { ...c, pinned } : c);
        setChats(sortChatsByLastMessage(updated));
        broadcastChats(updated);
        try {
            await apiClient.updateChat(conversationId, { pinned });
        } catch (e) {
            console.error("Failed to pin chat:", e);
            // Revert on failure
            const reverted = chats.map(c => c.id === conversationId ? { ...c, pinned: !pinned } : c);
            setChats(sortChatsByLastMessage(reverted));
            broadcastChats(reverted);
        }
    }, [chats, broadcastChats]);

    const archiveChat = useCallback(async (conversationId: string, archived: boolean) => {
        const updated = chats.map(c => c.id === conversationId ? { ...c, archived } : c);
        setChats(sortChatsByLastMessage(updated));
        broadcastChats(updated);
        try {
            await apiClient.updateChat(conversationId, { archived });
        } catch (err) {
            console.error("Failed to archive chat", err);
            const reverted = chats.map(c => c.id === conversationId ? { ...c, archived: !archived } : c);
            setChats(sortChatsByLastMessage(reverted));
            broadcastChats(reverted);
        }
    }, [chats, broadcastChats]);

    const deleteChat = useCallback(async (conversationId: string) => {
        const updated = chats.filter(c => c.id !== conversationId);
        setChats(sortChatsByLastMessage(updated));
        broadcastChats(updated);

        if (typeof window !== "undefined") {
            const currentUrlId = new URLSearchParams(window.location.search).get('conversationId');
            if (currentUrlId === conversationId) {
                window.history.replaceState(null, '', '/new');
            }
        }

        try {
            await apiClient.deleteChat(conversationId);
        } catch (err) {
            console.error("Failed to delete chat:", err);
            loadChats();
        }
    }, [chats, broadcastChats, loadChats]);

    // Helper: Parse thinking tags from content and move to reasoning (supports both <thinking> and <think>)
    const parseThinkingFromContent = (content: string, existingReasoning?: string): { content: string; reasoning: string } => {
        let thinkingBuffer = "";
        let displayContent = "";
        let isInsideThinkingTag = false;
        let i = 0;
        let currentTagFormat = { open: '', close: '' };

        const thinkingTags = [
            { open: '<thinking>', close: '</thinking>' },
            { open: '<think>', close: '</think>' }
        ];

        while (i < content.length) {
            if (!isInsideThinkingTag) {
                // Look for opening tag (check both formats)
                let openIdx = -1;
                let foundTag = null;

                for (const tag of thinkingTags) {
                    const idx = content.indexOf(tag.open, i);
                    if (idx !== -1 && (openIdx === -1 || idx < openIdx)) {
                        openIdx = idx;
                        foundTag = tag;
                    }
                }

                if (openIdx !== -1 && foundTag) {
                    // Add everything before tag to display content
                    displayContent += content.substring(i, openIdx);
                    i = openIdx + foundTag.open.length;
                    currentTagFormat = foundTag;
                    isInsideThinkingTag = true;
                } else {
                    // No opening tag found, add everything from i to end
                    displayContent += content.substring(i);
                    break;
                }
            } else {
                // Inside thinking tag, look for closing tag
                const closeIdx = content.indexOf(currentTagFormat.close, i);
                if (closeIdx !== -1) {
                    // Add thinking content to buffer
                    thinkingBuffer += content.substring(i, closeIdx);
                    i = closeIdx + currentTagFormat.close.length;
                    isInsideThinkingTag = false;
                } else {
                    // Closing tag not found, rest is thinking
                    thinkingBuffer += content.substring(i);
                    break;
                }
            }
        }

        // Combine thinking: prefer existing reasoning, fallback to parsed thinking
        const finalReasoning = existingReasoning || thinkingBuffer || "";

        return {
            content: displayContent.trim(),
            reasoning: finalReasoning.trim()
        };
    };

    const decryptHistory = useCallback(async (conversationId: string): Promise<DecryptedMessage[]> => {
        if (!userKeys) return [];

        try {
            const { decryptData } = await import('@/lib/crypto');
            const { ml_kem768 } = await import('@noble/post-quantum/ml-kem');

            const response = await apiClient.getAIChatMessages(conversationId);
            const encryptedMessages = response.messages || [];
            if (!encryptedMessages || encryptedMessages.length === 0) return [];

            const decrypted = await Promise.all(encryptedMessages.map(async (msg: any) => {
                try {
                    // E2EE Flow: Decapsulate -> Decrypt
                    if (msg.encapsulated_key && msg.encrypted_content) {
                        const encapsulatedKey = Uint8Array.from(atob(msg.encapsulated_key), c => c.charCodeAt(0));
                        const kyberPriv = userKeys.keypairs.kyberPrivateKey;

                        // Decapsulate
                        const sharedSecret = ml_kem768.decapsulate(encapsulatedKey, kyberPriv);

                        // Decrypt content
                        const decryptedBytes = decryptData(msg.encrypted_content, sharedSecret, msg.iv);
                        const decryptedContent = new TextDecoder().decode(decryptedBytes);

                        // Decrypt reasoning if it exists
                        let decryptedReasoning: string | undefined;
                        if (msg.reasoning && msg.reasoning_iv) {
                            try {
                                const reasoningDecryptedBytes = decryptData(msg.reasoning, sharedSecret, msg.reasoning_iv);
                                decryptedReasoning = new TextDecoder().decode(reasoningDecryptedBytes);
                            } catch (e) {
                                console.warn("Failed to decrypt reasoning:", msg.id, e);
                                // Continue without reasoning if decryption fails
                            }
                        }

                        // Parse thinking tags from content and reasoning
                        const { content: cleanContent, reasoning: parsedReasoning } = parseThinkingFromContent(
                            decryptedContent,
                            decryptedReasoning
                        );

                        // Parse suggestions JSON if present (decrypt if encrypted)
                        let suggestions: string[] | undefined;
                        if (msg.suggestions) {
                            try {
                                let suggestionsJson = msg.suggestions;

                                // Decrypt if IV is present
                                if (msg.suggestions_iv) {
                                    try {
                                        const suggestionsDecryptedBytes = decryptData(msg.suggestions, sharedSecret, msg.suggestions_iv);
                                        suggestionsJson = new TextDecoder().decode(suggestionsDecryptedBytes);
                                    } catch (e) {
                                        console.warn("Failed to decrypt suggestions:", msg.id, e);
                                        // If decryption fails, we can't do anything with the encrypted string
                                        suggestionsJson = "[]";
                                    }
                                }

                                if (typeof suggestionsJson === 'string') {
                                    suggestions = JSON.parse(suggestionsJson);
                                } else if (Array.isArray(suggestionsJson)) {
                                    // Handle case where it might be already parsed (unlikely from DB but possible in some flows)
                                    suggestions = suggestionsJson;
                                }
                            } catch {
                                // If parse fails, assume empty
                                suggestions = [];
                            }
                        }

                        return {
                            ...msg,
                            role: msg.role,
                            content: cleanContent,
                            reasoning: parsedReasoning,
                            reasoningDuration: msg.reasoning_duration,
                            suggestions,
                            total_time: msg.total_time,
                            ttft: msg.ttft,
                            tps: msg.tps,
                            model: msg.model,
                            sources: msg.sources,
                            feedback: msg.feedback as 'like' | 'dislike' | undefined,
                            createdAt: msg.created_at || msg.createdAt,
                        };
                    }

                    // Legacy/fallback: Parse thinking tags from unencrypted content
                    if (msg.content) {
                        const { content: cleanContent, reasoning: parsedReasoning } = parseThinkingFromContent(msg.content);
                        return {
                            ...msg,
                            content: cleanContent,
                            reasoning: parsedReasoning,
                            createdAt: msg.created_at || msg.createdAt,
                        };
                    }

                    return {
                        ...msg,
                        createdAt: msg.created_at || msg.createdAt,
                    }; // Return as-is if no parseable content
                } catch (e) {
                    console.error("Failed to decrypt message:", msg.id, e);
                    return { ...msg, content: "[Decryption Failed]", createdAt: msg.created_at || msg.createdAt };
                }
            }));

            // NEW: Build a conversation tree using parent_id
            const treeMap = new Map<string | null, any[]>();
            decrypted.forEach(msg => {
                const parentId = msg.parent_id || null;
                if (!treeMap.has(parentId)) {
                    treeMap.set(parentId, []);
                }
                treeMap.get(parentId)!.push(msg);
            });

            const result: any[] = [];

            // Reconstruct the thread starting from the root (parent_id = null)
            const buildChain = (currentParentId: string | null) => {
                const kids = treeMap.get(currentParentId) || [];
                if (kids.length === 0) return;

                // Sort children chronologically
                kids.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                // Group siblings (children of the same parent) as versions
                const versions = kids.map(m => ({
                    id: m.id,
                    content: m.content,
                    toolCalls: m.toolCalls,
                    feedback: m.feedback,
                    createdAt: m.createdAt,
                    total_time: m.total_time,
                    ttft: m.ttft,
                    tps: m.tps,
                    model: m.model,
                    suggestions: m.suggestions,
                    sources: m.sources,
                    reasoning: m.reasoning,
                    reasoningDuration: m.reasoningDuration
                }));

                const base = { ...kids[kids.length - 1] }; // Default to latest version
                if (versions.length > 1) {
                    base.versions = versions;
                    base.currentVersionIndex = versions.length - 1;
                }

                result.push(base);

                // Recursively follow the latest version's children
                buildChain(base.id);
            };

            buildChain(null);
            return result;
        } catch (err) {
            console.error("Failed to fetch/decrypt history:", err);
            throw err;
        }
    }, [userKeys]);

    const decryptStreamChunk = useCallback(async (
        encryptedContent: string,
        iv: string,
        encapsulatedKey?: string,
        existingSessionKey?: Uint8Array
    ): Promise<{ decrypted: string, sessionKey: Uint8Array }> => {
        if (!userKeys) throw new Error("User keys not ready");

        let sessionKey = existingSessionKey;
        const { decryptData } = await import('@/lib/crypto');
        const { ml_kem768 } = await import('@noble/post-quantum/ml-kem');

        // 1. If we received an encapsulated key (first chunk), derive the session key
        if (encapsulatedKey && !sessionKey) {
            const encKeyBytes = Uint8Array.from(atob(encapsulatedKey), c => c.charCodeAt(0));
            const kyberPriv = userKeys.keypairs.kyberPrivateKey;

            // Decapsulate
            const sharedSecret = ml_kem768.decapsulate(encKeyBytes, kyberPriv);
            sessionKey = sharedSecret; // 32 bytest
        }

        if (!sessionKey) throw new Error("No session key available for decryption");

        // 2. Decrypt the chunk
        try {
            if (!encryptedContent) return { decrypted: "", sessionKey };
            const decryptedBytes = decryptData(encryptedContent, sessionKey, iv);
            const decrypted = new TextDecoder().decode(decryptedBytes);
            return { decrypted, sessionKey };
        } catch (e: any) {
            // Ignore padding errors or empty chunks which might be keep-alives
            if (e.message && (e.message.includes("padding") || e.message.includes("invalid"))) {
                console.warn("Soft decryption failure (likely padding/keep-alive):", e.message);
                return { decrypted: "", sessionKey };
            }
            console.error("Critical decryption failure:", e);
            throw e; // Re-throw critical errors
        }
    }, [userKeys]);

    const encryptMessage = useCallback(async (content: string) => {
        if (!userKeys || !kyberPublicKey) throw new Error("Encryption keys not ready");
        const { encryptForUser } = await import('@/lib/ai-crypto');
        return encryptForUser(content, kyberPublicKey);
    }, [userKeys, kyberPublicKey]);

    const encryptWithSessionKey = useCallback(async (content: string, sessionKey: Uint8Array) => {
        const { encryptData } = await import('@/lib/crypto');
        const { encryptedData, nonce } = encryptData(new TextEncoder().encode(content), sessionKey);

        return {
            encryptedContent: encryptedData,
            iv: nonce
        };
    }, []);

    return {
        isReady,
        kyberPublicKey,
        userKeys,
        chats,
        loadChats, // Expose for manual refresh
        updateChatTimestamp,
        renameChat,
        pinChat,
        archiveChat,
        deleteChat,
        decryptHistory,
        decryptStreamChunk,
        encryptMessage,
        encryptWithSessionKey,
        error
    };
}
