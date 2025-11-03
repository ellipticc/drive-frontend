/**
 * Secure File Upload Pipeline for Hybrid PQC End-to-End Encrypted Storage
 *
 * This module implements a complete browser-side file upload flow with:
 * - SHA-256 file hashing
 * - File chunking (4-8MB chunks)
 * - XChaCha20-Poly1305 encryption per chunk
 * - BLAKE3 integrity hashing per encrypted chunk
 * - Streaming uploads to Backblaze B2 via presigned URLs
 * - Progress callbacks and resumable uploads
 */

import { apiClient } from './api';
import { encryptData, uint8ArrayToHex, hexToUint8Array } from './crypto';
import { keyManager } from './key-manager';
import { createBLAKE3 } from 'hash-wasm';

// Types and interfaces
export interface UploadProgress {
  stage: 'hashing' | 'chunking' | 'encrypting' | 'uploading' | 'finalizing';
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
  sha256Hash: string;
  wrappedCek: string;
  cekNonce: string;
  // PQC wrappers would be added here
}

export interface ChunkInfo {
  index: number;
  size: number;
  encryptedSize: number;
  blake3Hash: string;
  nonce: string;
}

export interface UploadSession {
  sessionId: string;
  uploadUrls: string[];
  chunks: ChunkInfo[];
  fileId: string;
  chunkHashes: string[]; // SHA256 hashes of encrypted chunks
  encryptedFilename?: string;
  filenameSalt?: string;
}

export interface UploadResult {
  fileId: string;
  sessionId: string;
  metadata: FileMetadata;
  chunks: ChunkInfo[];
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
    sha256Hash: string;
    is_shared: boolean;
  };
}

// Configuration
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks (configurable)

/**
 * Main upload function - orchestrates the entire secure upload pipeline
 */
