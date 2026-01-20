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
import { PerformanceTracker } from './performance-tracker';
import { encryptData, uint8ArrayToHex, hexToUint8Array, encryptFilename, computeFilenameHmac } from './crypto';
import { keyManager } from './key-manager';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { createMD5 } from 'hash-wasm';
import { masterKeyManager } from './master-key';
import { CompressionAlgorithm, CompressionMetadata } from './compression';
import { generateThumbnail } from './thumbnail';
import { WorkerPool } from './worker-pool';

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
}

export interface UploadSession {
  sessionId: string;
  uploadUrls: string[];
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

// Configuration
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks (configurable)

/**
 * Process a chunk in the Unified Web Worker
 */
const processChunkInWorker = (chunk: Uint8Array, key: Uint8Array, index: number): Promise<{ encryptedData: Uint8Array; nonce: string; hash: string; md5: string; index: number; compression: CompressionMetadata }> => {
  const chunkBuffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);

  return getUploadWorkerPool().execute({
    type: 'process_chunk',
    id: index,
    chunk: new Uint8Array(chunkBuffer),
    key,
    index
  }, [chunkBuffer]);
};

/**
 * Compute SHA-512 Hash in Worker to avoid UI freeze.
 * Updated to stream file in worker using FileReaderSync (supports 5GB+ files).
 */
const computeFileHashInWorker = async (file: File): Promise<string> => {
  // Use a unique ID for hashing tasks to avoid collisions if multiple hashes run
  const id = `hash-${crypto.randomUUID()}`;
  return getUploadWorkerPool().execute({
    type: 'hash_file',
    id,
    file
  });
};

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
  const fileId = resumeState?.fileId || crypto.randomUUID();

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
    const concurrency = 4;

    for (let i = 0; i < chunks.length; i++) {
      // Skip if already processed
      if (processedChunks[i]) continue;

      // Check triggers
      if (abortSignal?.aborted) throw new Error('Upload cancelled');
      if (isPaused?.()) throw new Error('Upload paused');

      // Flow Control
      while (activeTasks.size >= concurrency) {
        await Promise.race(activeTasks);
      }

      const task = (async () => {
        try {
          // 1. Read (Lazy Load from Disk)
          // This ensures we only hold ~16MB in memory (4 chunks * 4MB)
          const range = chunks[i];
          const chunkBlob = file.slice(range.start, range.end);
          const chunkData = new Uint8Array(await chunkBlob.arrayBuffer());

          // 2. Process (Worker Offload)
          const processed = await processChunkInWorker(chunkData, keys.cek, i);

          // 3. Upload (Streaming Network Request)
          // Upload encrypted data immediately and discard it to free memory
          const uploadUrl = session.uploadUrls[i];
          const response = await fetch(uploadUrl, {
            method: 'PUT',
            body: new Blob([new Uint8Array(processed.encryptedData)]),
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-MD5': processed.md5 // Required for Object Lock
            },
            signal: abortSignal,
            credentials: 'omit'
          });

          if (!response.ok) {
            const txt = await response.text();
            throw new Error(`Upload failed for chunk ${i}: ${response.status} - ${txt}`);
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
            compressionRatio: processed.compression.ratio
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

    // Update Session with REAL hashes for finalization
    session.chunkHashes = chunkHashes;
    session.chunks = processedChunks;

    // Stage 6: Confirm chunk uploads with backend
    await confirmChunkUploads(session.sessionId, processedChunks, session.chunkHashes);

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
 * Supports 5GB+ files with minimal memory usage.
 */
function splitFileIntoChunks(file: File): { start: number; end: number }[] {
  const chunks: { start: number; end: number }[] = [];
  const fileSize = file.size;

  for (let offset = 0; offset < fileSize; offset += CHUNK_SIZE) {
    chunks.push({
      start: offset,
      end: Math.min(offset + CHUNK_SIZE, fileSize)
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
  const uploadUrls = response.data?.presigned?.map(item => item.putUrl);

  // Only throw if we expected chunks but got no URLs
  if (!uploadUrls || (chunks.length > 0 && uploadUrls.length === 0)) {
    console.error('Failed to extract upload URLs from response:', response);
    throw new Error('No presigned URLs returned from server');
  }

  if (!response.data?.sessionId || !response.data?.fileId) {
    throw new Error('Missing sessionId or fileId in response');
  }

  return {
    sessionId: response.data.sessionId,
    fileId: response.data.fileId,
    uploadUrls,
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
): Promise<void> {
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
    compressionRatio: chunk.compressionRatio
  }));


  const response = await apiClient.confirmChunkUploads(sessionId, {
    chunks: confirmationData
  });

  if (!response.success || !response.data) {
    throw new Error('Failed to confirm chunk uploads');
  }

  if (response.data.failedChunks > 0) {
    throw new Error(`${response.data.failedChunks} chunks failed confirmation`);
  }
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
    throw new Error('Failed to finalize upload');
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
    const nonce = crypto.getRandomValues(new Uint8Array(24));

    // Encrypt using XChaCha20-Poly1305
    const ciphertext = xchacha20poly1305(masterKey, nonce).encrypt(data);
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
