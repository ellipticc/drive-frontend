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
import { decryptData, uint8ArrayToHex, hexToUint8Array, decryptFilename } from './crypto';
import { keyManager } from './key-manager';
import { isTorAccess } from './tor-detection';
import { decompressChunk, CompressionAlgorithm } from './compression';

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
  shaHash: string;
  nonce: string | null;
  getUrl: string;
  // Compression metadata
  isCompressed?: boolean;
  compressionAlgorithm?: string;
  compressionOriginalSize?: number;
  compressionCompressedSize?: number;
}

export interface DownloadManifest {
  version: string;
  fileId: string;
  originalFilename: string;
  size: number;
  mimetype: string;
  shaHash: string;
  chunkCount: number;
  chunks: Array<{
    index: number;
    size: number;
    shaHash: string;
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
  shaHash: string;
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
  shaHash: string;
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
    await verifyFileIntegrity(fileBlob, session.shaHash);

    onProgress?.({ stage: 'complete', overallProgress: 100 });

    return {
      fileId: session.fileId,
      blob: fileBlob,
      filename: session.originalFilename,
      size: session.size,
      mimetype: session.mimetype,
      shaHash: session.shaHash
    };

  } catch (error) {
    // console.error('Download failed:', error);
    throw new Error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt downloaded chunks using a pre-unwrapped CEK
 * Also handles decompression if chunks were compressed before encryption
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

      // If the difference is small (likely B2-added content), try to truncate
      if (difference <= 32) { // Allow up to 32 extra bytes for potential B2 metadata
      } else {
        // console.warn(`Large size difference (${difference} bytes), using full response but decryption may fail`);
      }
    } else if (encryptedChunk.length < expectedSize) {
      // console.warn(`Chunk ${i} smaller than expected: expected ${expectedSize}, got ${encryptedChunk.length}`);
    }

    // Convert encrypted bytes to base64 string for decryption
    const encryptedBase64 = uint8ArrayToBase64(processedChunk);

