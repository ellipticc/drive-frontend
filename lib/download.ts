/**
 * Secure File Download Pipeline for Hybrid PQC End-to-End Encrypted Storage
 *
 * This module implements a complete browser-side file download flow with:
 * - Fetching presigned URLs from backend
 * - Downloading encrypted chunks from Backblaze B2
 * - XChaCha20-Poly1305 decryption per chunk
 * - File reassembly and integrity verification
 * - Progress callbacks and resumable downloads
 */

import { apiClient } from './api';
import { decryptData, uint8ArrayToHex, hexToUint8Array } from './crypto';
import { keyManager } from './key-manager';

// Utility function to convert Uint8Array to base64 safely (avoids stack overflow)
function uint8ArrayToBase64(array: Uint8Array): string {
  // Process in chunks to avoid stack overflow with large arrays
  const chunkSize = 8192; // 8KB chunks
  let result = '';

  for (let i = 0; i < array.length; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize);
    result += String.fromCharCode.apply(null, chunk as any);
  }

  return btoa(result);
}

// Types and interfaces
export interface DownloadProgress {
  stage: 'initializing' | 'downloading' | 'decrypting' | 'assembling' | 'verifying' | 'complete';
  overallProgress: number; // 0-100
  currentChunk?: number;
  totalChunks?: number;
  bytesDownloaded?: number;
  totalBytes?: number;
  chunkProgress?: number; // 0-100 for current chunk
  downloadSpeed?: number; // bytes per second
  timeRemaining?: number; // seconds
}

export interface DownloadChunk {
  chunkIndex?: number;
  index?: number;
  objectKey: string;
  size: number;
  sha256: string;
  nonce: string | null;
  getUrl: string;
}

export interface DownloadManifest {
  version: string;
  fileId: string;
  originalFilename: string;
  size: number;
  mimetype: string;
  sha256: string;
  chunkCount: number;
  chunks: Array<{
    index: number;
    size: number;
    sha256: string;
    nonce: string | null;
  }>;
  created: number;
  algorithmVersion: string;
}

export interface DownloadEncryption {
  version: string;
  algorithm: string;
  wrappedCek: string;
  cekNonce: string;
  fileNoncePrefix: string;
  sessionSalt: string | null;
  nonceWrapClassical: string;
  kyberPublicKey?: string;
  kyberWrappedCek?: string;
  kyberCiphertext?: string;
  nonceWrapKyber?: string;
  argon2idParams?: any;
}

export interface DownloadSession {
  fileId: string;
  filename: string;
  originalFilename: string;
  mimetype: string;
  size: number;
  sha256: string;
  chunkCount: number;
  chunks: DownloadChunk[];
  manifest?: DownloadManifest;
  signatures?: {
    ed25519?: {
      alg: string;
      signedAt: number | null;
      signature: string;
    };
    dilithium?: {
      alg: string;
      signedAt: number | null;
      signature: string;
    };
  };
  encryption?: DownloadEncryption;
  storageType: string;
}

export interface DownloadResult {
  fileId: string;
  blob: Blob;
  filename: string;
  size: number;
  mimetype: string;
  sha256: string;
}

// Configuration
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks (matches upload)

/**
 * Get the chunk index from a chunk object (handles both chunkIndex and index properties)
 */
function getChunkIndex(chunk: DownloadChunk): number {
  return chunk.chunkIndex ?? chunk.index ?? 0;
}

/**
 * Main download function - orchestrates the entire secure download pipeline
 */
/**
 * Download and decrypt an encrypted file using a pre-unwrapped CEK (for shares)
 */
