/// <reference lib="webworker" />

import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { createBLAKE3 } from 'hash-wasm';

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function uint8ArrayFromBase64(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// Simple Gzip decompression using DecompressionStream if available
async function decompressData(data: Uint8Array): Promise<Uint8Array> {
    try {
        if (typeof DecompressionStream !== 'undefined') {
            const stream = new DecompressionStream('gzip');
            const writer = stream.writable.getWriter();
            const writerPromise = writer.write(data as unknown as BufferSource).then(() => writer.close());

            const chunks: Uint8Array[] = [];
            const reader = stream.readable.getReader();
            let totalLength = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) {
                    chunks.push(value);
                    totalLength += value.length;
                }
            }

            await writerPromise;

            const result = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                result.set(chunk, offset);
                offset += chunk.length;
            }
            return result;
        }
    } catch (e) {
        console.warn('Decompression failed or not supported in worker', e);
    }
    return data;
}

// -----------------------------------------------------------------------------
// Message Handler
// -----------------------------------------------------------------------------

self.onmessage = async (e: MessageEvent) => {
    const { type, id } = e.data;

    try {
        if (type === 'verify_integrity') {
            // Calculate BLAKE3 hash of the assembled file
            const fileData: Uint8Array = e.data.fileData;

            const hasher = await createBLAKE3();
            hasher.init();
            hasher.update(fileData);
            const hashHex = hasher.digest('hex');

            self.postMessage({ id, success: true, result: hashHex });

        } else if (type === 'decrypt_chunk') {
            const { encryptedChunk, key, nonce, isCompressed, expectedHash } = e.data;

            // Verify integrity of the encrypted chunk before decryption
            if (expectedHash) {
                const hasher = await createBLAKE3();
                hasher.init();
                hasher.update(encryptedChunk);
                const calculatedHash = hasher.digest('hex');

                if (calculatedHash !== expectedHash) {
                    // Fallback for legacy files (SHA-256 or SHA-512)
                    let isValid = false;

                    // Check for SHA-512 (128 chars)
                    if (expectedHash.length === 128) {
                        try {
                            const hashBuffer = await crypto.subtle.digest('SHA-512', encryptedChunk);
                            const hashArray = Array.from(new Uint8Array(hashBuffer));
                            const sha512Hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                            if (sha512Hex === expectedHash) isValid = true;
                        } catch (e) { console.warn('Legacy SHA-512 check failed', e); }
                    }
                    // Check for SHA-256 (64 chars) - same length as BLAKE3 so we must try if BLAKE3 failed
                    else if (expectedHash.length === 64) {
                        try {
                            const hashBuffer = await crypto.subtle.digest('SHA-256', encryptedChunk);
                            const hashArray = Array.from(new Uint8Array(hashBuffer));
                            const sha256Hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                            if (sha256Hex === expectedHash) isValid = true;
                        } catch (e) { console.warn('Legacy SHA-256 check failed', e); }
                    }

                    if (!isValid) {
                        throw new Error(`Chunk integrity verification failed. Expected ${expectedHash}, got ${calculatedHash} (BLAKE3)`);
                    }
                }
            }

            const nonceBytes = uint8ArrayFromBase64(nonce);
            const decrypted = xchacha20poly1305(key, nonceBytes).decrypt(encryptedChunk);

            // 2. Decompress if needed
            let finalData = decrypted;
            if (isCompressed) {
                finalData = await decompressData(decrypted);
            }

            self.postMessage({
                id,
                success: true,
                result: finalData
            }, [finalData.buffer]); // Transfer decrypted buffer
        }
    } catch (err) {
        self.postMessage({
            id,
            success: false,
            error: err instanceof Error ? err.message : String(err)
        });
    }
};
