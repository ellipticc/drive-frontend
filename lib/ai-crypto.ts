import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hkdf } from '@noble/hashes/hkdf.js';

// Base64 helpers
function toBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes));
}

function fromBase64(str: string): Uint8Array {
    return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

/**
 * Derive a unique encryption key for a specific chat session.
 * Uses HKDF with the Master Key and Chat ID as salt/info.
 */
export async function deriveAIChatKey(masterKey: Uint8Array, chatId: string): Promise<Uint8Array> {
    if (masterKey.length !== 32) throw new Error('Master key must be 32 bytes');

    // HKDF-SHA256
    // Salt: ChatId (unique per chat)
    // Info: "ai-chat-key" context
    // IKM: Master Key
    const salt = new TextEncoder().encode(chatId);
    const info = new TextEncoder().encode('ai-chat-key');

    // Derive 32-byte key
    return hkdf(sha256, masterKey, salt, info, 32);
}

/**
 * Encrypt an AI message using XChaCha20-Poly1305.
 */
export function encryptAIMessage(content: string, chatKey: Uint8Array): { encryptedContent: string; iv: string } {
    if (chatKey.length !== 32) throw new Error('Chat key must be 32 bytes');

    const nonce = crypto.getRandomValues(new Uint8Array(24)); // XChaCha20 uses 24-byte nonce
    const plaintext = new TextEncoder().encode(content);

    const ciphertext = xchacha20poly1305(chatKey, nonce).encrypt(plaintext);

    return {
        encryptedContent: toBase64(ciphertext),
        iv: toBase64(nonce)
    };
}

/**
 * Decrypt an AI message.
 */
export function decryptAIMessage(encryptedContent: string, iv: string, chatKey: Uint8Array): string {
    if (chatKey.length !== 32) throw new Error('Chat key must be 32 bytes');

    const ciphertext = fromBase64(encryptedContent);
    const nonce = fromBase64(iv);

    if (nonce.length !== 24) throw new Error('Invalid IV length');

    const plaintext = xchacha20poly1305(chatKey, nonce).decrypt(ciphertext);

    return new TextDecoder().decode(plaintext);
}