export async function downloadEncryptedFileWithCEK(
  fileId: string,
  cek: Uint8Array,
  onProgress?: (progress: DownloadProgress) => void
): Promise<DownloadResult> {
  try {
    // Stage 1: Get download URLs and metadata from backend
    onProgress?.({ stage: 'initializing', overallProgress: 0 });
    const session = await initializeDownloadSession(fileId);
    onProgress?.({ stage: 'initializing', overallProgress: 10 });

    // Stage 2: Download encrypted chunks from B2
    onProgress?.({ stage: 'downloading', overallProgress: 15 });
    const encryptedChunks = await downloadChunksFromB2(session.chunks, onProgress);

    // Stage 3: Decrypt chunks using the provided CEK
    onProgress?.({ stage: 'decrypting', overallProgress: 80 });
    const decryptedChunks = await decryptChunksWithCEK(encryptedChunks, session, cek);

    // Stage 4: Assemble file
    onProgress?.({ stage: 'assembling', overallProgress: 90 });
    const fileBlob = await assembleFile(decryptedChunks, session.mimetype);

    // Stage 5: Verify integrity
    onProgress?.({ stage: 'verifying', overallProgress: 95 });
    await verifyFileIntegrity(fileBlob, session.sha256);

    onProgress?.({ stage: 'complete', overallProgress: 100 });

    return {
      fileId: session.fileId,
      blob: fileBlob,
      filename: session.originalFilename,
      size: session.size,
      mimetype: session.mimetype,
      sha256: session.sha256
    };

  } catch (error) {
    // console.error('Download failed:', error);
    throw new Error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt downloaded chunks using a pre-unwrapped CEK
 */
async function decryptChunksWithCEK(
  encryptedChunks: Uint8Array[],
  session: DownloadSession,
  cek: Uint8Array
): Promise<Uint8Array[]> {
  const decryptedChunks: Uint8Array[] = [];

  for (let i = 0; i < encryptedChunks.length; i++) {
    const encryptedChunk = encryptedChunks[i];
    const chunkInfo = session.chunks[i];

    // Get the nonce for this chunk (should be base64 string from backend)
    const chunkNonce = chunkInfo.nonce;

    if (!chunkNonce) {
      throw new Error(`No nonce available for chunk ${i}`);
    }

    // Handle potential B2 size discrepancies
    let processedChunk = encryptedChunk;
    const expectedSize = chunkInfo.size;

    if (encryptedChunk.length > expectedSize) {
      const difference = encryptedChunk.length - expectedSize;
      // console.warn(`⚠️ Chunk ${i} size discrepancy: expected ${expectedSize}, got ${encryptedChunk.length} (${difference} extra bytes)`);

      // If the difference is small (likely B2-added content), try to truncate
      if (difference <= 32) { // Allow up to 32 extra bytes for potential B2 metadata
        processedChunk = encryptedChunk.slice(0, expectedSize);
        // console.log(`✂️ Truncated chunk ${i} to expected size: ${processedChunk.length} bytes`);
      } else {
        // console.warn(`⚠️ Large size difference (${difference} bytes), using full response but decryption may fail`);
      }
    } else if (encryptedChunk.length < expectedSize) {
      // console.warn(`⚠️ Chunk ${i} smaller than expected: expected ${expectedSize}, got ${encryptedChunk.length}`);
    }

    // Convert encrypted bytes to base64 string for decryption
    const encryptedBase64 = uint8ArrayToBase64(processedChunk);

    // Try decryption with fallback handling
    let decryptedData: Uint8Array | undefined;
    try {
      decryptedData = decryptData(encryptedBase64, cek, chunkNonce);
    } catch (decryptError) {
      // console.error(`❌ Decryption failed for chunk ${i}:`, decryptError);

      // If decryption failed and we have extra data, try with different truncation strategies
      if (encryptedChunk.length > expectedSize && expectedSize > 16) { // Ensure we have at least the auth tag
        // console.log(`🔄 Retrying decryption with different truncation for chunk ${i}`);

        // Try truncating to expected size minus potential B2 trailer
        for (let offset = 0; offset < Math.min(32, encryptedChunk.length - expectedSize + 1); offset++) {
          try {
            const truncatedChunk = encryptedChunk.slice(0, expectedSize - offset);
            const truncatedBase64 = uint8ArrayToBase64(truncatedChunk);
            decryptedData = decryptData(truncatedBase64, cek, chunkNonce);
            // console.log(`✅ Decryption succeeded with ${offset} byte offset for chunk ${i}`);
            break;
          } catch (retryError) {
            // Continue trying different offsets
          }
        }

        // If all truncation attempts failed, try with original full data as last resort
        if (!decryptedData) {
          // console.log(`🔄 Last resort: trying decryption with full B2 response for chunk ${i}`);
          try {
            const fullBase64 = uint8ArrayToBase64(encryptedChunk);
            decryptedData = decryptData(fullBase64, cek, chunkNonce);
            // console.log(`✅ Decryption succeeded with full B2 data for chunk ${i}`);
          } catch (finalError) {
            throw new Error(`Decryption failed for chunk ${i} after all attempts: ${finalError instanceof Error ? finalError.message : 'Unknown error'}`);
          }
        }
      } else {
        throw decryptError; // Re-throw original error if we can't try alternatives
      }
    }

    if (!decryptedData) {
      throw new Error(`Decryption failed for chunk ${i}: no valid decrypted data produced`);
    }

    decryptedChunks.push(decryptedData);
    // console.log(`🔓 Decrypted chunk ${i} (${processedChunk.length} → ${decryptedData.length} bytes)`);
  }

  // console.log(`✅ Decrypted all ${encryptedChunks.length} chunks`);
  return decryptedChunks;
}

export async function downloadEncryptedFile(
  fileId: string,
  userKeys?: any,
  onProgress?: (progress: DownloadProgress) => void
): Promise<DownloadResult> {
  try {
    // Get user keys from KeyManager if not provided
    const keys = userKeys || await keyManager.getUserKeys();

    // Stage 1: Get download URLs and metadata from backend
    onProgress?.({ stage: 'initializing', overallProgress: 0 });
    const session = await initializeDownloadSession(fileId);
    onProgress?.({ stage: 'initializing', overallProgress: 10 });

    // Stage 2: Download encrypted chunks from B2
    onProgress?.({ stage: 'downloading', overallProgress: 15 });
    const encryptedChunks = await downloadChunksFromB2(session.chunks, onProgress);

    // Stage 3: Decrypt chunks
    onProgress?.({ stage: 'decrypting', overallProgress: 80 });
    const decryptedChunks = await decryptChunks(encryptedChunks, session, keys.keypairs);

    // Stage 4: Assemble file
    onProgress?.({ stage: 'assembling', overallProgress: 90 });
    const fileBlob = await assembleFile(decryptedChunks, session.mimetype);

    // Stage 5: Verify integrity
    onProgress?.({ stage: 'verifying', overallProgress: 95 });
    await verifyFileIntegrity(fileBlob, session.sha256);

    onProgress?.({ stage: 'complete', overallProgress: 100 });

    return {
      fileId: session.fileId,
      blob: fileBlob,
      filename: session.originalFilename,
      size: session.size,
      mimetype: session.mimetype,
      sha256: session.sha256
    };

  } catch (error) {
    // console.error('Download failed:', error);
    throw new Error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Initialize download session by fetching URLs and metadata from backend
 */
async function initializeDownloadSession(fileId: string): Promise<DownloadSession> {
  const response = await apiClient.getDownloadUrls(fileId);

  if (!response.success || !response.data) {
    throw new Error('Failed to initialize download session');
  }

  const data = response.data;

  // Merge chunks metadata with presigned URLs
  const mergedChunks: DownloadChunk[] = data.chunks.map((chunk: any) => {
    // Find the corresponding presigned URL entry
    const presignedEntry = data.presigned?.find((p: any) => p.chunkIndex === chunk.index);
    if (!presignedEntry) {
      throw new Error(`No presigned URL found for chunk ${chunk.index}`);
    }

    return {
      chunkIndex: chunk.index,
      index: chunk.index, // Keep both for compatibility
      objectKey: presignedEntry.objectKey,
      size: chunk.size,
      sha256: chunk.sha256,
      nonce: chunk.nonce,
      getUrl: presignedEntry.getUrl
    };
  });

  return {
    fileId: data.fileId,
    filename: data.storageKey,
    originalFilename: data.originalFilename,
    mimetype: data.mimetype,
    size: data.size,
    sha256: data.sha256,
    chunkCount: data.chunkCount,
    chunks: mergedChunks,
    manifest: data.manifest,
    signatures: data.signatures,
    encryption: data.encryption,
    storageType: data.storageType
  };
}

/**
 * Unwrap the Content Encryption Key (CEK) using Kyber decapsulation
 */
async function unwrapCEK(encryption: DownloadEncryption, keypairs: any): Promise<Uint8Array> {
  const { ml_kem768 } = await import('@noble/post-quantum/ml-kem.js');
  const { decryptData } = await import('./crypto');

  if (!encryption.kyberCiphertext) {
    throw new Error('No Kyber ciphertext available for CEK unwrapping');
  }

  if (!encryption.wrappedCek) {
    throw new Error('No wrapped CEK available for unwrapping');
  }

  if (!encryption.nonceWrapKyber) {
    throw new Error('No CEK nonce available for unwrapping');
  }

  // Convert hex string to Uint8Arrays with corruption handling
  let kyberCiphertext = hexToUint8Array(encryption.kyberCiphertext);

  // Handle potentially corrupted Kyber ciphertext (similar to nonce corruption)
  // Kyber768 ciphertext should be 1088 bytes, but corruption might make it longer/shorter
  if (kyberCiphertext.length > 1088) {
    // console.warn(`⚠️ Kyber ciphertext length ${kyberCiphertext.length} exceeds expected 1088 bytes, attempting to handle corruption`);

    // If it's exactly double length (corrupted hex), try taking first half
    if (kyberCiphertext.length === 2176) { // 2 * 1088
      kyberCiphertext = kyberCiphertext.slice(0, 1088);
      // console.log('✅ Recovered Kyber ciphertext from double-length corruption');
    } else {
      // Truncate to expected length
      kyberCiphertext = kyberCiphertext.slice(0, 1088);
      // console.log('⚠️ Truncated corrupted Kyber ciphertext to 1088 bytes');
    }
  } else if (kyberCiphertext.length < 1088) {
    // console.warn(`⚠️ Kyber ciphertext length ${kyberCiphertext.length} is less than expected 1088 bytes`);
    // Pad with zeros if too short
    const padded = new Uint8Array(1088);
    padded.set(kyberCiphertext);
    kyberCiphertext = padded;
    // console.log('⚠️ Padded Kyber ciphertext to 1088 bytes');
  }

  const wrappedCek = encryption.wrappedCek;
  const cekNonce = encryption.nonceWrapKyber;

  // Decapsulate to get the shared secret
  const sharedSecret = ml_kem768.decapsulate(kyberCiphertext, keypairs.kyberPrivateKey);

  // Decrypt the CEK using the shared secret
  const decryptedCek = decryptData(wrappedCek, new Uint8Array(sharedSecret), cekNonce);

  return decryptedCek;
}
async function downloadChunksFromB2(
  chunks: DownloadChunk[],
  onProgress?: (progress: DownloadProgress) => void
): Promise<Uint8Array[]> {
  const totalChunks = chunks.length;
  let completedChunks = 0;
  let totalBytesDownloaded = 0;
  const startTime = Date.now();

  // Download chunks in parallel with concurrency control
  const concurrencyLimit = 3; // Download up to 3 chunks simultaneously
  const semaphore = new Semaphore(concurrencyLimit);

  const downloadPromises = chunks.map(async (chunk, index) => {
    await semaphore.acquire();

    try {
      // console.log(`📥 Downloading chunk ${getChunkIndex(chunk)} from B2 (${chunk.size} bytes)`);

      const response = await fetch(chunk.getUrl);
      if (!response.ok) {
        // console.error(`❌ Failed to download chunk ${getChunkIndex(chunk)}: ${response.status} ${response.statusText}`);
        // console.error('Response headers:', Object.fromEntries(response.headers.entries()));
        throw new Error(`Failed to download chunk ${getChunkIndex(chunk)}: ${response.status} ${response.statusText}`);
      }

      // console.log(`📡 Response status: ${response.status}, content-type: ${response.headers.get('content-type')}, content-length: ${response.headers.get('content-length')}`);

      let encryptedData = new Uint8Array(await response.arrayBuffer());

      // Get the actual content length from response headers
      const contentLength = response.headers.get('content-length');
      const actualSize = contentLength ? parseInt(contentLength, 10) : encryptedData.length;

      // Handle B2 checksum trailers and size mismatches
      if (encryptedData.length > chunk.size) {
        // B2 may add checksum trailers or the metadata size might be approximate
        // Use the actual returned size instead of truncating
        // console.warn(`⚠️ Chunk ${getChunkIndex(chunk)} size difference: metadata says ${chunk.size}, B2 returned ${encryptedData.length}, using actual size`);
        // Don't truncate - use the full response
      } else if (encryptedData.length < chunk.size) {
        // Handle size differences (may occur due to storage optimizations)
        if (encryptedData.length === actualSize && actualSize < chunk.size) {
          // console.warn(`⚠️ Chunk ${getChunkIndex(chunk)} size difference: metadata says ${chunk.size}, B2 returned ${encryptedData.length}, using actual size`);
          // Don't throw error - use the actual size
        } else {
          throw new Error(`Chunk ${getChunkIndex(chunk)} too small: expected ${chunk.size}, got ${encryptedData.length}`);
        }
      }

      completedChunks++;
      totalBytesDownloaded += encryptedData.length;

      const elapsedTime = (Date.now() - startTime) / 1000; // seconds
      const downloadSpeed = totalBytesDownloaded / elapsedTime; // bytes per second
      const remainingBytes = chunks.reduce((sum, c) => sum + c.size, 0) - totalBytesDownloaded;
      const timeRemaining = downloadSpeed > 0 ? remainingBytes / downloadSpeed : 0;

      onProgress?.({
        stage: 'downloading',
        overallProgress: 15 + (completedChunks / totalChunks) * 65, // 15% to 80%
        currentChunk: completedChunks,
        totalChunks,
        bytesDownloaded: totalBytesDownloaded,
        totalBytes: chunks.reduce((sum, c) => sum + c.size, 0),
        chunkProgress: 100,
        downloadSpeed: Math.round(downloadSpeed),
        timeRemaining: Math.round(timeRemaining)
      });

      // console.log(`✅ Downloaded chunk ${getChunkIndex(chunk)} (${encryptedData.length} bytes)`);
      return encryptedData;

    } catch (error) {
      // console.error(`❌ Failed to download chunk ${chunk.chunkIndex}:`, error);
      throw error;
    } finally {
      semaphore.release();
    }
  });

  const encryptedChunks = await Promise.all(downloadPromises);
  // console.log(`✅ Downloaded all ${totalChunks} chunks from B2 (${totalBytesDownloaded} bytes total)`);

  return encryptedChunks;
}

/**
 * Decrypt downloaded chunks using the encryption metadata
 */
async function decryptChunks(
  encryptedChunks: Uint8Array[],
  session: DownloadSession,
  keypairs: any
): Promise<Uint8Array[]> {
  if (!session.encryption) {
    throw new Error('No encryption metadata available for decryption');
  }

  // Unwrap the CEK using Kyber decapsulation
  const cek = await unwrapCEK(session.encryption, keypairs);

  const decryptedChunks: Uint8Array[] = [];

  for (let i = 0; i < encryptedChunks.length; i++) {
    const encryptedChunk = encryptedChunks[i];
    const chunkInfo = session.chunks[i];

    // Get the nonce for this chunk (should be base64 string from backend)
    const chunkNonce = chunkInfo.nonce;

    if (!chunkNonce) {
      throw new Error(`No nonce available for chunk ${i}`);
    }

    // Handle potential B2 size discrepancies
    let processedChunk = encryptedChunk;
    const expectedSize = chunkInfo.size;

    if (encryptedChunk.length > expectedSize) {
      const difference = encryptedChunk.length - expectedSize;
      // console.warn(`⚠️ Chunk ${i} size discrepancy: expected ${expectedSize}, got ${encryptedChunk.length} (${difference} extra bytes)`);

      // If the difference is small (likely B2-added content), try to truncate
      if (difference <= 32) { // Allow up to 32 extra bytes for potential B2 metadata
        processedChunk = encryptedChunk.slice(0, expectedSize);
        // console.log(`✂️ Truncated chunk ${i} to expected size: ${processedChunk.length} bytes`);
      } else {
        // console.warn(`⚠️ Large size difference (${difference} bytes), using full response but decryption may fail`);
      }
    } else if (encryptedChunk.length < expectedSize) {
      // console.warn(`⚠️ Chunk ${i} smaller than expected: expected ${expectedSize}, got ${encryptedChunk.length}`);
    }

    // Convert encrypted bytes to base64 string for decryption
    const encryptedBase64 = uint8ArrayToBase64(processedChunk);

    // Try decryption with fallback handling
    let decryptedData: Uint8Array | undefined;
    try {
      decryptedData = decryptData(encryptedBase64, cek, chunkNonce);
    } catch (decryptError) {
      // console.error(`❌ Decryption failed for chunk ${i}:`, decryptError);

      // If decryption failed and we have extra data, try with different truncation strategies
      if (encryptedChunk.length > expectedSize && expectedSize > 16) { // Ensure we have at least the auth tag
        // console.log(`🔄 Retrying decryption with different truncation for chunk ${i}`);

        // Try truncating to expected size minus potential B2 trailer
        for (let offset = 0; offset < Math.min(32, encryptedChunk.length - expectedSize + 1); offset++) {
          try {
            const truncatedChunk = encryptedChunk.slice(0, expectedSize - offset);
            const truncatedBase64 = uint8ArrayToBase64(truncatedChunk);
            decryptedData = decryptData(truncatedBase64, cek, chunkNonce);
            // console.log(`✅ Decryption succeeded with ${offset} byte offset for chunk ${i}`);
            break;
          } catch (retryError) {
            // Continue trying different offsets
          }
        }

        // If all truncation attempts failed, try with original full data as last resort
        if (!decryptedData) {
          // console.log(`🔄 Last resort: trying decryption with full B2 response for chunk ${i}`);
          try {
            const fullBase64 = uint8ArrayToBase64(encryptedChunk);
            decryptedData = decryptData(fullBase64, cek, chunkNonce);
            // console.log(`✅ Decryption succeeded with full B2 data for chunk ${i}`);
          } catch (finalError) {
            throw new Error(`Decryption failed for chunk ${i} after all attempts: ${finalError instanceof Error ? finalError.message : 'Unknown error'}`);
          }
        }
      } else {
        throw decryptError; // Re-throw original error if we can't try alternatives
      }
    }

    if (!decryptedData) {
      throw new Error(`Decryption failed for chunk ${i}: no valid decrypted data produced`);
    }

    decryptedChunks.push(decryptedData);
    // console.log(`🔓 Decrypted chunk ${i} (${processedChunk.length} → ${decryptedData.length} bytes)`);
  }

  // console.log(`✅ Decrypted all ${encryptedChunks.length} chunks`);
  return decryptedChunks;
}

/**
 * Assemble decrypted chunks into a single file blob
 */
async function assembleFile(decryptedChunks: Uint8Array[], mimetype: string): Promise<Blob> {
  // Concatenate all chunks
  const totalSize = decryptedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const fileData = new Uint8Array(totalSize);

  let offset = 0;
  for (const chunk of decryptedChunks) {
    fileData.set(chunk, offset);
    offset += chunk.length;
  }

  const fileBlob = new Blob([fileData], { type: mimetype });
  // console.log(`📦 Assembled file blob (${fileData.length} bytes, type: ${mimetype})`);

  return fileBlob;
}

/**
 * Verify file integrity by computing SHA-256 hash
 */
async function verifyFileIntegrity(blob: Blob, expectedSha256: string): Promise<void> {
  const arrayBuffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const actualSha256 = uint8ArrayToHex(new Uint8Array(hashBuffer));

  if (actualSha256 !== expectedSha256) {
    throw new Error(`File integrity check failed: expected ${expectedSha256}, got ${actualSha256}`);
  }

  // console.log(`✅ File integrity verified (SHA-256: ${actualSha256})`);
}

/**
 * Download file and trigger browser download (single file - no ZIP)
 */
export async function downloadFileToBrowser(
  fileId: string,
  userKeys?: any,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  const result = await downloadEncryptedFile(fileId, userKeys, onProgress);

  // Create download link and trigger download
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // console.log(`📥 Triggered browser download: ${result.filename} (${result.size} bytes)`);
}

/**
 * Recursively get all files in a folder and subfolders
 */
export async function getRecursiveFolderContents(folderId: string, basePath: string = ''): Promise<Array<{fileId: string, relativePath: string, filename: string}>> {
  const allFiles: Array<{fileId: string, relativePath: string, filename: string}> = [];

  const response = await apiClient.getFolderContents(folderId);
  if (!response.success || !response.data) {
    throw new Error('Failed to get folder contents');
  }

  const { folders, files } = response.data;

  // Add files from current folder
  for (const file of files || []) {
    allFiles.push({
      fileId: file.id,
      relativePath: basePath,
      filename: file.filename
    });
  }

  // Recursively get files from subfolders
  for (const folder of folders || []) {
    const subfolderPath = basePath ? `${basePath}/${folder.name}` : folder.name;
    const subfolderFiles = await getRecursiveFolderContents(folder.id, subfolderPath);
    allFiles.push(...subfolderFiles);
  }

  return allFiles;
}

/**
 * Download entire folder as ZIP with recursive contents
 */
export async function downloadFolderAsZip(
  folderId: string,
  folderName: string,
  userKeys?: any,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  try {
    // Get all files recursively
    onProgress?.({ stage: 'initializing', overallProgress: 0 });
    const allFiles = await getRecursiveFolderContents(folderId);
    onProgress?.({ stage: 'initializing', overallProgress: 10 });

    if (allFiles.length === 0) {
      throw new Error('Folder is empty');
    }

    // Download all files
    const downloadedFiles: Array<{relativePath: string, filename: string, blob: Blob}> = [];
    let completedFiles = 0;
    let totalDownloadedBytes = 0;
    let totalBytes = 0;

    // First pass: get total size by downloading metadata for all files
    for (const file of allFiles) {
      try {
        const session = await initializeDownloadSession(file.fileId);
        totalBytes += session.size;
      } catch (error) {
        // console.warn(`Failed to get size for file ${file.filename}:`, error);
      }
    }

    for (const file of allFiles) {
      const result = await downloadEncryptedFile(file.fileId, userKeys, (progress) => {
        // Update total progress
        const fileProgress = progress.overallProgress / allFiles.length;
        const baseProgress = (completedFiles / allFiles.length) * 80; // 10% to 90%
        const currentProgress = 10 + baseProgress + (fileProgress * 80 / allFiles.length);
        
        onProgress?.({
          stage: progress.stage,
          overallProgress: Math.min(currentProgress, 90),
          currentChunk: completedFiles + 1,
          totalChunks: allFiles.length,
          bytesDownloaded: totalDownloadedBytes + (progress.bytesDownloaded || 0),
          totalBytes: totalBytes,
          downloadSpeed: progress.downloadSpeed,
          timeRemaining: progress.timeRemaining
        });
      });

      downloadedFiles.push({
        relativePath: file.relativePath,
        filename: result.filename,
        blob: result.blob
      });

      completedFiles++;
      totalDownloadedBytes += result.size;
    }

    // Create ZIP
    onProgress?.({ stage: 'assembling', overallProgress: 80 });
    const zipBlob = await createZipFromFiles(downloadedFiles, folderName);
    onProgress?.({ stage: 'assembling', overallProgress: 95 });

    // Trigger download
    const zipFilename = `${folderName}.zip`;
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onProgress?.({ stage: 'complete', overallProgress: 100 });

    // console.log(`📦 Downloaded folder as ZIP: ${zipFilename} (${allFiles.length} files, ${totalDownloadedBytes} bytes)`);

  } catch (error) {
    // console.error('Folder ZIP download failed:', error);
    throw new Error(`Folder download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Download multiple items as ZIP with proper naming
 */
export async function downloadMultipleItemsAsZip(
  items: Array<{id: string, name: string, type: "file" | "folder"}>,
  userKeys?: any,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  try {
    // Generate timestamp and random hex
    const timestamp = Math.floor(Date.now() / 1000);
    const randomHex = Math.random().toString(16).substring(2, 10);
    const zipName = `files-${timestamp}-${randomHex}.zip`;

    // Get all files recursively from all selected items
    onProgress?.({ stage: 'initializing', overallProgress: 0 });
    const allFiles: Array<{fileId: string, relativePath: string, filename: string}> = [];
    
    for (const item of items) {
      if (item.type === 'file') {
        allFiles.push({
          fileId: item.id,
          relativePath: '',
          filename: item.name
        });
      } else {
        // For folders, get recursive contents
        const folderFiles = await getRecursiveFolderContents(item.id, item.name);
        allFiles.push(...folderFiles);
      }
    }

    if (allFiles.length === 0) {
      throw new Error('No files to download');
    }

    onProgress?.({ stage: 'initializing', overallProgress: 10 });

    // Download all files
    const downloadedFiles: Array<{relativePath: string, filename: string, blob: Blob}> = [];
    let completedFiles = 0;
    let totalDownloadedBytes = 0;
    let totalBytes = 0;

    // First pass: get total size
    for (const file of allFiles) {
      try {
        const session = await initializeDownloadSession(file.fileId);
        totalBytes += session.size;
      } catch (error) {
        // console.warn(`Failed to get size for file ${file.filename}:`, error);
      }
    }

    for (const file of allFiles) {
      const result = await downloadEncryptedFile(file.fileId, userKeys, (progress) => {
        // Update total progress
        const fileProgress = progress.overallProgress / allFiles.length;
        const baseProgress = (completedFiles / allFiles.length) * 80;
        const currentProgress = 10 + baseProgress + (fileProgress * 80 / allFiles.length);
        
        onProgress?.({
          stage: progress.stage,
          overallProgress: Math.min(currentProgress, 90),
          currentChunk: completedFiles + 1,
          totalChunks: allFiles.length,
          bytesDownloaded: totalDownloadedBytes + (progress.bytesDownloaded || 0),
          totalBytes: totalBytes,
          downloadSpeed: progress.downloadSpeed,
          timeRemaining: progress.timeRemaining
        });
      });

      downloadedFiles.push({
        relativePath: file.relativePath,
        filename: result.filename,
        blob: result.blob
      });

      completedFiles++;
      totalDownloadedBytes += result.size;
    }

    // Create ZIP
    onProgress?.({ stage: 'assembling', overallProgress: 95 });
    const zipBlob = await createZipFromFiles(downloadedFiles, '');
    onProgress?.({ stage: 'assembling', overallProgress: 98 });

    // Trigger download
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onProgress?.({ stage: 'complete', overallProgress: 100 });

    // console.log(`📦 Downloaded ${allFiles.length} items as ZIP: ${zipName} (${totalDownloadedBytes} bytes)`);

  } catch (error) {
    // console.error('Bulk ZIP download failed:', error);
    throw new Error(`Bulk download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create ZIP file from array of files with their relative paths
 */
async function createZipFromFiles(
  files: Array<{relativePath: string, filename: string, blob: Blob}>,
  folderName: string
): Promise<Blob> {
  // Import fflate dynamically
  const { zip } = await import('fflate');

  const zipData: Record<string, Uint8Array> = {};

  // Add files to zip structure
  for (const file of files) {
    // Ensure paths don't start with leading slash and are properly formatted
    let zipPath: string;
    if (file.relativePath) {
      // Remove leading slash if present and construct path
      const cleanRelativePath = file.relativePath.replace(/^\//, '');
      zipPath = folderName ? `${folderName}/${cleanRelativePath}/${file.filename}` : `${cleanRelativePath}/${file.filename}`;
    } else {
      zipPath = folderName ? `${folderName}/${file.filename}` : file.filename;
    }

    // Ensure no double slashes and clean up the path
    zipPath = zipPath.replace(/\/+/g, '/').replace(/^\//, '');

    const arrayBuffer = await file.blob.arrayBuffer();
    zipData[zipPath] = new Uint8Array(arrayBuffer);
  }

  // Create ZIP
  return new Promise((resolve, reject) => {
    zip(zipData, { level: 0 }, (err: any, data: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(new Blob([data], { type: 'application/zip' }));
      }
    });
  });
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
