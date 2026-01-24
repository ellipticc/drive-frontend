import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';


// Types for Worker Messages
export type DecryptBlockRequest = {
    type: 'DECRYPT_BLOCK';
    payload: {
        chunkId: string;
        encryptedContent: string; // base64
        iv: string; // base64
        salt?: string; // Not strictly used with CEK but kept for legacy
        cek: Uint8Array; // Unwrapped CEK
    };
    id: string; // correlation ID
};

export type EncryptBlockRequest = {
    type: 'ENCRYPT_BLOCK';
    payload: {
        id: string; // Block ID
        content: any; // Raw Block Object
        cek: Uint8Array;
    };
    id: string;
};

export type WorkerResponse = {
    id: string;
    success: boolean;
    data?: any;
    error?: string;
};

// Helper to decode base64 to Uint8Array safely
const base64ToUint8Array = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

// Helper to encode Uint8Array to base64
const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};


self.onmessage = async (e: MessageEvent) => {
    const { type, payload, id } = e.data;

    try {
        if (type === 'DECRYPT_BLOCK') {
            const { chunkId, encryptedContent, iv, cek } = payload;

            if (!cek) throw new Error('Missing CEK for decryption');
            if (!encryptedContent || !iv) throw new Error('Missing encrypted content or IV');

            // Decrypt
            const encryptedBytes = base64ToUint8Array(encryptedContent);
            const nonceBytes = base64ToUint8Array(iv);

            // XChaCha20-Poly1305 Decryption
            const decryptedBytes = xchacha20poly1305(cek, nonceBytes).decrypt(encryptedBytes);
            const decryptedStr = new TextDecoder().decode(decryptedBytes);

            // Parse JSON block
            const block = JSON.parse(decryptedStr);

            // Return success
            self.postMessage({ id, success: true, data: block });

        } else if (type === 'ENCRYPT_BLOCK') {
            const { content, cek } = payload;
            if (!cek) throw new Error('Missing CEK for encryption');

            // Serialize
            const contentStr = JSON.stringify(content);
            const contentBytes = new TextEncoder().encode(contentStr);

            // Generate random nonce (24 bytes for XChaCha20)
            const nonce = crypto.getRandomValues(new Uint8Array(24));

            // Encrypt
            const encryptedBytes = xchacha20poly1305(cek, nonce).encrypt(contentBytes);

            // Calculate SHA-256 Checksum for integrity (optional but good)
            const hashBuffer = await crypto.subtle.digest('SHA-256', contentBytes);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            const result = {
                encryptedContent: uint8ArrayToBase64(encryptedBytes),
                iv: uint8ArrayToBase64(nonce),
                hash: hashHex,
                salt: '' // Not used for CEK flow, but might be needed by API schema
            };

            self.postMessage({ id, success: true, data: result });
        } else {
            console.warn('Unknown worker message type:', type);
        }
    } catch (err: any) {
        console.error('Worker Error:', err);
        self.postMessage({ id, success: false, error: err.message || 'Worker Error' });
    }
};