export async function uploadEncryptedFile(
  file: File,
  folderId: string | null = null,
  userKeys?: UserKeys,
  onProgress?: (progress: UploadProgress) => void,
  abortSignal?: AbortSignal,
  isPaused?: () => boolean
): Promise<UploadResult> {
  try {
    // 🔒 STRICT QUOTA ENFORCEMENT: Check storage quota BEFORE starting upload
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

    console.log(`✅ Quota check passed: ${Math.round(file.size / (1024 * 1024))}MB file can be uploaded`);

    // Get user keys from KeyManager if not provided
    const keys = userKeys || await keyManager.getUserKeys();

    // Check for abort before starting
    if (abortSignal?.aborted) {
      throw new Error('Upload cancelled');
    }

    // Stage 1: Compute SHA-256 hash of entire file
    onProgress?.({ stage: 'hashing', overallProgress: 0 });
    const sha256Hash = await computeFileSHA256(file);
    onProgress?.({ stage: 'hashing', overallProgress: 10 });

    // Check for abort after hashing
    if (abortSignal?.aborted) {
      throw new Error('Upload cancelled');
    }

    // Stage 2: Split file into chunks
    onProgress?.({ stage: 'chunking', overallProgress: 15 });
    const chunks = await splitFileIntoChunks(file);
    onProgress?.({ stage: 'chunking', overallProgress: 20, totalChunks: chunks.length });

    // Check for abort after chunking
    if (abortSignal?.aborted) {
      throw new Error('Upload cancelled');
    }

    // Stage 3: Process each chunk (encrypt + hash) sequentially with UI breathing room
    const processedChunks: ChunkInfo[] = [];
    const encryptedChunks: Uint8Array[] = [];
    let totalProcessedBytes = 0;

    // Process chunks sequentially to keep UI responsive
    for (let i = 0; i < chunks.length; i++) {
      // Check for abort before processing each chunk
      if (abortSignal?.aborted) {
        throw new Error('Upload cancelled');
      }

      // Check if upload is paused
      if (isPaused?.()) {
        throw new Error('Upload paused');
      }

      const chunk = chunks[i];
      onProgress?.({
        stage: 'encrypting',
        overallProgress: 20 + (i / chunks.length) * 30,
        currentChunk: i,
        totalChunks: chunks.length,
        bytesProcessed: totalProcessedBytes,
        totalBytes: file.size
      });

      // Encrypt chunk directly (no compression)
      const { encryptedData, nonce } = encryptChunk(chunk, keys.cek);

      onProgress?.({
        stage: 'encrypting',
        overallProgress: 25 + (i / chunks.length) * 30,
        currentChunk: i,
        totalChunks: chunks.length
      });

      // Compute BLAKE3 hash of encrypted chunk
      const blake3Hash = await computeBLAKE3Hash(encryptedData);

      processedChunks.push({
        index: i,
        size: chunk.byteLength,
        encryptedSize: encryptedData.byteLength,
        blake3Hash,
        nonce
      });

      encryptedChunks.push(encryptedData);
      totalProcessedBytes += chunk.byteLength;

      // Yield control to UI thread every few chunks to prevent freezing
      if (i % 2 === 0 && i > 0) {
        await new Promise(resolve => {
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(resolve, { timeout: 16 }); // ~60fps
          } else {
            setTimeout(resolve, 0);
          }
        });
      }
    }

    onProgress?.({ stage: 'uploading', overallProgress: 50 });

    // Check for abort before initializing upload session
    if (abortSignal?.aborted) {
      throw new Error('Upload cancelled');
    }

    // Stage 4: Initialize upload session with backend
    const session = await initializeUploadSession(file, folderId, processedChunks, encryptedChunks, sha256Hash, keys);

    // Check for abort before uploading chunks
    if (abortSignal?.aborted) {
      throw new Error('Upload cancelled');
    }

    // Stage 5: Upload encrypted chunks to Backblaze B2
    await uploadChunksToB2(session.uploadUrls, processedChunks, encryptedChunks, onProgress, abortSignal, isPaused);

    onProgress?.({ stage: 'finalizing', overallProgress: 85 });

    // Check for abort before confirming chunks
    if (abortSignal?.aborted) {
      throw new Error('Upload cancelled');
    }

    // Stage 6: Confirm chunk uploads with backend
    await confirmChunkUploads(session.sessionId, processedChunks, session.chunkHashes);

    onProgress?.({ stage: 'finalizing', overallProgress: 90 });

    // Check for abort before finalizing
    if (abortSignal?.aborted) {
      throw new Error('Upload cancelled');
    }

    // Stage 7: Finalize upload
    const result = await finalizeUpload(session.sessionId, file, sha256Hash, keys, folderId, session.encryptedFilename, session.filenameSalt);

    onProgress?.({ stage: 'finalizing', overallProgress: 100 });

    return result;

  } catch (error) {
    // Check if this was a user cancellation
    if (abortSignal?.aborted) {
      throw new Error('Upload cancelled by user');
    }

    // console.error('Upload failed:', error);
    throw new Error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Compute SHA-256 hash of entire file using streaming approach
 */
async function computeFileSHA256(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return uint8ArrayToHex(new Uint8Array(hashBuffer));
}

/**
 * Split file into chunks of CHUNK_SIZE
 */
async function splitFileIntoChunks(file: File): Promise<Uint8Array[]> {
  const chunks: Uint8Array[] = [];
  const fileSize = file.size;

  for (let offset = 0; offset < fileSize; offset += CHUNK_SIZE) {
    const chunkSize = Math.min(CHUNK_SIZE, fileSize - offset);
    const chunk = file.slice(offset, offset + chunkSize);

    // Convert blob to Uint8Array
    const arrayBuffer = await chunk.arrayBuffer();
    chunks.push(new Uint8Array(arrayBuffer));
  }

  return chunks;
}

/**
 * Encrypt a chunk using XChaCha20-Poly1305
 */
function encryptChunk(chunk: Uint8Array, key: Uint8Array): { encryptedData: Uint8Array; nonce: string } {
  const result = encryptData(chunk, key);
  return {
    encryptedData: Uint8Array.from(atob(result.encryptedData), c => c.charCodeAt(0)),
    nonce: result.nonce
  };
}

/**
 * Compute BLAKE3 hash of data
 */
async function computeBLAKE3Hash(data: Uint8Array): Promise<string> {
  const hasher = await createBLAKE3();
  hasher.update(data);
  return hasher.digest('hex');
}

/**
 * Initialize upload session with backend
 */
async function initializeUploadSession(
  file: File,
  folderId: string | null,
  chunks: ChunkInfo[],
  encryptedChunks: Uint8Array[],
  sha256Hash: string,
  keys: UserKeys
): Promise<UploadSession> {
  // Compute SHA256 hashes for each encrypted chunk
  const chunkHashes: string[] = [];
  for (const encryptedChunk of encryptedChunks) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', new Uint8Array(encryptedChunk));
    const hashHex = uint8ArrayToHex(new Uint8Array(hashBuffer));
    chunkHashes.push(hashHex);
  }

  // Generate encryption metadata
  const encryptionIv = new Uint8Array(16);
  crypto.getRandomValues(encryptionIv);

  const encryptionSalt = new Uint8Array(32);
  crypto.getRandomValues(encryptionSalt);

  // Generate file nonce prefix
  const fileNoncePrefix = new Uint8Array(16);
  crypto.getRandomValues(fileNoncePrefix);

  // Generate manifest signatures for the file
  const manifestData = {
    filename: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    sha256Hash,
    created: Math.floor(Date.now() / 1000),
    version: '2.0-file',
    algorithmVersion: 'v3-hybrid-pqc-xchacha20'
  };

  const manifestJson = JSON.stringify(manifestData);
  const manifestBytes = new TextEncoder().encode(manifestJson);

  // Sign with Ed25519
  const { sign: ed25519Sign } = await import('@noble/ed25519');
  const ed25519Signature = await ed25519Sign(manifestBytes, keys.keypairs.ed25519PrivateKey);
  const manifestSignatureEd25519 = btoa(String.fromCharCode(...ed25519Signature));

  // Sign with Dilithium
  const { ml_dsa65 } = await import('@noble/post-quantum/ml-dsa.js');
  const dilithiumSignature = ml_dsa65.sign(keys.keypairs.dilithiumPrivateKey, manifestBytes);
  const manifestSignatureDilithium = btoa(String.fromCharCode(...new Uint8Array(dilithiumSignature)));

  // Generate PQC encryption parameters (Kyber KEM)
  const { ml_kem768 } = await import('@noble/post-quantum/ml-kem.js');

  // Standard KEM pattern: Generate random CEK, then encrypt it with Kyber
  const randomCek = keys.cek; // Use the CEK that was already generated by KeyManager

  // Encapsulate the CEK using user's Kyber public key
  const cekEncryptionResult = ml_kem768.encapsulate(hexToUint8Array(keys.keypairs.kyberPublicKey));
  const kyberCiphertext = uint8ArrayToHex(new Uint8Array(cekEncryptionResult.cipherText));

  // Encrypt the random CEK with the Kyber shared secret (additional layer)
  const { encryptData, encryptFilename } = await import('./crypto');
  const { masterKeyManager } = await import('./master-key');
  
  const cekEncryption = encryptData(randomCek, new Uint8Array(cekEncryptionResult.sharedSecret));
  const wrappedCek = cekEncryption.encryptedData; // Already hex string
  const cekNonce = cekEncryption.nonce;

  // 🔒 ENCRYPT FILENAME - ZERO-KNOWLEDGE METADATA
  // Get master key from cache to encrypt filename
  let encryptedFilename: string;
  let filenameSalt: string;
  
  try {
    const masterKey = masterKeyManager.getMasterKey();
    console.log('✅ Master key retrieved for filename encryption');
    
    const encrypted = await encryptFilename(file.name, masterKey);
    encryptedFilename = encrypted.encryptedFilename;
    filenameSalt = encrypted.filenameSalt;
    
    // Validate encryption happened
    if (!encryptedFilename || !encryptedFilename.includes(':')) {
      throw new Error(`Invalid encrypted filename format - missing nonce separator. Got: ${encryptedFilename}`);
    }
    if (!filenameSalt) {
      throw new Error('Missing filename salt after encryption');
    }
    
    console.log(`✅ Filename encrypted successfully: ${encryptedFilename.substring(0, 30)}...`);
    console.log(`✅ Filename salt: ${filenameSalt}`);
  } catch (error) {
    console.error('❌ CRITICAL: Filename encryption failed:', error);
    throw new Error(`Failed to encrypt filename: ${error instanceof Error ? error.message : String(error)}`);
  }

  const response = await apiClient.initializeUploadSession({
    encryptedFilename: encryptedFilename,
    filenameSalt: filenameSalt,
    mimetype: file.type || 'application/octet-stream',
    fileSize: file.size,
    chunkCount: chunks.length,
    sha256sum: sha256Hash,
    chunks: chunkHashes.map((hash, index) => ({
      index,
      sha256: hash,
      size: chunks[index].encryptedSize
    })),
    encryptionIv: uint8ArrayToHex(encryptionIv),
    encryptionSalt: uint8ArrayToHex(encryptionSalt),
    dataEncryptionKey: uint8ArrayToHex(randomCek),
    wrappedCek: wrappedCek, // Use Kyber-wrapped CEK
    fileNoncePrefix: uint8ArrayToHex(fileNoncePrefix),
    folderId,
    manifestSignatureEd25519,
    manifestPublicKeyEd25519: keys.keypairs.ed25519PublicKey,
    manifestSignatureDilithium,
    manifestPublicKeyDilithium: keys.keypairs.dilithiumPublicKey,
    algorithmVersion: 'v3-hybrid-pqc',
    wrappedCekKyber: wrappedCek,
    nonceWrapKyber: cekNonce,
    kyberCiphertext: kyberCiphertext,
    kyberPublicKey: keys.keypairs.kyberPublicKey
  });

  if (!response.success || !response.data) {
    throw new Error('Failed to initialize upload session');
  }

  // Extract upload URLs from presigned array
  const uploadUrls = response.data.presigned.map(item => item.putUrl);

  return {
    sessionId: response.data.sessionId,
    fileId: response.data.fileId,
    uploadUrls,
    chunks,
    chunkHashes,
    encryptedFilename,
    filenameSalt
  };
}

