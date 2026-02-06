
import { useState, useEffect, useCallback } from 'react';
import { keyManager } from '@/lib/key-manager';
import type { UserKeypairs } from '@/lib/key-manager';
import apiClient from '@/lib/api';

export interface DecryptedMessage {
    role: 'user' | 'assistant';
    content: string;
    id?: string;
    createdAt?: string;
    isThinking?: boolean;
}

interface UseAICryptoReturn {
    isReady: boolean;
    kyberPublicKey: string | null;
    userKeys: { keypairs: UserKeypairs } | null;
    decryptHistory: (chatId: string) => Promise<DecryptedMessage[]>;
    decryptStreamChunk: (encryptedContent: string, iv: string, encapsulatedKey?: string, existingSessionKey?: Uint8Array) => Promise<{ decrypted: string, sessionKey: Uint8Array }>;
    error: string | null;
}

export function useAICrypto(): UseAICryptoReturn {
    const [isReady, setIsReady] = useState(false);
    const [kyberPublicKey, setKyberPublicKey] = useState<string | null>(null);
    const [userKeys, setUserKeys] = useState<{ keypairs: UserKeypairs } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const init = async () => {
            try {
                // 1. Ensure keys are available
                if (!keyManager.hasKeys()) {
                    throw new Error("No keys found");
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

        init();

        return () => {
            mounted = false;
        };
    }, []);

    const decryptHistory = useCallback(async (chatId: string): Promise<DecryptedMessage[]> => {
        if (!userKeys) return [];

        try {
            const { decryptData } = await import('@/lib/crypto');
            const { ml_kem768 } = await import('@noble/post-quantum/ml-kem');

            const encryptedMessages = await apiClient.getAIChatMessages(chatId);
            if (!encryptedMessages || encryptedMessages.length === 0) return [];

            const decrypted = await Promise.all(encryptedMessages.map(async (msg: any) => {
                try {
                    // E2EE Flow: Decapsulate -> Decrypt
                    if (msg.encapsulated_key && msg.encrypted_content) {
                        const encapsulatedKey = Uint8Array.from(atob(msg.encapsulated_key), c => c.charCodeAt(0));
                        const kyberPriv = userKeys.keypairs.kyberPrivateKey;

                        // Decapsulate
                        const sharedSecret = ml_kem768.decapsulate(encapsulatedKey, kyberPriv);

                        // Decrypt
                        const decryptedBytes = decryptData(msg.encrypted_content, sharedSecret, msg.iv);
                        return {
                            ...msg,
                            role: msg.role,
                            content: new TextDecoder().decode(decryptedBytes)
                        };
                    }
                    return msg; // Return as-is if not encrypted (legacy/fallback)
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

    return {
        isReady,
        kyberPublicKey,
        userKeys,
        decryptHistory,
        decryptStreamChunk,
        error
    };
}
