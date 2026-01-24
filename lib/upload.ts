/**
 * Secure File Upload Pipeline for Hybrid PQC End-to-End Encrypted Storage
 *
 * This module implements a complete browser-side file upload flow with:
 * - SHA-256 file hashing
 * - File chunking (4-8MB chunks)
 * - Per-chunk compression with intelligent algorithm selection
 * - XChaCha20-Poly1305 encryption per chunk (after compression)
 * - BLAKE3 integrity hashing per encrypted chunk
 * - Streaming uploads to Backblaze B2 via presigned URLs
 * - Progress callbacks and resumable uploads
 */

import { apiClient } from './api';
import { uuidv7 } from 'uuidv7-js';
import { PerformanceTracker } from './performance-tracker';
import { encryptData, uint8ArrayToHex, hexToUint8Array, encryptFilename, computeFilenameHmac } from './crypto';
import { keyManager } from './key-manager';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { createMD5 } from 'hash-wasm';
import { masterKeyManager } from './master-key';
import { CompressionAlgorithm, CompressionMetadata } from './compression';
import { generateThumbnail } from './thumbnail';
import { WorkerPool } from './worker-pool';
import { getTransferQueue } from './transfer-queue';
import { paperService } from './paper-service';

// Lazy-initialized worker pool
let uploadWorkerPool: WorkerPool | null = null;

const getUploadWorkerPool = () => {
  if (!uploadWorkerPool) {
    uploadWorkerPool = new WorkerPool(() => new Worker(new URL('./workers/upload-worker.ts', import.meta.url)));
  }
  return uploadWorkerPool;
};

// Types and interfaces
export interface UploadProgress {
  stage: 'hashing' | 'chunking' | 'compressing' | 'encrypting' | 'uploading' | 'finalizing';
  overallProgress: number; // 0-100
  currentChunk?: number;
  totalChunks?: number;
  bytesProcessed?: number;
  totalBytes?: number;
  chunkProgress?: number; // 0-100 for current chunk
  // Diagnostic info about the last upload attempt for a chunk
  lastAttempt?: {
    chunkIndex: number;
    attempt: number;
    status?: number | null;
    error?: string | null;
    b2Response?: string | null;
  };
}

export interface UserKeys {
  cek: Uint8Array; // Content Encryption Key (32 bytes)
  keypairs: {
    ed25519PrivateKey: Uint8Array;
    ed25519PublicKey: string;
    dilithiumPrivateKey: Uint8Array;
    dilithiumPublicKey: string;
    x25519PrivateKey: Uint8Array;
    x25519PublicKey: string;
    kyberPrivateKey: Uint8Array;
    kyberPublicKey: string;
  };
}

export interface FileMetadata {
  filename: string;
  size: number;
  mimeType: string;
  shaHash: string | null;
  wrappedCek: string;
  cekNonce: string;
  // PQC wrappers would be added here
}

export interface ChunkInfo {
  index: number;
  size: number;
  encryptedSize: number;
  blake3Hash: string;
  md5?: string; // MD5 checksum for B2 Object Lock (Content-MD5 header)
  nonce: string;
  // Compression metadata
  isCompressed: boolean;
  compressionAlgorithm: CompressionAlgorithm;
  compressionOriginalSize: number;
  compressionCompressedSize: number;
  compressionRatio: number;
  // Diagnostics
  attempts?: number;
  lastError?: string | null;
}

export interface UploadSession {
  sessionId: string;
  // Map of chunk index -> presigned entry (contains URL and optional metadata like md5/hash)
  uploadUrlsMap?: Record<number, { putUrl: string; md5?: string; objectKey?: string; sha256?: string; size?: number }>;
  // Backwards-compatible array (may be undefined in new flow)
  uploadUrls?: string[];
  chunks: ChunkInfo[];
  fileId: string;
  chunkHashes: string[]; // SHA256 hashes of encrypted chunks
  encryptedFilename?: string;
  filenameSalt?: string;
  thumbnailPutUrl?: string | null;
  manifestCreatedAt?: number; // Timestamp for consistent manifest hash computation
}

export interface UploadResult {
  fileId?: string;
  assetId?: string; // For paper assets
  sessionId?: string;
  metadata?: FileMetadata;
  chunks?: ChunkInfo[];
  file?: {
    id: string;
    name: string;
    encryptedFilename?: string;
    filenameSalt?: string;
    size: number;
    mimeType: string;
    folderId: string | null;
    type: 'file';
    createdAt: string;
    updatedAt: string;
    shaHash: string | null;
    is_shared: boolean;
  };
}

// Configuration - Dynamic chunk sizing based on file size
function getOptimalChunkSize(fileSize: number): number {
  const MB = 1024 * 1024;
  if (fileSize < 50 * MB) return 4 * MB;      // Small files: 4MB chunks
  if (fileSize < 500 * MB) return 6 * MB;     // Medium files: 6MB chunks
  return 8 * MB;                               // Large files (500MB+): 8MB chunks
}

/**
 * Check if file extension indicates already-compressed format
 * These formats won't benefit from compression and attempting it wastes CPU
 */
function shouldSkipCompression(filename: string): boolean {
  const skipExtensions = /\.(mp4|mov|avi|mkv|webm|m4v|flv|wmv|mpg|mpeg|jpg|jpeg|png|gif|webp|bmp|ico|heic|heif|zip|7z|rar|gz|bz2|xz|tar\.gz|tgz|apk|ipa|dmg|iso|mp3|m4a|aac|ogg|opus|flac|wav|wma|pdf|docx|xlsx|pptx|epub|mobi|azw3)$/i;
  return skipExtensions.test(filename);
}

/**
 * Test file compressibility once (first 1-2MB sample) and cache decision
 * Returns compression decision to be used for all chunks
 */