    // Try decryption with fallback handling
    let decryptedData: Uint8Array | undefined;
    try {
      decryptedData = decryptData(encryptedBase64, cek, chunkNonce);
    } catch (decryptError) {

      // If decryption failed and we have extra data, try with different truncation strategies
      if (encryptedChunk.length > expectedSize && expectedSize > 16) { // Ensure we have at least the auth tag

        // Try truncating to expected size minus potential B2 trailer
        for (let offset = 0; offset < Math.min(32, encryptedChunk.length - expectedSize + 1); offset++) {
          try {
            const truncatedChunk = encryptedChunk.slice(0, expectedSize - offset);
            const truncatedBase64 = uint8ArrayToBase64(truncatedChunk);
            decryptedData = decryptData(truncatedBase64, cek, chunkNonce);
            break;
          } catch (retryError) {
            // Continue trying different offsets
          }
        }

        // If all truncation attempts failed, try with original full data as last resort
        if (!decryptedData) {
          try {
            const fullBase64 = uint8ArrayToBase64(encryptedChunk);
            decryptedData = decryptData(fullBase64, cek, chunkNonce);
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

    // STAGE 3B: Decompress chunk if it was compressed before encryption
    let finalData = decryptedData;
    if (chunkInfo.isCompressed && chunkInfo.compressionAlgorithm) {
      try {
        const algorithm = chunkInfo.compressionAlgorithm as CompressionAlgorithm;
        finalData = await decompressChunk(decryptedData, algorithm);
      } catch (decompressError) {
        throw new Error(`Decompression failed for chunk ${i} (${chunkInfo.compressionAlgorithm}): ${decompressError instanceof Error ? decompressError.message : 'Unknown error'}`);
      }
    }

    decryptedChunks.push(finalData);
  }

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
    await verifyFileIntegrity(fileBlob, session.shaHash);

    onProgress?.({ stage: 'complete', overallProgress: 100 });

    return {
      fileId: session.fileId,
      blob: fileBlob,
      filename: session.originalFilename,
      size: session.size,
      mimetype: session.mimetype,
      shaHash: session.shaHash
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

  // Decrypt the filename if it's encrypted
  let decryptedFilename = data.originalFilename;
  if (data.filenameSalt && data.filenameSalt.trim()) {
    try {
      const { masterKeyManager } = await import('./master-key');
      const masterKey = masterKeyManager.getMasterKey();
      decryptedFilename = await decryptFilename(data.originalFilename, data.filenameSalt, masterKey);
    } catch (err) {
      console.warn(`Failed to decrypt filename for download ${fileId}:`, err);
      // Fallback to encrypted filename
      decryptedFilename = data.originalFilename;
    }
  }

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
      shaHash: chunk.sha256,
      nonce: chunk.nonce,
      getUrl: presignedEntry.getUrl,
      // Compression metadata
      isCompressed: chunk.isCompressed,
      compressionAlgorithm: chunk.compressionAlgorithm,
      compressionOriginalSize: chunk.compressionOriginalSize,
      compressionCompressedSize: chunk.compressionCompressedSize
    };
  });

  return {
    fileId: data.fileId,
    filename: data.storageKey,
    originalFilename: decryptedFilename,
    mimetype: data.mimetype,
    size: data.size,
    shaHash: data.sha256,
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

    // If it's exactly double length (corrupted hex), try taking first half
    if (kyberCiphertext.length === 2176) { // 2 * 1088
      kyberCiphertext = kyberCiphertext.slice(0, 1088);
    } else {
      // Truncate to expected length
      kyberCiphertext = kyberCiphertext.slice(0, 1088);
    }
  } else if (kyberCiphertext.length < 1088) {
    // Pad with zeros if too short
    const padded = new Uint8Array(1088);
    padded.set(kyberCiphertext);
    kyberCiphertext = padded;
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

      const response = await fetch(chunk.getUrl, {
        credentials: 'omit'
      });
      if (!response.ok) {
        throw new Error(`Failed to download chunk ${getChunkIndex(chunk)}: ${response.status} ${response.statusText}`);
      }

      let encryptedData = new Uint8Array(await response.arrayBuffer());

      // Get the actual content length from response headers
      const contentLength = response.headers.get('content-length');
      const actualSize = contentLength ? parseInt(contentLength, 10) : encryptedData.length;

      // Handle B2 checksum trailers and size mismatches
      if (encryptedData.length > chunk.size) {
        // B2 may add checksum trailers or the metadata size might be approximate
        // Use the actual returned size instead of truncating
        // Don't truncate - use the full response
      } else if (encryptedData.length < chunk.size) {
        // Handle size differences (may occur due to storage optimizations)
        if (encryptedData.length === actualSize && actualSize < chunk.size) {
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

      return encryptedData;

    } catch (error) {
      throw error;
    } finally {
      semaphore.release();
    }
  });

  const encryptedChunks = await Promise.all(downloadPromises);

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

      // If the difference is small (likely B2-added content), try to truncate
      if (difference <= 32) { // Allow up to 32 extra bytes for potential B2 metadata
        processedChunk = encryptedChunk.slice(0, expectedSize);
      } else {
      }
    } else if (encryptedChunk.length < expectedSize) {
    }

    // Convert encrypted bytes to base64 string for decryption
    const encryptedBase64 = uint8ArrayToBase64(processedChunk);

