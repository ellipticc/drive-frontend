/// <reference lib="webworker" />

import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { createBLAKE3 } from 'hash-wasm';

// We duplicate some simple utility logic to avoid importing large modules that might have DOM dependencies
function uint8ArrayToBase64(array: Uint8Array): string {
    const CHUNK_SIZE = 8192;
    let result = '';
    for (let i = 0; i < array.length; i += CHUNK_SIZE) {
        const chunk = array.subarray(i, i + CHUNK_SIZE);
        result += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(result);
}

function encryptChunk(data: Uint8Array, key: Uint8Array): { encryptedData: Uint8Array; nonce: Uint8Array } {
    // Pad if < 16 bytes
    let dataToEncrypt = data;
    if (data.length < 16) {
        dataToEncrypt = new Uint8Array(17);
        dataToEncrypt[0] = data.length;
        dataToEncrypt.set(data, 1);
        dataToEncrypt.fill(0, 1 + data.length);
    }

    const nonce = new Uint8Array(24);
    crypto.getRandomValues(nonce);

    const encrypted = xchacha20poly1305(key, nonce).encrypt(dataToEncrypt);
    return { encryptedData: encrypted, nonce };
}

self.onmessage = async (e: MessageEvent) => {
    const { id, chunk, key, chunkIndex } = e.data;

    try {
        // 1. Encrypt (XChaCha20-Poly1305) - Synchronous but runs in worker
        const { encryptedData, nonce } = encryptChunk(chunk, key);

        // 2. Hash (BLAKE3) - Async
        const blake3 = await createBLAKE3();
        blake3.init();
        blake3.update(encryptedData);
        const hashHex = blake3.digest('hex'); // Returns hex string

        // We also need to Base64 encode the Nonce for the main thread
        const nonceB64 = uint8ArrayToBase64(nonce);

        // Transferrable objects for zero-copy
        self.postMessage({
            id,
            success: true,
            result: {
                encryptedData,
                nonce: nonceB64,
                hash: hashHex,
                index: chunkIndex
            }
        }, [encryptedData.buffer]); // Transfer the encrypted buffer
    } catch (err) {
        self.postMessage({
            id,
            success: false,
            error: err instanceof Error ? err.message : String(err)
        });
    }
};
