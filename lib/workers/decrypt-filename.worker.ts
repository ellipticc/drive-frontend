/// <reference lib="webworker" />

import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';

// Helper for hex string to Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}

self.onmessage = async (e: MessageEvent) => {
    const { id, encryptedFilename, filenameSalt, masterKey } = e.data;

    try {
        if (!encryptedFilename || !filenameSalt || !masterKey) {
            throw new Error('Missing required arguments');
        }

        // 1. Parse encrypted filename (format: "encryptedData:nonce" in base64)
        const [encryptedPart, noncePart] = encryptedFilename.split(':');
        if (!encryptedPart || !noncePart) {
            throw new Error('Invalid encrypted filename format');
        }

        // 2. Decode base64
        const decodedSalt = Uint8Array.from(atob(filenameSalt), c => c.charCodeAt(0));
        const filenameNonce = Uint8Array.from(atob(noncePart), c => c.charCodeAt(0));
        const encryptedBytes = Uint8Array.from(atob(encryptedPart), c => c.charCodeAt(0));

        // 3. Derive filename-specific key (HKDF-like)
        // salt + 'filename-key'
        const keyMaterial = new Uint8Array(decodedSalt.length + 12);
        keyMaterial.set(decodedSalt, 0);
        keyMaterial.set(new TextEncoder().encode('filename-key'), decodedSalt.length);

        // Use Web Crypto HMAC-SHA256
        const hmacKey = await self.crypto.subtle.importKey(
            'raw',
            masterKey,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const derivedKeyMaterial = await self.crypto.subtle.sign('HMAC', hmacKey, keyMaterial);
        const filenameKey = new Uint8Array(derivedKeyMaterial.slice(0, 32));

        // 4. Decrypt
        const decryptedBytes = xchacha20poly1305(filenameKey, filenameNonce).decrypt(encryptedBytes);
        const filename = new TextDecoder().decode(decryptedBytes);

        // 5. Sanitize
        const sanitized = filename.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();

        self.postMessage({
            id,
            success: true,
            result: sanitized
        });

    } catch (err) {
        self.postMessage({
            id,
            success: false,
            error: err instanceof Error ? err.message : String(err)
        });
    }
};
