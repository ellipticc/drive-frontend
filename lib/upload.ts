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
import { encryptData, uint8ArrayToHex, hexToUint8Array, encryptFilename, computeFilenameHmac } from './crypto';
import { keyManager } from './key-manager';
import { masterKeyManager } from './master-key';
import { createBLAKE3 } from 'hash-wasm';
import { compressChunk, CompressionAlgorithm, CompressionMetadata } from './compression';

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
  shaHash: string;
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
  manifestCreatedAt?: number; // Timestamp for consistent manifest hash computation
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
    shaHash: string;
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
  isPaused?: () => boolean,
  conflictResolution?: 'replace' | 'keepBoth' | 'skip',
  conflictFileName?: string, // The conflicting filename to extract counter from
  existingFileIdToDelete?: string, // For replace operations
  isKeepBothAttempt?: boolean // Flag to indicate this is a keepBoth retry
): Promise<UploadResult> {
  // Generate fileId once at the start - this will be used as the idempotency key for finalization
  const fileId = crypto.randomUUID();

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

    // Stage 1: Compute SHA-512 hash of entire file (primary hash algorithm)
    onProgress?.({ stage: 'hashing', overallProgress: 0 });
    const shaHash = await computeFileHash(file); // Only compute SHA-512 for new files
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

    // Stage 3: Process each chunk (encrypt + hash) with improved UI responsiveness
    const processedChunks: ChunkInfo[] = [];
    const encryptedChunks: Uint8Array[] = [];
    let totalProcessedBytes = 0;

    // Use a Worker pool for parallel encryption (up to 4 chunks at a time)
    const maxConcurrentChunks = Math.min(4, chunks.length);
    const chunkProcessingQueue: Promise<{ chunk: Uint8Array; encryptedData: Uint8Array; nonce: string; hash: string; index: number; compression: CompressionMetadata }>[] = [];

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
      const chunkIndex = i;

      // Report progress for starting to process this chunk
      onProgress?.({
        stage: 'encrypting',
        overallProgress: 20 + (i / chunks.length) * 30,
        currentChunk: i,
        totalChunks: chunks.length,
        bytesProcessed: totalProcessedBytes,
        totalBytes: file.size
      });

      // Process chunk asynchronously to allow UI updates
      const chunkPromise = (async () => {
        try {
          // STAGE 3A: Compress chunk (if beneficial)
          onProgress?.({
            stage: 'compressing',
            overallProgress: 20 + (i / chunks.length) * 10,
            currentChunk: i,
            totalChunks: chunks.length
          });

          const compressionResult = await compressChunk(chunk);
          const dataToEncrypt = compressionResult.isCompressed ? compressionResult.data : chunk;

          // STAGE 3B: Encrypt compressed (or uncompressed) chunk
          const { encryptedData, nonce } = encryptChunk(dataToEncrypt, keys.cek);

          // Compute BLAKE3 hash of encrypted chunk
          const blake3Hash = await computeBLAKE3Hash(encryptedData);

          return {
            chunk,
            encryptedData,
            nonce,
            hash: blake3Hash,
            index: chunkIndex,
            compression: compressionResult
          };
        } catch (error) {
          console.error(`Failed to process chunk ${chunkIndex}:`, error);
          throw error;
        }
      })();

      chunkProcessingQueue.push(chunkPromise);

      // Yield control more frequently to prevent UI freezing
      if ((i + 1) % maxConcurrentChunks === 0 || i === chunks.length - 1) {
        // Wait for queued chunks to complete before continuing
        const completedChunks = await Promise.all(chunkProcessingQueue);
        
        for (const { chunk: originalChunk, encryptedData, nonce, hash, index, compression } of completedChunks) {
          processedChunks[index] = {
            index,
            size: originalChunk.byteLength,
            encryptedSize: encryptedData.byteLength,
            blake3Hash: hash,
            nonce,
            isCompressed: compression.isCompressed,
            compressionAlgorithm: compression.algorithm,
            compressionOriginalSize: compression.originalSize,
            compressionCompressedSize: compression.compressedSize,
            compressionRatio: compression.ratio
          };
          encryptedChunks[index] = encryptedData;
          totalProcessedBytes += originalChunk.byteLength;
        }

        chunkProcessingQueue.length = 0;

        // Yield to event loop to keep UI responsive
        await new Promise(resolve => {
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(resolve, { timeout: 10 }); // More aggressive yielding
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
    const session = await initializeUploadSession(file, folderId, processedChunks, encryptedChunks, shaHash, keys, conflictResolution, conflictFileName, existingFileIdToDelete, isKeepBothAttempt, fileId);

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
    const result = await finalizeUpload(session.sessionId, session.fileId, file, shaHash, keys, folderId, session.encryptedFilename, session.filenameSalt, session.manifestCreatedAt);

    onProgress?.({ stage: 'finalizing', overallProgress: 100 });

    return result;

  } catch (error) {
    // Check if this was a user cancellation
    if (abortSignal?.aborted) {
      throw new Error('Upload cancelled by user');
    }

    // Re-throw FILE_CONFLICT errors directly (don't wrap them)
    if (error instanceof Error && error.message === 'FILE_CONFLICT') {
      throw error;
    }

    // console.error('Upload failed:', error);
    throw new Error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Compute SHA-512 hash of entire file (primary hash algorithm for new files)
 * SHA-512 provides better security than SHA-256
 */
async function computeFileHash(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();

    // Compute SHA-512 (new standard for file integrity)
    const sha512Buffer = await crypto.subtle.digest('SHA-512', arrayBuffer);
    const sha512Hash = uint8ArrayToHex(new Uint8Array(sha512Buffer));

    return sha512Hash;
  } catch (error) {
    throw new Error(`Cannot read file "${file.name}": ${error instanceof Error ? error.message : String(error)}. The file may have been deleted or moved.`);
  }
}

/**
 * Compute SHA-256 and SHA-512 hashes of entire file
 * DEPRECATED: Only used for legacy compatibility - new files use computeFileHash()
 * Kept for backward compatibility with existing code that might need both hashes
 */
async function computeFileHashes(file: File): Promise<{ sha256: string; sha512: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Compute SHA-256 (for backward compatibility)
    const sha256Buffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const sha256Hash = uint8ArrayToHex(new Uint8Array(sha256Buffer));
    
    // Compute SHA-512 (new standard)
    const sha512Buffer = await crypto.subtle.digest('SHA-512', arrayBuffer);
    const sha512Hash = uint8ArrayToHex(new Uint8Array(sha512Buffer));
    
    return { sha256: sha256Hash, sha512: sha512Hash };
  } catch (error) {
    throw new Error(`Cannot read file "${file.name}": ${error instanceof Error ? error.message : String(error)}. The file may have been deleted or moved.`);
  }
}

/**
 * Compute SHA-256 hash of entire file
 * DEPRECATED: Only used for legacy compatibility - new files use computeFileHash() for SHA-512
 * Kept for backward compatibility with existing code
 */
async function computeFileSHA256(file: File): Promise<string> {
  const { sha256 } = await computeFileHashes(file);
  return sha256;
}

/**
 * Split file into chunks of CHUNK_SIZE
 * Includes retry logic for transient file access errors
 */
async function splitFileIntoChunks(file: File): Promise<Uint8Array[]> {
  const chunks: Uint8Array[] = [];
  const fileSize = file.size;
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 100;

  // Validate file accessibility before starting
  try {
    const testChunk = file.slice(0, Math.min(1024, fileSize));
    await testChunk.arrayBuffer();
  } catch (error) {
    throw new Error(`File "${file.name}" is no longer accessible. It may have been deleted or moved during upload.`);
  }

  for (let offset = 0; offset < fileSize; offset += CHUNK_SIZE) {
    const chunkSize = Math.min(CHUNK_SIZE, fileSize - offset);
    let lastError: Error | null = null;

    // Retry logic for reading chunks
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const chunk = file.slice(offset, offset + chunkSize);

        // Convert blob to Uint8Array
        const arrayBuffer = await chunk.arrayBuffer();
        chunks.push(new Uint8Array(arrayBuffer));
        break; // Success, move to next chunk
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // If it's a file accessibility error, give it a moment and retry
        if (error instanceof Error && (
          error.message.includes('could not be found') ||
          error.message.includes('no longer accessible') ||
          error.message.includes('ENOENT')
        )) {
          if (attempt < MAX_RETRIES - 1) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
            continue;
          }
        }
        
        // For other errors, fail immediately
        throw new Error(`Failed to read file chunk at offset ${offset}: ${lastError.message}`);
      }
    }

    if (lastError && chunks.length === Math.floor(offset / CHUNK_SIZE)) {
      throw new Error(`Failed to read file "${file.name}" after ${MAX_RETRIES} attempts: ${lastError.message}`);
    }
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
  shaHash: string,
  keys: UserKeys,
  conflictResolution?: 'replace' | 'keepBoth' | 'skip',
  conflictFileName?: string,
  existingFileIdToDelete?: string,
  isKeepBothAttempt?: boolean,
  clientFileId?: string
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
  const kyberEncapsulation = ml_kem768.encapsulate(kyberPublicKeyBytes);
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

  if (!uploadUrls || uploadUrls.length === 0) {
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
    chunks,
    chunkHashes,
    encryptedFilename,
    filenameSalt,
    manifestCreatedAt  // Pass timestamp to finalizeUpload for consistent manifest hash
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

      const response = await fetch(uploadUrls[index], {
        method: 'PUT',
        body: new Blob([new Uint8Array(encryptedChunk)]),
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        signal: abortSignal, // Pass abort signal to fetch
        credentials: 'omit'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        // console.error(`Upload failed for chunk ${index}: ${response.status} - ${errorText}`);
        throw new Error(`Upload failed for chunk ${index}: ${response.status} - ${errorText}`);
      }

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
          throw error;
        } else if (error.message === 'Upload paused') {
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

  const { confirmedChunks, failedChunks, totalChunks } = response.data;

  if (failedChunks > 0) {
    throw new Error(`${failedChunks} chunks failed confirmation`);
  }
}
async function finalizeUpload(
  sessionId: string,
  fileId: string,
  file: File,
  shaHash: string,
  keys: UserKeys,
  folderId: string | null = null,
  encryptedFilename?: string,
  filenameSalt?: string,
  manifestCreatedAt?: number
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
    algorithmVersion: 'v3-hybrid-pqc'
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

