/// <reference lib="webworker" />

// Encryption dependencies
// Encryption dependencies
// NOTE: Dynamic imports used inside handlers to prevent load-time errors
// import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
// import { createBLAKE3 } from 'hash-wasm';

// -----------------------------------------------------------------------------
// Message Types
// -----------------------------------------------------------------------------

type WorkerMessage =
  | { type: 'hash_file'; id: string; file: File }
  | { type: 'process_chunk'; id: string; chunk: Uint8Array; key: Uint8Array; index: number; shouldCompress: boolean };

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

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

// Simple Gzip compression using CompressionStream if available
// Now accepts shouldCompress parameter - file-level decision passed from main thread
async function compressData(data: Uint8Array, shouldCompress: boolean): Promise<{ data: Uint8Array, isCompressed: boolean, algorithm: string, ratio: number }> {
  // If file-level test determined no compression, skip immediately
  if (!shouldCompress) {
    return { data, isCompressed: false, algorithm: 'none', ratio: 1.0 };
  }

  try {
    if (typeof CompressionStream !== 'undefined') {

      const stream = new CompressionStream('gzip');
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

      // Check if compression was worth it (this shouldn't happen if file-level test was correct)
      const ratio = result.length / data.length;
      if (ratio < 0.92) {
        return { data: result, isCompressed: true, algorithm: 'gzip', ratio };
      }
    }
  } catch (e) {
    // Fallback or error
  }

  return { data, isCompressed: false, algorithm: 'none', ratio: 1.0 };
}


// -----------------------------------------------------------------------------
// Message Handler
// -----------------------------------------------------------------------------

console.log('[UploadWorker] Worker started');

self.onmessage = async (e: MessageEvent) => {
  const { type, id } = e.data;
  console.log(`[UploadWorker] Received message type: ${type} id: ${id}`);

  try {
    if (type === 'hash_file') {
      console.log(`[UploadWorker] Hashing file for ${id}`);
      const file = e.data.file; // Cast or assume File
      const hasher = await createBLAKE3();
      hasher.init();

      const chunkSize = 4 * 1024 * 1024; // 4MB
      const reader = new FileReaderSync();

      // Read file in chunks
      for (let offset = 0; offset < file.size; offset += chunkSize) {
        const slice = file.slice(offset, Math.min(offset + chunkSize, file.size));
        const buffer = reader.readAsArrayBuffer(slice);
        hasher.update(new Uint8Array(buffer));
      }

      const hashHex = hasher.digest('hex');
      console.log(`[UploadWorker] Hashing complete for ${id}`);
      self.postMessage({ id, success: true, result: hashHex });

    } else if (type === 'process_chunk') {
      const { chunk, key, index, shouldCompress } = e.data;
      console.log(`[UploadWorker] Processing chunk ${index} for ${id}`);

      // 1. Compress (only if file-level test determined it's worthwhile)
      const compressionDesc = await compressData(chunk, shouldCompress);

      // 2. Encrypt
      console.log(`[UploadWorker] Encrypting chunk ${index}`);
      const { encryptedData, nonce } = encryptChunk(compressionDesc.data, key);

      // 3. Hash (BLAKE3)
      const blake3 = await createBLAKE3();
      blake3.init();
      blake3.update(encryptedData);
      const hashHex = blake3.digest('hex');

      // 4. Checksum (MD5) - Required for B2 Object Lock
      // Use MD5 for Content-MD5 header (standard, won't be signed by AWS SDK)
      try {
        const { createMD5 } = await import('hash-wasm');
        const md5 = await createMD5();
        md5.init();
        md5.update(encryptedData);
        const md5Bytes = new Uint8Array(md5.digest('binary'));
        const md5Base64 = btoa(String.fromCharCode.apply(null, Array.from(md5Bytes)));

        const nonceB64 = uint8ArrayToBase64(nonce);

        // Compress metadata
        const compressionMeta = {
          isCompressed: compressionDesc.isCompressed,
          algorithm: compressionDesc.algorithm,
          originalSize: chunk.length,
          compressedSize: compressionDesc.data.length,
          ratio: compressionDesc.ratio
        };

        console.log(`[UploadWorker] Chunk ${index} processed successfully`, { compressionMeta });

        self.postMessage({
          id,
          success: true,
          result: {
            encryptedData,
            nonce: nonceB64,
            hash: hashHex,
            md5: md5Base64,
            index,
            compression: compressionMeta
          }
        }, [encryptedData.buffer]); // Transfer encrypted data
      } catch (err) {
        console.error('[UploadWorker] MD5 or final step failed:', err);
        throw err;
      }
    }
  } catch (err) {
    console.error(`[UploadWorker] Error processing message ${id}:`, err);
    self.postMessage({
      id,
      success: false,
      error: err instanceof Error ? err.message : String(err)
    });
  }
};
