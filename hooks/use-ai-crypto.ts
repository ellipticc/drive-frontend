import { useState, useEffect, useCallback } from 'react';
import { masterKeyManager } from '@/lib/master-key';
import { keyManager } from '@/lib/key-manager';
import type { UserKeypairs } from '@/lib/key-manager';
import apiClient from '@/lib/api';

export interface DecryptedMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    id?: string;
    createdAt?: string;
    isThinking?: boolean;
    reasoning?: string;
}

export interface UseAICryptoReturn {
    isReady: boolean;
    kyberPublicKey: string | null;
    userKeys: { keypairs: UserKeypairs } | null;
    chats: { id: string, title: string, pinned: boolean, archived: boolean, createdAt: string }[];
    loadChats: () => Promise<void>;
    renameChat: (conversationId: string, newTitle: string) => Promise<void>;
    pinChat: (conversationId: string, pinned: boolean) => Promise<void>;
    archiveChat: (conversationId: string, archived: boolean) => Promise<void>;
    deleteChat: (conversationId: string) => Promise<void>;
    decryptHistory: (conversationId: string) => Promise<DecryptedMessage[]>;
    decryptStreamChunk: (encryptedContent: string, iv: string, encapsulatedKey?: string, existingSessionKey?: Uint8Array) => Promise<{ decrypted: string, sessionKey: Uint8Array }>;
    encryptMessage: (content: string) => Promise<{ encryptedContent: string, iv: string, encapsulatedKey: string }>;
    error: string | null;
}

export function useAICrypto(): UseAICryptoReturn {
    // Check master key availability directly
    const hasMasterKey = typeof window !== 'undefined' && masterKeyManager.hasMasterKey();

    const [isReady, setIsReady] = useState(false);
    const [kyberPublicKey, setKyberPublicKey] = useState<string | null>(null);
    const [userKeys, setUserKeys] = useState<{ keypairs: UserKeypairs } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [chats, setChats] = useState<{ id: string, title: string, pinned: boolean, archived: boolean, createdAt: string }[]>([]);

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

    const loadChats = useCallback(async () => {
        if (!userKeys) return;
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
                    createdAt: chat.created_at
                };
            }));

            setChats(processed);
        } catch (e) {
            console.error("Failed to load chats:", e);
        }
    }, [userKeys, decryptTitle]);

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
            setChats(prev => prev.map(c => c.id === conversationId ? { ...c, title: newTitle } : c));
        } catch (e) {
            console.error("Failed to rename chat:", e);
            throw e;
        }
    }, [userKeys, kyberPublicKey]);

    const pinChat = useCallback(async (conversationId: string, pinned: boolean) => {
        try {
            await apiClient.updateChat(conversationId, { pinned });
            setChats(prev => prev.map(c => c.id === conversationId ? { ...c, pinned } : c));
        } catch (e) {
            console.error("Failed to pin chat:", e);
        }
    }, []);

    const archiveChat = useCallback(async (conversationId: string, archived: boolean) => {
        setChats(prev => prev.map(c => c.id === conversationId ? { ...c, archived } : c)); // Optimistic
        try {
            await apiClient.updateChat(conversationId, { archived });
        } catch (err) {
            console.error("Failed to archive chat", err);
            setChats(prev => prev.map(c => c.id === conversationId ? { ...c, archived: !archived } : c)); // Revert
        }
    }, []);

    const deleteChat = useCallback(async (conversationId: string) => {
        setChats(prev => prev.filter(c => c.id !== conversationId)); // Optimistic
        if (typeof window !== "undefined") {
            const currentUrlId = new URLSearchParams(window.location.search).get('conversationId');
            if (currentUrlId === conversationId) {
                // Redirect to new chat
                window.history.replaceState(null, '', '/assistant');
            }
        }

        try {
            await apiClient.deleteChat(conversationId);
        } catch (err) {
            console.error("Failed to delete chat:", err);
            loadChats(); // Revert/Reload if failed
        }
    }, [loadChats]);

    // Helper: Parse thinking tags from content and move to reasoning
    const parseThinkingFromContent = (content: string, existingReasoning?: string): { content: string; reasoning: string } => {
        let thinkingBuffer = "";
        let displayContent = "";
        let isInsideThinkingTag = false;
        let i = 0;

        while (i < content.length) {
            if (!isInsideThinkingTag) {
                // Look for opening tag
                const openIdx = content.indexOf("<thinking>", i);
                if (openIdx !== -1) {
                    // Add everything before tag to display content
                    displayContent += content.substring(i, openIdx);
                    i = openIdx + "<thinking>".length;
                    isInsideThinkingTag = true;
                } else {
                    // No opening tag found, add everything from i to end
                    displayContent += content.substring(i);
                    break;
                }
            } else {
                // Inside thinking tag, look for closing tag
                const closeIdx = content.indexOf("</thinking>", i);
                if (closeIdx !== -1) {
                    // Add thinking content to buffer
                    thinkingBuffer += content.substring(i, closeIdx);
                    i = closeIdx + "</thinking>".length;
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

            const encryptedMessages = await apiClient.getAIChatMessages(conversationId);
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

                        return {
                            ...msg,
                            role: msg.role,
                            content: cleanContent,
                            reasoning: parsedReasoning
                        };
                    }

                    // Legacy/fallback: Parse thinking tags from unencrypted content
                    if (msg.content) {
                        const { content: cleanContent, reasoning: parsedReasoning } = parseThinkingFromContent(msg.content);
                        return {
                            ...msg,
                            content: cleanContent,
                            reasoning: parsedReasoning
                        };
                    }

                    return msg; // Return as-is if no parseable content
                } catch (e) {
                    console.error("Failed to decrypt message:", msg.id, e);
                    return { ...msg, content: "[Decryption Failed]" };
                }
            }));

            return decrypted;
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
        const decryptedBytes = decryptData(encryptedContent, sessionKey, iv);
        const decrypted = new TextDecoder().decode(decryptedBytes);

        return { decrypted, sessionKey };
    }, [userKeys]);

    const encryptMessage = useCallback(async (content: string) => {
        if (!userKeys || !kyberPublicKey) throw new Error("Encryption keys not ready");
        const { encryptForUser } = await import('@/lib/ai-crypto');
        return encryptForUser(content, kyberPublicKey);
    }, [userKeys, kyberPublicKey]);

    return {
        isReady,
        kyberPublicKey,
        userKeys,
        chats,
        loadChats, // Expose for manual refresh
        renameChat,
        pinChat,
        archiveChat,
        deleteChat,
        decryptHistory,
        decryptStreamChunk,
        encryptMessage,
        error
    };
}