/**
 * Upload encrypted chunks to Backblaze B2 via presigned URLs
 */
async function uploadChunksToB2(
  uploadUrls: string[],
  chunks: ChunkInfo[],
  encryptedChunks: Uint8Array[],
  onProgress?: (progress: UploadProgress) => void,
  abortSignal?: AbortSignal,
  isPaused?: () => boolean
): Promise<void> {
  const totalChunks = chunks.length;
  let completedChunks = 0;

  // Upload chunks in parallel with concurrency control
  const concurrencyLimit = 6; // Upload up to 6 chunks simultaneously for better performance
  const semaphore = new Semaphore(concurrencyLimit);

  const uploadPromises = encryptedChunks.map(async (encryptedChunk, index) => {
    await semaphore.acquire();

    try {
      // Check for abort before starting each chunk upload
      if (abortSignal?.aborted) {
        throw new Error('Upload cancelled');
      }

      // Check if upload is paused
      if (isPaused?.()) {
        throw new Error('Upload paused');
      }

      // console.log(`🚀 Starting upload for chunk ${index} to: ${uploadUrls[index]}`);
      const response = await fetch(uploadUrls[index], {
        method: 'PUT',
        body: new Blob([new Uint8Array(encryptedChunk)]),
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        signal: abortSignal // Pass abort signal to fetch
      });

      // console.log(`📤 Chunk ${index} upload response: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        // console.error(`❌ Upload failed for chunk ${index}: ${response.status} - ${errorText}`);
        throw new Error(`Upload failed for chunk ${index}: ${response.status} - ${errorText}`);
      }

      // console.log(`✅ Chunk ${index} uploaded successfully`);
      completedChunks++;
      onProgress?.({
        stage: 'uploading',
        overallProgress: 50 + (completedChunks / totalChunks) * 40,
        currentChunk: completedChunks,
        totalChunks,
        chunkProgress: 100
      });

      // Yield control briefly after each chunk to keep UI responsive
      if (completedChunks % 3 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }

    } catch (error) {
      // Handle different types of errors
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message === 'Upload cancelled') {
          // console.log(`⏹️ Upload cancelled for chunk ${index}`);
          throw error;
        } else if (error.message === 'Upload paused') {
          // console.log(`⏸️ Upload paused for chunk ${index}`);
          throw error;
        }
      }
      // console.error(`Failed to upload chunk ${index}:`, error);
      throw error;
    } finally {
      semaphore.release();
    }
  });

  await Promise.all(uploadPromises);
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
    nonce: chunk.nonce
  }));

  // console.log(`🔍 Confirming ${confirmationData.length} chunks for session ${sessionId}`);

  const response = await apiClient.confirmChunkUploads(sessionId, {
    chunks: confirmationData
  });

  if (!response.success || !response.data) {
    throw new Error('Failed to confirm chunk uploads');
  }

  const { confirmedChunks, failedChunks, totalChunks } = response.data;

  // console.log(`✅ Chunk confirmation complete: ${confirmedChunks}/${totalChunks} confirmed, ${failedChunks} failed`);

  if (failedChunks > 0) {
    // console.error('❌ Some chunks failed confirmation:', response.data.results.filter(r => !r.success));
    throw new Error(`${failedChunks} chunks failed confirmation`);
  }
}
async function finalizeUpload(
  sessionId: string,
  file: File,
  sha256Hash: string,
  keys: UserKeys,
  folderId: string | null = null,
  encryptedFilename?: string,
  filenameSalt?: string
): Promise<UploadResult> {
  // Regenerate manifest data for finalization
  const manifestCreatedAt = Math.floor(Date.now() / 1000);
  const manifestData = {
    filename: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    sha256Hash,
    created: manifestCreatedAt,
    version: '2.0-file',
    algorithmVersion: 'v3-hybrid-pqc-xchacha20'
  };

  const manifestJson = JSON.stringify(manifestData);
  const manifestBytes = new TextEncoder().encode(manifestJson);

  // Sign with Ed25519
  const { sign: ed25519Sign } = await import('@noble/ed25519');
  const ed25519Signature = await ed25519Sign(manifestBytes, keys.keypairs.ed25519PrivateKey);
  const manifestSignature = btoa(String.fromCharCode(...ed25519Signature));

  // Sign with Dilithium
  const { ml_dsa65 } = await import('@noble/post-quantum/ml-dsa.js');
  const dilithiumSignature = ml_dsa65.sign(keys.keypairs.dilithiumPrivateKey, manifestBytes);
  const manifestSignatureDilithium = btoa(String.fromCharCode(...new Uint8Array(dilithiumSignature)));

  const response = await apiClient.finalizeUpload(sessionId, {
    finalSha256: sha256Hash,
    manifestSignature,
    manifestPublicKey: keys.keypairs.ed25519PublicKey,
    manifestSignatureDilithium,
    manifestPublicKeyDilithium: keys.keypairs.dilithiumPublicKey,
    manifestCreatedAt,
    algorithmVersion: 'v3-hybrid-pqc'
  });

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
      sha256Hash,
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
      sha256Hash,
      is_shared: false
    }
  };
}

/**
 * Semaphore for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private waiting: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!;
      this.permits--;
      resolve();
    }
  }
}

