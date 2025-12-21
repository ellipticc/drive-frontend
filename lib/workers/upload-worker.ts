/**
 * File Upload Worker
 * Handles parallel encryption and hashing of file chunks
 * Offloads CPU-intensive crypto operations to background thread
 */

import { encryptData, uint8ArrayToHex } from '../crypto';
import { createBLAKE3 } from 'hash-wasm';

interface ChunkProcessingJob {
  jobId: string;
  chunkData: Uint8Array;
  chunkIndex: number;
  cekHex: string; // CEK as hex string for transfer
}

interface ChunkProcessingResult {
  jobId: string;
  chunkIndex: number;
  encryptedData: ArrayBuffer;
  nonce: string;
  blake3Hash: string;
  error?: string;
}

// Initialize BLAKE3 hasher once
interface Blake3Hasher {
  update(data: Uint8Array): void;
  digest(): Uint8Array | number[];
}

let blake3Hasher: Blake3Hasher | null = null;

async function initializeBlake3() {
  if (!blake3Hasher) {
    blake3Hasher = await createBLAKE3() as unknown as Blake3Hasher;
  }
}

/**
 * Compute BLAKE3 hash of data
 */
async function computeBLAKE3Hash(data: Uint8Array): Promise<string> {
  await initializeBlake3();
  if (!blake3Hasher) throw new Error('BLAKE3 hasher not available');
  blake3Hasher.update(data);
  const hashArray = blake3Hasher.digest();
  return uint8ArrayToHex(new Uint8Array(hashArray));
}

/**
 * Helper to convert hex string back to Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Process a chunk: encrypt and hash
 */
async function processChunk(job: ChunkProcessingJob): Promise<ChunkProcessingResult> {
  try {
    const cek = hexToUint8Array(job.cekHex);
    
    // Encrypt the chunk
    const { encryptedData, nonce } = encryptData(job.chunkData, cek);
    const encryptedBytes = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

    // Compute BLAKE3 hash of encrypted data
    const blake3Hash = await computeBLAKE3Hash(encryptedBytes);

    return {
      jobId: job.jobId,
      chunkIndex: job.chunkIndex,
      encryptedData: encryptedBytes.buffer,
      nonce,
      blake3Hash
    };
  } catch (error) {
    return {
      jobId: job.jobId,
      chunkIndex: job.chunkIndex,
      encryptedData: new ArrayBuffer(0),
      nonce: '',
      blake3Hash: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Handle messages from main thread
self.onmessage = async (event: MessageEvent<ChunkProcessingJob>) => {
  const result = await processChunk(event.data);
  
  // Send result back to main thread with transferable ArrayBuffer
  (self as unknown as { postMessage: (data: unknown, transfer?: Transferable[]) => void }).postMessage(result, [result.encryptedData]);
};