async function testFileCompressibility(file: File): Promise<{ shouldCompress: boolean; reason: string }> {
  // Skip compression for known incompressible formats
  if (shouldSkipCompression(file.name)) {
    return { shouldCompress: false, reason: `Skipped: ${file.name.split('.').pop()?.toUpperCase()} format already compressed` };
  }

  // For very small files, always test
  if (file.size < 100 * 1024) {
    return { shouldCompress: true, reason: 'Small file: testing compression' };
  }

  // Test first 1-2MB of file
  const testSize = Math.min(file.size, 2 * 1024 * 1024);
  const testBlob = file.slice(0, testSize);
  const testData = new Uint8Array(await testBlob.arrayBuffer());

  try {
    if (typeof CompressionStream !== 'undefined') {
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const writerPromise = writer.write(testData as unknown as BufferSource).then(() => writer.close());

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

      const ratio = totalLength / testData.length;
      const shouldCompress = ratio < 0.92; // 8%+ savings required

      return {
        shouldCompress,
        reason: shouldCompress
          ? `Compressible: ${((1 - ratio) * 100).toFixed(1)}% savings detected`
          : `Not compressible: Only ${((1 - ratio) * 100).toFixed(1)}% savings`
      };
    }
  } catch (e) {
    console.warn('Compression test failed:', e);
  }

  // Default to compress if test fails
  return { shouldCompress: true, reason: 'Default: compression test unavailable' };
}

/**
 * Process a chunk in the Unified Web Worker
 * @param shouldCompress - File-level compression decision (tested once, applied to all chunks)
 */
const processChunkInWorker = (chunk: Uint8Array, key: Uint8Array, index: number, shouldCompress: boolean): Promise<{ encryptedData: Uint8Array; nonce: string; hash: string; md5: string; index: number; compression: CompressionMetadata }> => {
  const chunkBuffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);

  return getUploadWorkerPool().execute({
    type: 'process_chunk',
    id: index,
    chunk: new Uint8Array(chunkBuffer),
    key,
    index,
    shouldCompress  // Pass file-level decision to worker
  }, [chunkBuffer]);
};

/**
 * Perform a PUT to a presigned URL with client-side retries and exponential backoff.
 * Uses TransferQueue to prevent throttling by API request queue.
 * Reports each attempt via the onAttempt callback (attempt, status, error, body)
 */
