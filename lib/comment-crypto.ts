/**
 * Cryptographic helpers for end-to-end encrypted comments.
 * All comments are encrypted client-side using a key derived from the share CEK.
 */
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';

/**
 * Derives a dedicated comment encryption key from the share CEK using HKDF.
 */
export async function deriveCommentKey(shareCek: Uint8Array): Promise<Uint8Array> {
    const info = new TextEncoder().encode('share-comments-v1');

    const ikm = await crypto.subtle.importKey(
        'raw',
        shareCek as any,
        { name: 'HKDF' },
        false,
        ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: new Uint8Array(32).fill(0), // Zero salt is fine for HKDF with high-entropy IKM
            info: info
        },
        ikm,
        256
    );

    return new Uint8Array(derivedBits);
}

/**
 * Encrypts a comment string using XChaCha20-Poly1305.
 * Returns a base64 encoded string containing [nonce(24b)][ciphertext].
 */
export async function encryptComment(content: string, key: Uint8Array): Promise<string> {
    const nonce = crypto.getRandomValues(new Uint8Array(24));
    const encodedContent = new TextEncoder().encode(content);
    const cipher = xchacha20poly1305(key, nonce);
    const encrypted = cipher.encrypt(encodedContent);

    const combined = new Uint8Array(nonce.length + encrypted.length);
    combined.set(nonce);
    combined.set(encrypted, nonce.length);

    // Use a cleaner base64 conversion
    return btoa(String.fromCharCode(...Array.from(combined)));
}

/**
 * Decrypts a base64 encoded comment string.
 */
export async function decryptComment(encryptedBase64: string, key: Uint8Array): Promise<string> {
    try {
        const combined = new Uint8Array(atob(encryptedBase64).split('').map(c => c.charCodeAt(0)));
        const nonce = combined.slice(0, 24);
        const encrypted = combined.slice(24);

        const cipher = xchacha20poly1305(key, nonce);
        const decryptedBytes = cipher.decrypt(encrypted);

        return new TextDecoder().decode(decryptedBytes);
    } catch (err) {
        console.error('Failed to decrypt comment:', err);
        return '[Decryption Failed]';
    }
}