    // Try decryption with fallback handling
    let decryptedData: Uint8Array | undefined;
    try {
      decryptedData = decryptData(encryptedBase64, cek, chunkNonce);
    } catch (decryptError) {
      // If decryption failed and we have extra data, try with different truncation strategies
      if (encryptedChunk.length > expectedSize && expectedSize > 16) { // Ensure we have at least the auth tag

        // Try truncating to expected size minus potential B2 trailer
        for (let offset = 0; offset < Math.min(32, encryptedChunk.length - expectedSize + 1); offset++) {
          try {
            const truncatedChunk = encryptedChunk.slice(0, expectedSize - offset);
            const truncatedBase64 = uint8ArrayToBase64(truncatedChunk);
            decryptedData = decryptData(truncatedBase64, cek, chunkNonce);
            break;
          } catch (retryError) {
            // Continue trying different offsets
          }
        }

        // If all truncation attempts failed, try with original full data as last resort
        if (!decryptedData) {
          try {
            const fullBase64 = uint8ArrayToBase64(encryptedChunk);
            decryptedData = decryptData(fullBase64, cek, chunkNonce);
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

    // STAGE 3B: Decompress chunk if it was compressed before encryption
    let finalData = decryptedData;
    if (chunkInfo.isCompressed && chunkInfo.compressionAlgorithm) {
      try {
        const algorithm = chunkInfo.compressionAlgorithm as CompressionAlgorithm;
        finalData = await decompressChunk(decryptedData, algorithm);
      } catch (decompressError) {
        throw new Error(`Decompression failed for chunk ${i} (${chunkInfo.compressionAlgorithm}): ${decompressError instanceof Error ? decompressError.message : 'Unknown error'}`);
      }
    }

    decryptedChunks.push(finalData);
  }

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

  return fileBlob;
}

/**
 * Verify file integrity by computing SHA hash (256 or 512 based on expected hash length)
 */
async function verifyFileIntegrity(blob: Blob, expectedShaHash: string): Promise<void> {
  // Determine hash algorithm based on expected hash length
  const isSha512 = expectedShaHash.length === 128; // SHA512 is 128 hex chars, SHA256 is 64
  const algorithm = isSha512 ? 'SHA-512' : 'SHA-256';

  const arrayBuffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest(algorithm, arrayBuffer);
  const actualShaHash = uint8ArrayToHex(new Uint8Array(hashBuffer));

  if (actualShaHash !== expectedShaHash) {
    throw new Error(`File integrity check failed: expected ${expectedShaHash}, got ${actualShaHash}`);
  }
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

}

/**
 * Recursively get all files and folders in a folder and subfolders
 */
export async function getRecursiveFolderContents(folderId: string, basePath: string = '', userKeys?: any): Promise<{
  files: Array<{fileId: string, relativePath: string, filename: string}>,
  folders: Array<{folderId: string, relativePath: string, folderName: string}>
}> {
  const allFiles: Array<{fileId: string, relativePath: string, filename: string}> = [];
  const allFolders: Array<{folderId: string, relativePath: string, folderName: string}> = [];

  const response = await apiClient.getFolderContents(folderId);
  if (!response.success || !response.data) {
    throw new Error('Failed to get folder contents');
  }

  const { folders, files } = response.data;

  // Add files from current folder
  for (const file of files || []) {
    // Decrypt filename if encrypted
    let filename = '';
    if (file.encryptedFilename && file.filenameSalt && userKeys) {
      try {
        const { masterKeyManager } = await import('./master-key');
        const masterKey = masterKeyManager.getMasterKey();
        filename = await decryptFilename(file.encryptedFilename, file.filenameSalt, masterKey);
      } catch (err) {
        console.warn(`Failed to decrypt filename for file ${file.id}:`, err);
        filename = file.encryptedFilename || 'unknown';
      }
    } else {
      filename = 'unknown';
    }

    allFiles.push({
      fileId: file.id,
      relativePath: basePath,
      filename: filename
    });
  }

  // Add current folder to folders list (for empty folders)
  if (basePath) {
    // Don't add the root folder
    const pathParts = basePath.split('/');
    const folderName = pathParts[pathParts.length - 1];
    const parentPath = pathParts.slice(0, -1).join('/');
    allFolders.push({
      folderId: folderId,
      relativePath: parentPath,
      folderName: folderName
    });
  }

  // Recursively get files and folders from subfolders
  for (const folder of folders || []) {
    // Decrypt folder name if encrypted
    let folderName = '';
    if (folder.encryptedName && folder.nameSalt && userKeys) {
      try {
        const { masterKeyManager } = await import('./master-key');
        const masterKey = masterKeyManager.getMasterKey();
        folderName = await decryptFilename(folder.encryptedName, folder.nameSalt, masterKey);
      } catch (err) {
        console.warn(`Failed to decrypt folder name for folder ${folder.id}:`, err);
        folderName = folder.encryptedName || 'unknown';
      }
    } else {
      folderName = 'unknown';
    }

    const subfolderPath = basePath ? `${basePath}/${folderName}` : folderName;
    const subfolderContents = await getRecursiveFolderContents(folder.id, subfolderPath, userKeys);
    allFiles.push(...subfolderContents.files);
    allFolders.push(...subfolderContents.folders);
  }

  return { files: allFiles, folders: allFolders };
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
    // Get all files and folders recursively
    onProgress?.({ stage: 'initializing', overallProgress: 0 });
    const folderContents = await getRecursiveFolderContents(folderId, '', userKeys);
    const allFiles = folderContents.files;
    const allFolders = folderContents.folders;
    onProgress?.({ stage: 'initializing', overallProgress: 10 });

    if (allFiles.length === 0 && allFolders.length === 0) {
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

    // Create ZIP with both files and folders
    onProgress?.({ stage: 'assembling', overallProgress: 80 });
    const zipBlob = await createZipFromFilesAndFolders(downloadedFiles, allFolders, folderName);
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

    // Get all files and folders recursively from all selected items
    onProgress?.({ stage: 'initializing', overallProgress: 0 });
    const allFiles: Array<{fileId: string, relativePath: string, filename: string}> = [];
    const allFolders: Array<{folderId: string, relativePath: string, folderName: string}> = [];

    for (const item of items) {
      if (item.type === 'file') {
        allFiles.push({
          fileId: item.id,
          relativePath: '',
          filename: item.name
        });
      } else {
        // For folders, get recursive contents
        const folderContents = await getRecursiveFolderContents(item.id, item.name, userKeys);
        allFiles.push(...folderContents.files);
        allFolders.push(...folderContents.folders);
      }
    }

    if (allFiles.length === 0 && allFolders.length === 0) {
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

    // Create ZIP with both files and folders
    onProgress?.({ stage: 'assembling', overallProgress: 95 });
    const zipBlob = await createZipFromFilesAndFolders(downloadedFiles, allFolders, '');
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

  } catch (error) {
    // console.error('Bulk ZIP download failed:', error);
    throw new Error(`Bulk download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create ZIP file from array of files and folders with their relative paths
 */
async function createZipFromFilesAndFolders(
  files: Array<{relativePath: string, filename: string, blob: Blob}>,
  folders: Array<{folderId: string, relativePath: string, folderName: string}>,
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

  // Add empty directory entries for folders
  for (const folder of folders) {
    let folderPath: string;
    if (folder.relativePath) {
      const cleanRelativePath = folder.relativePath.replace(/^\//, '');
      folderPath = folderName ? `${folderName}/${cleanRelativePath}/${folder.folderName}/` : `${cleanRelativePath}/${folder.folderName}/`;
    } else {
      folderPath = folderName ? `${folderName}/${folder.folderName}/` : `${folder.folderName}/`;
    }

    // Ensure no double slashes and clean up the path, ensure it ends with /
    folderPath = folderPath.replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '') + '/';

    // Add an empty Uint8Array for the directory entry
    zipData[folderPath] = new Uint8Array(0);
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
 * Preview PDF file in a new tab using the same encrypted download flow
 */
export async function previewPDFFile(
  fileId: string,
  userKeys?: any,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  try {
    // Download the file using the same encrypted flow
    const result = await downloadEncryptedFile(fileId, userKeys, onProgress);

    // Verify it's actually a PDF
    if (!result.mimetype.includes('pdf')) {
      throw new Error('File is not a PDF');
    }

    // Create blob URL and open in new tab
    const blobUrl = URL.createObjectURL(result.blob);
    
    // Open in new tab
    const newTab = window.open(blobUrl, '_blank');
    
    if (!newTab) {
      // If popup blocked, show error
      throw new Error('Unable to open preview in new tab. Please allow popups for this site.');
    }

    // Clean up the blob URL after a delay to ensure the tab has loaded
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 1000);

  } catch (error) {
    console.error('PDF preview failed:', error);
    throw new Error(`PDF preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