async function putWithRetries(putUrl: string, body: Blob, headers: Record<string, string>, onAttempt?: (attempt: number, status?: number | null, error?: Error | null, body?: string | null) => void): Promise<{ ok: boolean; attempts: number; status?: number | null; body?: string | null }> {
  const CLIENT_MAX_RETRIES = 5;
  let attempt = 0;
  let lastStatus: number | null = null;
  let lastBody: string | null = null;

  for (attempt = 1; attempt <= CLIENT_MAX_RETRIES; attempt++) {
    try {
      // Use transfer queue instead of direct fetch to avoid API queue throttling
      const resp = await getTransferQueue().enqueue(() => fetch(putUrl, { method: 'PUT', body, headers, credentials: 'omit' }));
      lastStatus = resp.status;
      const txt = await resp.text();
      lastBody = txt;

      if (resp.ok) {
        onAttempt?.(attempt, resp.status, null, txt);
        return { ok: true, attempts: attempt, status: resp.status, body: txt };
      }

      // Non-200: report attempt
      onAttempt?.(attempt, resp.status, null, txt);

      // Retry on 5xx and InternalError messages
      const retryable = resp.status >= 500 || (txt && txt.toLowerCase().includes('internalerror'));
      if (!retryable) {
        // Non-retryable client error
        return { ok: false, attempts: attempt, status: resp.status, body: txt };
      }

      // Exponential backoff
      const backoffMs = Math.min(500 * Math.pow(2, attempt - 1), 10000);
      await new Promise(r => setTimeout(r, backoffMs));
    } catch (err) {
      onAttempt?.(attempt, null, err as Error, null);
      // Network errors are retryable
      lastStatus = null;
      lastBody = (err as Error).message;
      const backoffMs = Math.min(500 * Math.pow(2, attempt - 1), 10000);
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }

  return { ok: false, attempts: attempt - 1, status: lastStatus, body: lastBody };
}

/**
 * Main upload function - orchestrates the entire secure upload pipeline
 */
export async function uploadEncryptedFile(
  file: File,
  folderId: string | null = null,
  userKeys?: UserKeys,
  onProgress?: (progress: UploadProgress) => void,
  abortSignal?: AbortSignal,
  isPaused?: () => boolean,
  conflictResolution?: 'replace' | 'keepBoth' | 'skip',
  conflictFileName?: string, // The conflicting filename to extract counter from
  existingFileIdToDelete?: string, // For replace operations
  isKeepBothAttempt?: boolean, // Flag to indicate this is a keepBoth retry
  resumeState?: {
    fileId: string;
    sessionId: string;
    completedChunks: ChunkInfo[];
  },
  onChunkComplete?: (chunk: ChunkInfo) => void
): Promise<UploadResult> {
  // Generate fileId or reuse from resume state
  const fileId = resumeState?.fileId || uuidv7();

  try {
    const storageInfo = await apiClient.getUserStorage();
    if (!storageInfo.success || !storageInfo.data) {
      throw new Error('Failed to check storage quota');
    }

    const { used_bytes, quota_bytes } = storageInfo.data;
    if (used_bytes + file.size > quota_bytes) {
      const usedMB = Math.round(used_bytes / (1024 * 1024));
      const quotaMB = Math.round(quota_bytes / (1024 * 1024));
      const fileMB = Math.round(file.size / (1024 * 1024));
      throw new Error(`Storage quota exceeded. You have used ${usedMB}MB of ${quotaMB}MB. This file (${fileMB}MB) would exceed your limit.`);
    }

    // Get user keys from KeyManager if not provided
    const keys = userKeys || await keyManager.getUserKeys();

    // Check for abort before starting
    if (abortSignal?.aborted) {
      throw new Error('Upload cancelled');
    }

    // Validate file accessibility before starting upload
    try {
      const testSize = file.size; // Try to access file size
      if (testSize < 0) {
        throw new Error('Invalid file size');
      }

      // CRITICAL: Always try to read a chunk to ensure it's actually a file, not a directory
      // Even empty files (size 0) should be readable, but directories will fail
      const testSlice = file.slice(0, Math.min(1024, Math.max(1, testSize)));
      await testSlice.arrayBuffer(); // This will fail for directories
    } catch (error) {
      throw new Error(`Cannot access file "${file.name}". The file may have been deleted, moved, or this may be a directory that cannot be uploaded directly. ${error instanceof Error ? error.message : ''}`);
    }

    // Stage 1: Skip SHA-512 hash of entire file (Optimization for large files)
    // Relying on chunk-level BLAKE3 integrity instead
    onProgress?.({ stage: 'hashing', overallProgress: 0 });
    const shaHash = null; // Placeholder since full-file hashing is now optional

    // Check for abort after hashing
    if (abortSignal?.aborted) {
      throw new Error('Upload cancelled');
    }

    // Stage 2: Split file into chunks
    const chunks = await splitFileIntoChunks(file);
    onProgress?.({ stage: 'chunking', overallProgress: 0, totalChunks: chunks.length });

    // Check for abort after chunking
    if (abortSignal?.aborted) {
      throw new Error('Upload cancelled');
    }

    // Stage 2.5: Test file compressibility ONCE (not per-chunk)
    // This saves 20-30% CPU by avoiding redundant compression tests on every chunk
    onProgress?.({ stage: 'compressing', overallProgress: 0 });
    const compressionTest = await testFileCompressibility(file);

    // Stage 3: Initialize Upload Session (Streaming Mode)
    // We initialize early to get Upload URLs.
    onProgress?.({ stage: 'uploading', overallProgress: 0 });

    const dummyChunks = chunks.map((_, i) => ({
      index: i, size: 0, encryptedSize: 0, blake3Hash: '', nonce: '',
      isCompressed: false, compressionAlgorithm: 'none' as CompressionAlgorithm,
      compressionOriginalSize: 0, compressionCompressedSize: 0, compressionRatio: 0
    }));

    // Check for abort before initializing
    if (abortSignal?.aborted) throw new Error('Upload cancelled');

    const session = await initializeUploadSession(file, folderId, dummyChunks, shaHash, keys, conflictResolution, conflictFileName, existingFileIdToDelete, isKeepBothAttempt, fileId, resumeState?.sessionId);

    // Stage 4: Stream Process & Upload (Pipeline)
    // Reads, Encrypts, Hashes, and Uploads chunks in parallel without buffering entire file
    const processedChunks: ChunkInfo[] = new Array(chunks.length);
    const chunkHashes: string[] = new Array(chunks.length); // BLAKE3 hashes (now collected during upload)

    // Restore state from resumeState if available
    let completedCount = 0;
    let completedBytes = 0;

    if (resumeState) {
      resumeState.completedChunks.forEach(chunk => {
        // Ensure we map back to correct index
        processedChunks[chunk.index] = chunk;
        chunkHashes[chunk.index] = chunk.blake3Hash;
        completedCount++;
        completedBytes += chunk.size; // This is the original decrypted size of the chunk range
      });

      // Emit initial progress for resumed state
      onProgress?.({
        stage: 'uploading',
        overallProgress: (completedBytes / file.size) * 100,
        currentChunk: completedCount,
        totalChunks: chunks.length,
        chunkProgress: 100,
        bytesProcessed: completedBytes,
        totalBytes: file.size
      });
    }

    const activeTasks = new Set<Promise<void>>();
    // Increase concurrency based on hardware capabilities
    const concurrency = Math.min(navigator.hardwareConcurrency * 2 || 12, 16);
    console.log(`Starting parallel upload with concurrency=${concurrency} (hardwareConcurrency=${navigator.hardwareConcurrency || 'unknown'})`);
    const uploadStartTime = performance.now();

    for (let i = 0; i < chunks.length; i++) {
      // Skip if already processed
      if (processedChunks[i]) continue;

      // Check triggers
      if (abortSignal?.aborted) throw new Error('Upload cancelled');
      if (isPaused?.()) throw new Error('Upload paused');

      // Flow Control - wait for a slot to open up
      while (activeTasks.size >= concurrency) {
        await Promise.race(activeTasks);
      }

      const task = (async () => {
        try {
          // 1. Read (Lazy Load from Disk)
          // With concurrency=12-16, we hold ~48-64MB in memory (12-16 chunks * 4MB)
          // This is acceptable for modern systems and dramatically increases speed
          const range = chunks[i];
          const chunkBlob = file.slice(range.start, range.end);
          const chunkData = new Uint8Array(await chunkBlob.arrayBuffer());

          // 2. Process (Worker Offload)
          // Pass file-level compression decision to avoid per-chunk testing
          const processed = await processChunkInWorker(chunkData, keys.cek, i, compressionTest.shouldCompress);

          // 3. Upload (Streaming Network Request)
          // Upload encrypted data immediately and discard it to free memory
          // Lookup upload entry (may contain md5)
          let uploadEntry = session.uploadUrlsMap?.[i];

          // If the upload entry is missing (e.g. initial batch exhausted), fetch additional presigned URLs from server
          if (!uploadEntry || !uploadEntry.putUrl) {
            try {
              const start = i;
              const count = Math.min(100, chunks.length - start);
              const resp = await apiClient.getUploadPresignedUrls(session.sessionId, start, count);
              if (!resp.success || !resp.data || !Array.isArray(resp.data.presigned) || resp.data.presigned.length === 0) {
                throw new Error('Server did not return additional presigned URLs');
              }

              // Map returned presigned entries into the session.uploadUrlsMap
              for (const p of resp.data.presigned) {
                session.uploadUrlsMap = session.uploadUrlsMap || {};
                session.uploadUrlsMap[p.index] = { putUrl: p.putUrl, md5: p.md5, objectKey: p.objectKey, sha256: p.sha256, size: p.size };
              }

              uploadEntry = session.uploadUrlsMap ? session.uploadUrlsMap[i] : undefined;
            } catch (err) {
              throw new Error(`Failed to fetch additional presigned URLs for chunk ${i}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }

          if (!uploadEntry || !uploadEntry.putUrl) {
            // Sanity: still missing after attempted fetch
            throw new Error(`No presigned URL available for chunk ${i}`);
          }

          // Build headers — include Content-MD5 always when we have it to satisfy Object Lock requirements
          const headers: Record<string, string> = {
            'Content-Type': 'application/octet-stream'
          };
          if (processed.md5) {
            // Use the worker-computed MD5 for the actual encrypted payload (preferred for Object Lock)
            headers['Content-MD5'] = processed.md5;
          } else if (uploadEntry.md5) {
            // Fallback to server-provided md5 if present
            headers['Content-MD5'] = uploadEntry.md5;
          }

          // Perform PUT with client-side retries (preferred) and report attempts to UI
          const putBlob = new Blob([new Uint8Array(processed.encryptedData)]);
          const putHeaders = headers;

          const putResult = await putWithRetries(uploadEntry.putUrl, putBlob, putHeaders, (attempt, status, err, body) => {
            // Report attempt details in progress for UI
            onProgress?.({
              stage: 'uploading',
              overallProgress: (completedBytes / file.size) * 100,
              currentChunk: completedCount + 1,
              totalChunks: chunks.length,
              chunkProgress: Math.round((attempt / (process.env.CLIENT_UPLOAD_MAX_RETRIES ? parseInt(process.env.CLIENT_UPLOAD_MAX_RETRIES) : 5)) * 100),
              bytesProcessed: completedBytes,
              totalBytes: file.size,
              lastAttempt: { chunkIndex: i, attempt, status: status || null, error: err ? (err.message || String(err)) : null, b2Response: body ? String(body).substring(0, 512) : null }
            });
          });

          if (!putResult.ok) {
            // Expose last attempt details for diagnostics
            throw new Error(`Upload failed for chunk ${i}: ${putResult.status} - ${putResult.body}`);
          }

          // 4. Metadata (Keep only lightweight metadata)
          processedChunks[i] = {
            index: i,
            size: range.end - range.start,
            encryptedSize: processed.encryptedData.byteLength,
            blake3Hash: processed.hash,
            md5: processed.md5,
            nonce: processed.nonce,
            isCompressed: processed.compression.isCompressed,
            compressionAlgorithm: processed.compression.algorithm,
            compressionOriginalSize: processed.compression.originalSize,
            compressionCompressedSize: processed.compression.compressedSize,
            compressionRatio: processed.compression.ratio,
            attempts: putResult.attempts,
            lastError: putResult.ok ? null : `${putResult.status} - ${putResult.body}`
          };
          chunkHashes[i] = processed.hash;

          // Notify completed chunk info for resumption
          onChunkComplete?.(processedChunks[i]);

          completedCount++;
          completedBytes += (range.end - range.start);
          onProgress?.({
            stage: 'uploading',
            overallProgress: (completedBytes / file.size) * 100,
            currentChunk: completedCount,
            totalChunks: chunks.length,
            chunkProgress: 100,
            bytesProcessed: completedBytes,
            totalBytes: file.size
          });

        } catch (err) {
          throw err;
        }
      })();

      activeTasks.add(task);
      // Clean up task from set when done, but let error propagate through Promise.all later if needed
      task.then(() => activeTasks.delete(task)).catch(() => activeTasks.delete(task));
    }

    // Wait for all remaining uploads
    await Promise.all(activeTasks);

    const uploadEndTime = performance.now();
    const uploadDurationSec = (uploadEndTime - uploadStartTime) / 1000;
    const throughputMBps = (file.size / (1024 * 1024)) / uploadDurationSec;
    console.log(`Upload completed: ${chunks.length} chunks in ${uploadDurationSec.toFixed(2)}s (${throughputMBps.toFixed(2)} MB/s)`);

    // Update Session with REAL hashes for finalization
    session.chunkHashes = chunkHashes;
    session.chunks = processedChunks;

    // Stage 6: Confirm chunk uploads with backend
    let confirmData = await confirmChunkUploads(session.sessionId, processedChunks, session.chunkHashes);

    // If there are failed chunks, attempt retries by reprocessing and re-uploading the missing chunks
    if (confirmData.failedChunks > 0) {
      const maxRetries = 3;
      let attempt = 0;
      let missingIndices = confirmData.results.filter(r => !r.success).map(r => r.index);

      while (missingIndices.length > 0 && attempt < maxRetries) {
        attempt++;
        // Re-upload missing chunks sequentially (to avoid thundering requests for large numbers)
        for (const idx of missingIndices) {
          try {
            // Ensure an upload URL exists for this index, fetching more if necessary
            if (!session.uploadUrlsMap || !session.uploadUrlsMap[idx] || !session.uploadUrlsMap[idx].putUrl) {
              const start = idx;
              const count = Math.min(100, chunks.length - start);
              const urlsResp = await apiClient.getUploadPresignedUrls(session.sessionId, start, count);
              if (urlsResp.success && urlsResp.data && Array.isArray(urlsResp.data.presigned)) {
                session.uploadUrlsMap = session.uploadUrlsMap || {};
                for (const p of urlsResp.data.presigned) {
                  session.uploadUrlsMap[p.index] = { putUrl: p.putUrl, md5: p.md5, objectKey: p.objectKey, sha256: p.sha256, size: p.size };
                }
              } else {
                // Could not fetch additional URLs; continue to next index and we'll fail later if still missing
                continue;
              }
            }

            const range = chunks[idx];
            const chunkBlob = file.slice(range.start, range.end);
            const chunkData = new Uint8Array(await chunkBlob.arrayBuffer());

            // Use the same compression decision for re-uploads
            const processed = await processChunkInWorker(chunkData, keys.cek, idx, compressionTest.shouldCompress);

            // Attempt upload (with one retry on 4xx/5xx)
            const performUpload = async () => {
              const putEntry = session.uploadUrlsMap?.[idx];
              const putUrl = putEntry?.putUrl;
              if (!putUrl) throw new Error('No presigned URL available for chunk ' + idx);
              const headers: Record<string, string> = { 'Content-Type': 'application/octet-stream' };
              // Always attach Content-MD5 for object lock buckets (prefer the worker-computed md5)
              if (processed.md5) {
                headers['Content-MD5'] = processed.md5;
              } else if (putEntry?.md5) {
                headers['Content-MD5'] = putEntry.md5;
              }

              const blob = new Blob([new Uint8Array(processed.encryptedData)]);

              const result = await putWithRetries(putUrl, blob, headers, (attempt, status, err, body) => {
                // Update UI with attempt info
                onProgress?.({
                  stage: 'uploading',
                  overallProgress: (completedBytes / file.size) * 100,
                  currentChunk: idx + 1,
                  totalChunks: chunks.length,
                  chunkProgress: 0,
                  bytesProcessed: completedBytes,
                  totalBytes: file.size,
                  lastAttempt: { chunkIndex: idx, attempt, status: status || null, error: err ? (err.message || String(err)) : null, b2Response: body ? String(body).substring(0, 512) : null }
                });
              });

              if (!result.ok) {
                throw new Error(`Upload failed for chunk ${idx}: ${result.status} - ${result.body}`);
              }

              // Update processed chunk diagnostics
              processedChunks[idx] = processedChunks[idx] || {
                index: idx,
                size: range.end - range.start,
                encryptedSize: processed.encryptedData.byteLength,
                blake3Hash: processed.hash,
                md5: processed.md5,
                nonce: processed.nonce,
                isCompressed: processed.compression.isCompressed,
                compressionAlgorithm: processed.compression.algorithm,
                compressionOriginalSize: processed.compression.originalSize,
                compressionCompressedSize: processed.compression.compressedSize,
                compressionRatio: processed.compression.ratio
              };
              processedChunks[idx].attempts = result.attempts;
              processedChunks[idx].lastError = result.ok ? null : `${result.status} - ${result.body}`;
            };

            try {
              await performUpload();
            } catch (e) {
              // Try to fetch a fresh URL and retry once
              const urlsResp = await apiClient.getUploadPresignedUrls(session.sessionId, idx, 1);
              if (urlsResp.success && urlsResp.data && Array.isArray(urlsResp.data.presigned) && urlsResp.data.presigned.length > 0) {
                session.uploadUrlsMap = session.uploadUrlsMap || {};
                session.uploadUrlsMap[urlsResp.data.presigned[0].index] = { putUrl: urlsResp.data.presigned[0].putUrl, md5: urlsResp.data.presigned[0].md5, objectKey: urlsResp.data.presigned[0].objectKey, sha256: urlsResp.data.presigned[0].sha256, size: urlsResp.data.presigned[0].size };
                await performUpload();
              } else {
                throw e;
              }
            }

          } catch (err) {
            // Log and continue; we will re-confirm later
            console.warn(`Re-upload attempt failed for chunk ${idx}:`, err);
            continue;
          }
        }

        // Exponential backoff before re-confirming
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(res => setTimeout(res, backoffMs));

        // Re-confirm and update missingIndices
        confirmData = await confirmChunkUploads(session.sessionId, processedChunks, session.chunkHashes);
        missingIndices = confirmData.results.filter(r => !r.success).map(r => r.index);
      }

      if (missingIndices.length > 0) {
        throw new Error(`${missingIndices.length} chunks failed confirmation after ${maxRetries} retries`);
      }
    }

    onProgress?.({ stage: 'finalizing', overallProgress: 100 });

    // Check for abort before finalizing
    if (abortSignal?.aborted) {
      throw new Error('Upload cancelled');
    }

    // Stage 7: Generate Thumbnail (for photos/videos)
    let thumbnailData: string | undefined;
    let width: number | undefined;
    let height: number | undefined;
    let duration: number | undefined;

    if ((file.type.startsWith('image/') || file.type.startsWith('video/')) && session.thumbnailPutUrl) {
      try {
        const thumb = await generateThumbnail(file);
        if (thumb) {
          // Encrypt thumbnail with CEK
          const thumbArrayBuffer = await thumb.blob.arrayBuffer();
          const thumbUint8 = new Uint8Array(thumbArrayBuffer);
          const { encryptedData, nonce } = encryptData(thumbUint8, keys.cek);

          // Format as "encryptedData:nonce" in base64 (they are already base64 strings)
          const encryptedThumbBase64 = `${encryptedData}:${nonce}`;
          const thumbBytes = new TextEncoder().encode(encryptedThumbBase64);

          // Compute MD5 for thumbnail (required for some B2 configurations)
          const { createMD5 } = await import('hash-wasm');
          const md5Hasher = await createMD5();
          md5Hasher.init();
          md5Hasher.update(thumbBytes);
          const thumbMd5Bytes = new Uint8Array(md5Hasher.digest('binary'));
          const thumbMd5Base64 = btoa(String.fromCharCode.apply(null, Array.from(thumbMd5Bytes)));

          const thumbResp = await fetch(session.thumbnailPutUrl, {
            method: 'PUT',
            body: thumbBytes,
            headers: {
              'Content-Type': 'image/jpeg',
              'Content-MD5': thumbMd5Base64
            },
            signal: abortSignal,
            credentials: 'omit'
          });

          if (!thumbResp.ok) {
            console.error('Thumbnail upload to B2 failed:', thumbResp.status);
            // Fallback: send via finalizeUpload
            thumbnailData = encryptedThumbBase64;
          } else {
            console.log('Thumbnail uploaded successfully to B2');
          }

          width = thumb.width;
          height = thumb.height;
          duration = thumb.duration;
        }
      } catch (err) {
        console.error('Failed to generate thumbnail:', err);
        // Continue upload even if thumbnail fails
      }
    }

    // Stage 8: Finalize upload
    const result = await finalizeUpload(
      session.sessionId,
      session.fileId,
      file,
      shaHash,
      keys,
      folderId,
      session.encryptedFilename,
      session.filenameSalt,
      session.manifestCreatedAt,
      thumbnailData,
      width,
      height,
      duration
    );

    onProgress?.({ stage: 'finalizing', overallProgress: 100 });

    return result;

  } catch (error) {
    // Check if this was a user cancellation
    if (abortSignal?.aborted) {
      throw new Error('Upload cancelled by user');
    }

    // Unpack specific control flow errors - do NOT wrap them
    if (error instanceof Error) {
      if (error.message === 'Upload paused') throw error;
      if (error.message === 'Upload cancelled') throw error;
      if (error.message === 'Upload cancelled by user') throw error;
      if (error.message === 'FILE_CONFLICT') throw error;
    }

    console.error('Upload failed:', error);
    throw new Error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Split file into chunks of CHUNK_SIZE
 * Includes retry logic for transient file access errors
 */
/**
 * Calculate file chunk ranges (Lazy Chunking)
 * Does NOT read file content, just calculates start/end offsets.
 * Uses dynamic chunk sizing based on file size for optimal performance.
 * Supports 5GB+ files with minimal memory usage.
 */
function splitFileIntoChunks(file: File): { start: number; end: number }[] {
  const chunks: { start: number; end: number }[] = [];
  const fileSize = file.size;
  const chunkSize = getOptimalChunkSize(fileSize);

  for (let offset = 0; offset < fileSize; offset += chunkSize) {
    chunks.push({
      start: offset,
      end: Math.min(offset + chunkSize, fileSize)
    });
  }
  return chunks;
}

/**
 * Initialize upload session with backend
 */
async function initializeUploadSession(
  file: File,
  folderId: string | null,
  chunks: ChunkInfo[],
  shaHash: string | null,
  keys: UserKeys,
  conflictResolution?: 'replace' | 'keepBoth' | 'skip',
  conflictFileName?: string,
  existingFileIdToDelete?: string,
  isKeepBothAttempt?: boolean,
  clientFileId?: string,
  existingSessionId?: string,
): Promise<UploadSession> {

  // Map worker-computed hashes (BLAKE3) to the list
  const chunkHashes = chunks.map(c => c.blake3Hash);

  // Generate encryption metadata
  const encryptionIv = new Uint8Array(16);
  crypto.getRandomValues(encryptionIv);

  const encryptionSalt = new Uint8Array(32);
  crypto.getRandomValues(encryptionSalt);

  // Generate file nonce prefix
  const fileNoncePrefix = new Uint8Array(16);
  crypto.getRandomValues(fileNoncePrefix);

  // Handle conflict resolution
  let actualFile = file;
  let keepBothCounter = 0; // Track how many keepBoth conflicts we've seen

  if (conflictResolution === 'keepBoth') {
    // Generate a unique filename by incrementing a counter
    // If a conflicting filename was provided, extract its counter and increment
    let counter = 1;

    // Extract base name and extension
    let baseName = file.name;
    let extension = '';
    const lastDotIndex = file.name.lastIndexOf('.');
    if (lastDotIndex > 0) {
      baseName = file.name.substring(0, lastDotIndex);
      extension = file.name.substring(lastDotIndex);
    }

    // Check if baseName ends with (number) and extract counter
    const counterMatch = baseName.match(/\((\d+)\)$/);
    if (counterMatch) {
      // Remove the (number) from baseName
      baseName = baseName.substring(0, baseName.lastIndexOf('(')).trim();
      keepBothCounter = parseInt(counterMatch[1]) + 1;
      counter = keepBothCounter;
    } else if (conflictFileName) {
      // If no counter in current name but conflictFileName provided, extract from it
      const conflictBase = conflictFileName.replace(/\.[^/.]+$/, '');
      const conflictCounterMatch = conflictBase.match(/\((\d+)\)$/);
      if (conflictCounterMatch) {
        keepBothCounter = parseInt(conflictCounterMatch[1]) + 1;
        counter = keepBothCounter;
      } else {
        keepBothCounter = 1;
      }
    }

    // Generate candidate name with the calculated counter
    const candidateName = `${baseName} (${counter})${extension}`;

    actualFile = new File([file], candidateName, { type: file.type });
  } else if (conflictResolution === 'replace') {
    // For replace, the backend will handle deletion
  }

  // ENCRYPT FILENAME - ZERO-KNOWLEDGE METADATA
  // Get master key from cache to encrypt filename
  let encryptedFilename: string;
  let filenameSalt: string;

  try {
    const masterKey = masterKeyManager.getMasterKey();
    console.log('Master key retrieved for filename encryption');

    const encrypted = await encryptFilename(actualFile.name, masterKey);
    encryptedFilename = encrypted.encryptedFilename;
    filenameSalt = encrypted.filenameSalt;

    // Validate encryption happened
    if (!encryptedFilename || !encryptedFilename.includes(':')) {
      throw new Error(`Invalid encrypted filename format - missing nonce separator. Got: ${encryptedFilename}`);
    }
    if (!filenameSalt) {
      throw new Error('Missing filename salt after encryption');
    }
  } catch (error) {
    console.error('CRITICAL: Filename encryption failed:', error);
    throw new Error(`Failed to encrypt filename: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Generate canonical manifest & signatures for the file (AFTER filename encryption)
  // Build canonical manifest in the same shape and key order as backend verification expects
  const manifestCreatedAt = Math.floor(Date.now() / 1000);
  const canonicalManifest = {
    filename: encryptedFilename, // Use encrypted filename for manifest verification (matches database)
    size: actualFile.size,
    mimeType: actualFile.type || 'application/octet-stream',
    shaHash: shaHash,
    created: manifestCreatedAt,
    version: '2.0-file',
    algorithmVersion: 'v3-hybrid-pqc-xchacha20'
  };

  // Compute canonical JSON and SHA-512 hash (manifest hash)
  const manifestJson = JSON.stringify(canonicalManifest);
  const manifestBytes = new TextEncoder().encode(manifestJson);
  const { sha512 } = await import('@noble/hashes/sha2.js');
  const manifestHash = sha512(manifestBytes);
  const manifestHashHex = Array.from(new Uint8Array(manifestHash)).map(b => b.toString(16).padStart(2, '0')).join('');
  const manifestHashBuffer = new Uint8Array(manifestHash);

  // Sign the manifest HASH (not the raw canonical manifest JSON)
  const { sign: ed25519Sign } = await import('@noble/ed25519');
  const ed25519Signature = await ed25519Sign(new Uint8Array(manifestHashBuffer), keys.keypairs.ed25519PrivateKey);
  const manifestSignatureEd25519 = btoa(String.fromCharCode(...new Uint8Array(ed25519Signature)));

  // Sign the manifest HASH with Dilithium
  const { ml_dsa65 } = await import('@noble/post-quantum/ml-dsa.js');
  const dilithiumSignature = ml_dsa65.sign(keys.keypairs.dilithiumPrivateKey, new Uint8Array(manifestHashBuffer));
  const manifestSignatureDilithium = btoa(String.fromCharCode(...new Uint8Array(dilithiumSignature)));

  // WRAP CEK USING KYBER POST-QUANTUM ENCRYPTION
  // Generate Kyber keypair and encapsulate to get shared secret
  const { ml_kem768 } = await import('@noble/post-quantum/ml-kem.js');
  const kyberPublicKeyBytes = hexToUint8Array(keys.keypairs.kyberPublicKey);

  // Encapsulate: generate shared secret and ciphertext using the recipient's public key
  const kyberStart = performance.now();
  const kyberEncapsulation = ml_kem768.encapsulate(kyberPublicKeyBytes);
  const kyberEnd = performance.now();
  PerformanceTracker.trackCryptoOp('kyber.encapsulate', Math.round(kyberEnd - kyberStart));

  const kyberSharedSecret = new Uint8Array(kyberEncapsulation.sharedSecret);
  const kyberCiphertext = new Uint8Array(kyberEncapsulation.cipherText); // Note: cipherText not ciphertext

  // Encrypt CEK using the Kyber shared secret with XChaCha20-Poly1305
  const { encryptData } = await import('./crypto');
  const cekEncryption = encryptData(keys.cek, kyberSharedSecret);

  // COMPUTE FILENAME HMAC FOR DUPLICATE DETECTION (ZERO-KNOWLEDGE)
  const filenameHmac = await computeFilenameHmac(actualFile.name, folderId);

  const response = await apiClient.initializeUploadSession({
    encryptedFilename: encryptedFilename,
    filenameSalt: filenameSalt,
    mimetype: actualFile.type || 'application/octet-stream',
    fileSize: actualFile.size,
    chunkCount: chunks.length,
    shaHash: shaHash,
    chunks: chunkHashes.map((hash, index) => ({
      index,
      sha256: hash,
      size: chunks[index].encryptedSize,
      // Compression metadata per chunk
      isCompressed: chunks[index].isCompressed,
      compressionAlgorithm: chunks[index].compressionAlgorithm,
      compressionOriginalSize: chunks[index].compressionOriginalSize,
      compressionCompressedSize: chunks[index].compressionCompressedSize,
      compressionRatio: chunks[index].compressionRatio
    })),
    encryptionIv: uint8ArrayToHex(encryptionIv),
    encryptionSalt: uint8ArrayToHex(encryptionSalt),
    dataEncryptionKey: uint8ArrayToHex(keys.cek),
    wrappedCek: cekEncryption.encryptedData, // XChaCha20-Poly1305 encrypted CEK with Kyber
    fileNoncePrefix: uint8ArrayToHex(fileNoncePrefix),
    folderId,
    manifestHash: manifestHashHex, // SHA512 hash of canonical manifest JSON
    manifestSignatureEd25519,
    manifestPublicKeyEd25519: keys.keypairs.ed25519PublicKey,
    manifestSignatureDilithium,
    manifestPublicKeyDilithium: keys.keypairs.dilithiumPublicKey,
    manifestCreatedAt, // Pass timestamp to backend for storage and verification
    algorithmVersion: 'v3-hybrid-pqc',
    nonceWrapKyber: cekEncryption.nonce, // Nonce for Kyber CEK encryption
    kyberCiphertext: uint8ArrayToHex(kyberCiphertext), // Kyber encapsulation ciphertext
    kyberPublicKey: keys.keypairs.kyberPublicKey,
    nameHmac: filenameHmac,  // Add filename HMAC for duplicate detection
    forceReplace: conflictResolution === 'replace',  // Add force replace flag
    existingFileIdToDelete: existingFileIdToDelete,  // Pass the file ID to delete
    isKeepBothAttempt: isKeepBothAttempt === true,  // Flag for keepBoth retry
    clientFileId: clientFileId  // Pass client-generated fileId for idempotency
  });

  if (!response.success) {
    // Check if this is a conflict error (409)
    if (response.error && (response.error.includes('already exists') || response.error.includes('409') || response.error === 'A file with this name already exists in the destination folder')) {
      // Throw a special conflict error that can be caught by the UI
      interface ConflictInfo {
        type: 'file' | 'folder';
        name: string;
        existingPath: string;
        newPath: string;
        folderId: string | null;
        existingFileId?: string;
        isKeepBothConflict?: boolean;
      }

      const conflictError = new Error('FILE_CONFLICT') as Error & { conflictInfo?: ConflictInfo };
      conflictError.conflictInfo = {
        type: 'file',
        name: actualFile.name,
        existingPath: folderId ? `Folder ${folderId}` : 'My Files',
        newPath: folderId ? `Folder ${folderId}` : 'My Files',
        folderId: folderId,
        existingFileId: response.data?.existingFileId, // Get existing file ID from backend response
        isKeepBothConflict: response.data?.isKeepBothConflict === true // Flag for retry handling
      };
      throw conflictError;
    }
    throw new Error('Failed to initialize upload session: ' + (response.error || 'Unknown error'));
  }  // Extract upload URLs from presigned array
  // The response.data contains the nested object with presigned array
  const presignedEntries = response.data?.presigned || [];

  // Only throw if we expected chunks but got no entries
  if (!presignedEntries || (chunks.length > 0 && presignedEntries.length === 0)) {
    console.error('Failed to extract presigned entries from response:', response);
    throw new Error('No presigned URLs returned from server');
  }

  if (!response.data?.sessionId || !response.data?.fileId) {
    throw new Error('Missing sessionId or fileId in response');
  }

  // Build a map of index -> presigned entry (keeps md5/sha/etc for headers decisions)
  const uploadUrlsMap: Record<number, { putUrl: string; md5?: string; objectKey?: string; sha256?: string; size?: number }> = {};
  for (const e of presignedEntries) {
    uploadUrlsMap[e.index] = { putUrl: e.putUrl, md5: e.md5, objectKey: e.objectKey, sha256: e.sha256, size: e.size };
  }

  return {
    sessionId: response.data.sessionId,
    fileId: response.data.fileId,
    uploadUrlsMap,
    thumbnailPutUrl: response.data.thumbnailPutUrl,
    chunks,
    chunkHashes,
    encryptedFilename,
    filenameSalt,
    manifestCreatedAt  // Pass timestamp to finalizeUpload for consistent manifest hash
  };
}

/**
 * Confirm chunk uploads with backend before finalization
 */
async function confirmChunkUploads(
  sessionId: string,
  chunks: ChunkInfo[],
  chunkHashes: string[]
): Promise<{ totalChunks: number; confirmedChunks: number; failedChunks: number; results: Array<{ index: number; success: boolean; size?: number; objectKey?: string; error?: string }> }> {
  const confirmationData = chunks.map((chunk, index) => ({
    index: chunk.index,
    chunkSize: chunk.encryptedSize,
    sha256Hash: chunkHashes[index],
    nonce: chunk.nonce,
    // Compression metadata
    isCompressed: chunk.isCompressed,
    compressionAlgorithm: chunk.compressionAlgorithm,
    compressionOriginalSize: chunk.compressionOriginalSize,
    compressionCompressedSize: chunk.compressionCompressedSize,
    compressionRatio: chunk.compressionRatio,
    // Diagnostics
    attempts: (chunk as any).attempts || 0,
    lastError: (chunk as any).lastError || null
  }));


  const response = await apiClient.confirmChunkUploads(sessionId, {
    chunks: confirmationData
  });

  if (!response.success || !response.data) {
    throw new Error('Failed to confirm chunk uploads');
  }

  // Return the server response to allow caller to retry missing chunks if needed
  return response.data;
}
async function finalizeUpload(
  sessionId: string,
  fileId: string,
  file: File,
  shaHash: string | null,
  keys: UserKeys,
  folderId: string | null = null,
  encryptedFilename?: string,
  filenameSalt?: string,
  manifestCreatedAt?: number,
  thumbnailData?: string,
  width?: number,
  height?: number,
  duration?: number
): Promise<UploadResult> {
  // Regenerate manifest data for finalization (must match initializeUploadSession exactly)
  // Use the timestamp from initializeUploadSession to ensure consistent manifest hash
  const manifestCreatedAtFinal = manifestCreatedAt || Math.floor(Date.now() / 1000);
  const manifestData = {
    filename: encryptedFilename, // Use encrypted filename (matches initializeUploadSession)
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    shaHash,
    created: manifestCreatedAtFinal,
    version: '2.0-file',
    algorithmVersion: 'v3-hybrid-pqc-xchacha20'
  };

  // Compute SHA512 hash of manifest (same as initializeUploadSession)
  const manifestJson = JSON.stringify(manifestData);
  const manifestBytes = new TextEncoder().encode(manifestJson);
  const { sha512 } = await import('@noble/hashes/sha2.js');
  const manifestHash = sha512(manifestBytes);
  const manifestHashBuffer = new Uint8Array(manifestHash);

  // Sign the manifest HASH (not the raw JSON) - same as initializeUploadSession
  const { sign: ed25519Sign } = await import('@noble/ed25519');
  const ed25519Signature = await ed25519Sign(manifestHashBuffer, keys.keypairs.ed25519PrivateKey);
  const manifestSignature = btoa(String.fromCharCode(...new Uint8Array(ed25519Signature)));

  // Sign the manifest HASH with Dilithium
  const { ml_dsa65 } = await import('@noble/post-quantum/ml-dsa.js');
  const dilithiumSignature = ml_dsa65.sign(keys.keypairs.dilithiumPrivateKey, manifestHashBuffer);
  const manifestSignatureDilithium = btoa(String.fromCharCode(...new Uint8Array(dilithiumSignature)));

  const response = await apiClient.finalizeUpload(sessionId, {
    finalShaHash: shaHash,
    manifestSignature,
    manifestPublicKey: keys.keypairs.ed25519PublicKey,
    manifestSignatureDilithium,
    manifestPublicKeyDilithium: keys.keypairs.dilithiumPublicKey,
    manifestCreatedAt: manifestCreatedAtFinal,
    algorithmVersion: 'v3-hybrid-pqc',
    thumbnailData,
    width,
    height,
    duration
  }, fileId);

  if (!response.success || !response.data) {
    // If server returned structured details (B2 verification failure), include that in the thrown error for UI
    const details = response.data || (response.error ? response.error : null);
    throw new Error(`Failed to finalize upload${details ? `: ${JSON.stringify(details)}` : ''}`);
  }

  return {
    fileId: response.data.fileId,
    sessionId,
    metadata: {
      filename: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      shaHash,
      wrappedCek: '', // TODO: Implement CEK wrapping
      cekNonce: ''   // TODO: Implement CEK wrapping
    },
    chunks: [], // Chunks info not needed in final result
    file: {
      id: response.data.fileId,
      name: file.name,
      encryptedFilename,
      filenameSalt,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      folderId,
      type: 'file' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      shaHash,
      is_shared: false
    }
  };
}
/**
 * Uploads a media asset for a paper.
 * Uses simplified encryption (single chunk, Master Key) and dedicated API.
 */
export async function uploadEncryptedPaperAsset(
  paperId: string,
  file: File,
  onProgress: (progress: UploadProgress) => void
): Promise<UploadResult> {
  try {
    const masterKey = await masterKeyManager.getMasterKey();
    if (!masterKey) throw new Error("Account Master Key not found");

    onProgress({ stage: 'encrypting', overallProgress: 5 });

    const fileBuffer = await file.arrayBuffer();
    const data = new Uint8Array(fileBuffer);

    // Encrypt using Worker via PaperService
    const { encryptedData, nonce } = await paperService.encryptAsset(data, masterKey);
    const ciphertext = encryptedData; // naming compatibility with rest of function

    onProgress({ stage: 'encrypting', overallProgress: 15 });

    const nonceBase64 = btoa(String.fromCharCode(...nonce));

    onProgress({ stage: 'uploading', overallProgress: 20 });

    // Calculate MD5 for B2 Object Lock (required)
    const md5Hasher = await createMD5();
    md5Hasher.init();
    md5Hasher.update(ciphertext);
    const md5Bytes = md5Hasher.digest('binary') as Uint8Array;
    const md5Base64 = btoa(String.fromCharCode(...Array.from(md5Bytes)));

    // Initialize Upload
    const response = await apiClient.initializePaperAssetUpload({
      paperId,
      filename: file.name,
      size: ciphertext.byteLength,
      contentType: file.type || 'application/octet-stream',
      contentMd5: md5Base64,
      encryptionMetadata: {
        nonce: nonceBase64,
        algo: 'xchacha20-poly1305'
      }
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to initialize asset upload');
    }

    const { uploadUrl, assetId } = response.data;
    onProgress({ stage: 'uploading', overallProgress: 25 });

    // Upload to B2 (Ciphertext only)
    const xhr = new XMLHttpRequest();
    await new Promise<void>((resolve, reject) => {
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.setRequestHeader('Content-MD5', md5Base64);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          // Map 0-100% of upload to 25-95% overall
          const percent = (e.loaded / e.total) * 70;
          onProgress({ stage: 'uploading', overallProgress: 25 + percent });
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed with status ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(ciphertext as any);
    });

    onProgress({ stage: 'finalizing', overallProgress: 100 });

    return {
      fileId: assetId,
      assetId: assetId,
      sessionId: 'paper-' + assetId,
      metadata: {
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        shaHash: null,
        wrappedCek: '',
        cekNonce: ''
      },
      chunks: []
    };
  } catch (error) {
    console.error("Paper asset upload failed:", error);
    throw error;
  }
}
