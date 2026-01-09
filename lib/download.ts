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
import { keyManager, UserKeys, UserKeypairs } from './key-manager';
import { decompressChunk, CompressionAlgorithm } from './compression';
import { WorkerPool } from './worker-pool';

// Lazy-initialized worker pool
let downloadWorkerPool: WorkerPool | null = null;

const getDownloadWorkerPool = () => {
  if (!downloadWorkerPool) {
    downloadWorkerPool = new WorkerPool(() => new Worker(new URL('./workers/download-worker.ts', import.meta.url)));
  }
  return downloadWorkerPool;
};

// Utility function to convert Uint8Array to base64 safely (avoids stack overflow)
function uint8ArrayToBase64(array: Uint8Array): string {
  // Process in chunks to avoid stack overflow with large arrays
  const chunkSize = 8192; // 8KB chunks
  let result = '';

  for (let i = 0; i < array.length; i += chunkSize) {
    const chunk = array.subarray(i, i + chunkSize);
    // Use apply with the typed array directly (works in modern engines) or strictly cast if needed
    // String.fromCharCode.apply handles Uint8Array in most modern contexts
    result += String.fromCharCode.apply(null, chunk as unknown as number[]);
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
  shaHash: string | null;
  nonce: string | null;
  getUrl: string;
  // Compression metadata
  isCompressed?: boolean;
  compressionAlgorithm?: string;
  compressionOriginalSize?: number;
  compressionCompressedSize?: number;
}


export interface PauseController {
  isPaused: boolean;
  waitIfPaused: () => Promise<void>;
}

export interface DownloadManifest {
  version: string;
  fileId: string;
  originalFilename: string;
  size: number;
  mimetype: string;
  shaHash: string | null;
  chunkCount: number;
  chunks: Array<{
    index: number;
    size: number;
    shaHash: string | null;
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
  argon2idParams?: {
    time: number;
    mem: number;
    parallelism: number;
    hashLen: number;
  };
}

// Response shape returned by the backend for download initialization
export interface DownloadUrlsResponse {
  fileId: string;
  storageKey: string;
  originalFilename: string;
  filenameSalt?: string;
  mimetype: string;
  size: number;
  sha256: string | null;
  chunkCount: number;
  chunks: Array<{
    index: number;
    size: number;
    sha256: string | null;
    nonce?: string | null;
    isCompressed?: boolean;
    compressionAlgorithm?: CompressionAlgorithm;
    compressionOriginalSize?: number;
    compressionCompressedSize?: number;
  }>;
  presigned?: Array<{
    chunkIndex: number;
    getUrl: string;
    objectKey: string;
  }>;
  manifest?: DownloadManifest;
  signatures?: {
    ed25519?: { alg: string; signedAt: number | null; signature: string };
    dilithium?: { alg: string; signedAt: number | null; signature: string };
  };
  encryption?: DownloadEncryption;
  storageType: string;
}

export interface DownloadSession {
  fileId: string;
  filename: string;
  originalFilename: string;
  mimetype: string;
  size: number;
  shaHash: string | null;
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
  shaHash: string | null;
}

// Configuration
// const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks (matches upload) - removed unused constant

/**
 * Process decryption and decompression in the Download Worker
 */
export const processDecryptInWorker = (
  encryptedChunk: Uint8Array,
  key: Uint8Array,
  nonce: string,
  isCompressed: boolean,
  expectedHash?: string | null
): Promise<Uint8Array> => {
  const chunkBuffer = encryptedChunk.buffer.slice(encryptedChunk.byteOffset, encryptedChunk.byteOffset + encryptedChunk.byteLength);

  return getDownloadWorkerPool().execute({
    type: 'decrypt_chunk',
    id: 'decrypt', // Worker pool manages queue, ID is just for worker internal check if needed
    encryptedChunk: new Uint8Array(chunkBuffer),
    key,
    nonce,
    isCompressed,
    expectedHash
  }, [chunkBuffer]);
};

/**
 * Verify file integrity in Worker using BLAKE3
 */
const verifyIntegrityInWorker = async (fileData: Uint8Array): Promise<string> => {
  // Zero-copy transfer of the file data
  const buffer = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength);

  return getDownloadWorkerPool().execute({
    type: 'verify_integrity',
    id: 'verify',
    fileData: new Uint8Array(buffer)
  }, [buffer]);
};

/**
 * Get the chunk index from a chunk object (handles both chunkIndex and index properties)
 */
export function getChunkIndex(chunk: DownloadChunk): number {
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
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
  pauseController?: PauseController
): Promise<DownloadResult> {
  try {
    // Stage 1: Get download URLs and metadata from backend
    onProgress?.({ stage: 'initializing', overallProgress: 0 });
    const session = await initializeDownloadSession(fileId);
    onProgress?.({ stage: 'initializing', overallProgress: 10 });

    // Stage 2 & 3: Pipelined Download & Decrypt
    // Concurrently downloads and decrypts chunks to maximize throughput and minimize memory
    onProgress?.({ stage: 'downloading', overallProgress: 15 });

    // Use the streaming pipeline instead of serial download->decrypt
    const decryptedChunks = await pipelineDownloadAndDecrypt(session, cek, onProgress, signal, pauseController);

    // Stage 4: Assemble file
    onProgress?.({ stage: 'assembling', overallProgress: 90 });
    const fileBlob = await assembleFile(decryptedChunks, session.mimetype);

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
    throw new Error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Pipelined Download & Decrypt
 * Downloads chunks and immediately decrypts them in workers.
 * Saves memory (discards encrypted data) and improves speed (parallel net+cpu).
 */
async function pipelineDownloadAndDecrypt(
  session: DownloadSession,
  cek: Uint8Array,
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
  pauseController?: PauseController
): Promise<Uint8Array[]> {
  const chunks = session.chunks;
  const totalChunks = chunks.length;
  // Initialize array (holes are fine, we fill by index)
  const decryptedChunks: Uint8Array[] = new Array(totalChunks);

  const totalBytes = session.size; // Metadata size
  let completedChunks = 0;
  let decryptedBytes = 0;
  let lastProgressUpdate = 0;
  const startTime = Date.now();

  const reportProgress = () => {
    const now = Date.now();
    if (now - lastProgressUpdate > 100 || completedChunks === totalChunks) {
      lastProgressUpdate = now;
      const elapsed = (now - startTime) / 1000;
      const speed = elapsed > 0 ? decryptedBytes / elapsed : 0;
      const remaining = totalBytes - decryptedBytes;
      const eta = speed > 0 ? remaining / speed : 0;

      onProgress?.({
        stage: 'downloading',
        overallProgress: 15 + (decryptedBytes / totalBytes) * 75,
        currentChunk: completedChunks,
        totalChunks,
        bytesDownloaded: decryptedBytes, // Technically decrypted bytes
        totalBytes: totalBytes,
        downloadSpeed: speed,
        timeRemaining: eta
      });
    }
  };

  const concurrency = 6; // High concurrency for small chunks, B2 handles parallel well
  const semaphore = new Semaphore(concurrency);

  const tasks = chunks.map(async (chunk) => {
    await semaphore.acquire();
    try {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (pauseController?.isPaused) await pauseController.waitIfPaused();

      // 1. Fetch
      const response = await fetch(chunk.getUrl, { signal, credentials: 'omit' });
      if (!response.ok) throw new Error(`Fetch failed ${response.status}`);

      const chunkData = new Uint8Array(await response.arrayBuffer());

      // 2. Decrypt (Worker)
      // Adjust for B2 Trailers if needed
      let dataToDecrypt = chunkData;
      if (chunkData.length > chunk.size) {
        dataToDecrypt = chunkData.subarray(0, chunk.size);
      }

      const index = getChunkIndex(chunk);
      if (!chunk.nonce) throw new Error(`Missing nonce for chunk ${index}`);

      const isCompressed = !!(chunk.isCompressed && chunk.compressionAlgorithm);

      const decrypted = await processDecryptInWorker(
        dataToDecrypt,
        cek,
        chunk.nonce,
        isCompressed,
        chunk.shaHash // Verify integrity in worker
      );

      // 3. Store
      decryptedChunks[index] = decrypted;

      // 4. Update Stats
      completedChunks++;
      decryptedBytes += decrypted.length; // Use actual decrypted size
      reportProgress();

    } finally {
      semaphore.release();
    }
  });

  await Promise.all(tasks);
  return decryptedChunks;
}

/**
 * Decrypt downloaded chunks using a pre-unwrapped CEK
 * Also handles decompression if chunks were compressed before encryption
 */

export async function downloadEncryptedFile(
  fileId: string,
  userKeys?: UserKeys,
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
  pauseController?: PauseController
): Promise<DownloadResult> {
  try {
    // Get user keys from KeyManager if not provided
    const keys = userKeys || await keyManager.getUserKeys();

    // Stage 1: Get download URLs and metadata from backend
    onProgress?.({ stage: 'initializing', overallProgress: 0 });
    const session = await initializeDownloadSession(fileId);
    onProgress?.({ stage: 'initializing', overallProgress: 10 });

    if (!session.encryption) {
      throw new Error('No encryption metadata available');
    }

    // Unwrap CEK
    const cek = await unwrapCEK(session.encryption, keys.keypairs);

    // Stage 2 & 3: Pipelined Download & Decrypt
    onProgress?.({ stage: 'downloading', overallProgress: 15 });
    const decryptedChunks = await pipelineDownloadAndDecrypt(session, cek, onProgress, signal, pauseController);

    // Stage 4: Assemble file
    onProgress?.({ stage: 'assembling', overallProgress: 90 });
    const fileBlob = await assembleFile(decryptedChunks, session.mimetype);

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
    // Unpack AbortErrors or explicit cancellations
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof Error && (error.message === 'Aborted' || error.message.includes('AbortError'))) {
      throw error;
    }

    throw new Error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


/**
 * Initialize download session by fetching URLs and metadata from backend
 */
export async function initializeDownloadSession(fileId: string): Promise<DownloadSession> {
  const response = await apiClient.getDownloadUrls(fileId);

  if (!response.success || !response.data) {
    throw new Error('Failed to initialize download session');
  }

  const data = response.data as DownloadUrlsResponse; // Cast to known response shape

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
  const mergedChunks: DownloadChunk[] = data.chunks.map((chunk: DownloadUrlsResponse['chunks'][0]) => {
    // Find the corresponding presigned URL entry
    const presignedEntry = data.presigned?.find((p) => p.chunkIndex === chunk.index);
    if (!presignedEntry) {
      throw new Error(`No presigned URL found for chunk ${chunk.index}`);
    }

    return {
      chunkIndex: chunk.index,
      index: chunk.index, // Keep both for compatibility
      objectKey: presignedEntry.objectKey,
      size: Number(chunk.size),
      shaHash: chunk.sha256,
      nonce: chunk.nonce ?? null,
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
    size: Number(data.size),
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
export async function unwrapCEK(encryption: DownloadEncryption, keypairs: UserKeypairs): Promise<Uint8Array> {
  const { ml_kem768 } = await import('@noble/post-quantum/ml-kem.js');

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


/**
 * Assemble decrypted chunks into a single file blob
 */
async function assembleFile(decryptedChunks: Uint8Array[], mimetype: string): Promise<Blob> {
  // OPTIMIZATION: Construct Blob directly from chunks. 
  // This avoids creating a duplicate Uint8Array of the entire file, saving massive memory and CPU.
  return new Blob(decryptedChunks as any, { type: mimetype });
}

/**
 * Download file and trigger browser download (single file - no ZIP)
 */
export async function downloadFileToBrowser(
  fileId: string,
  userKeys?: UserKeys,
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
  pauseController?: PauseController
): Promise<DownloadResult> {
  const result = await downloadEncryptedFile(fileId, userKeys, onProgress, signal, pauseController);

  // Create download link and trigger download
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return result;
}

/**
 * Recursively get all files and folders in a folder and subfolders
 */
export async function getRecursiveFolderContents(folderId: string, basePath: string = '', userKeys?: UserKeys): Promise<{
  files: Array<{ fileId: string, relativePath: string, filename: string }>,
  folders: Array<{ folderId: string, relativePath: string, folderName: string }>
}> {
  const allFiles: Array<{ fileId: string, relativePath: string, filename: string }> = [];
  const allFolders: Array<{ folderId: string, relativePath: string, folderName: string }> = [];

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
  userKeys?: UserKeys,
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
  pauseController?: PauseController
): Promise<void> {
  try {
    // Get all files and folders recursively
    onProgress?.({ stage: 'initializing', overallProgress: 0, totalBytes: 0, bytesDownloaded: 0 });
    const folderContents = await getRecursiveFolderContents(folderId, '', userKeys);
    const allFiles = folderContents.files;
    const allFolders = folderContents.folders;

    if (allFiles.length === 0 && allFolders.length === 0) {
      throw new Error('Folder is empty');
    }

    // Calculate total size first for accurate progress
    let totalBytes = 0;
    for (const file of allFiles) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      try {
        const session = await initializeDownloadSession(file.fileId);
        totalBytes += Number(session.size);
      } catch (err) {
        console.warn(`Failed to get size for file ${file.filename}:`, err);
      }
    }

    // Emit initial progress with known total size
    onProgress?.({ stage: 'downloading', overallProgress: 0, totalBytes, bytesDownloaded: 0 });

    // Download all files
    const downloadedFiles: Array<{ relativePath: string, filename: string, blob: Blob }> = [];
    let completedFiles = 0;
    let totalDownloadedBytes = 0;

    for (const file of allFiles) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (pauseController?.isPaused) await pauseController.waitIfPaused();

      const result = await downloadEncryptedFile(file.fileId, userKeys, (progress) => {
        // Update total progress based on bytes
        const currentFileBytes = progress.bytesDownloaded || 0;
        const currentTotalDownloaded = totalDownloadedBytes + currentFileBytes;

        // Calculate percentage based on bytes if we have a valid total, otherwise fallback evenly
        let overallProgress = 0;
        if (totalBytes > 0) {
          overallProgress = (currentTotalDownloaded / totalBytes) * 90; // Allocate 90% for downloading
        } else {
          // Fallback if totalBytes is 0 (shouldn't happen for non-empty files)
          const fileProgress = progress.overallProgress / 100;
          overallProgress = ((completedFiles + fileProgress) / allFiles.length) * 90;
        }

        onProgress?.({
          stage: 'downloading',
          overallProgress: Math.min(overallProgress, 90),
          currentChunk: completedFiles + 1,
          totalChunks: allFiles.length,
          bytesDownloaded: currentTotalDownloaded,
          totalBytes: totalBytes,
          downloadSpeed: progress.downloadSpeed,
          timeRemaining: progress.timeRemaining
        });
      }, signal, pauseController);

      downloadedFiles.push({
        relativePath: file.relativePath,
        filename: result.filename,
        blob: result.blob
      });

      completedFiles++;
      totalDownloadedBytes += result.size;
    }

    // Create ZIP with both files and folders
    onProgress?.({ stage: 'assembling', overallProgress: 95, totalBytes, bytesDownloaded: totalBytes });
    const zipBlob = await createZipFromFilesAndFolders(downloadedFiles, allFolders, folderName);
    onProgress?.({ stage: 'assembling', overallProgress: 98, totalBytes, bytesDownloaded: totalBytes });

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

    onProgress?.({ stage: 'complete', overallProgress: 100, totalBytes, bytesDownloaded: totalBytes });

  } catch (error) {
    // Check for abort errors
    if (error instanceof Error && (
      error.name === 'AbortError' ||
      error.message.includes('Aborted') ||
      error.message.includes('BodyStreamBuffer was aborted') ||
      error.message.includes('The operation was aborted')
    )) {
      console.log('Folder download cancelled by user');
      return; // Return silently
    }
    console.error('Folder ZIP download failed:', error);
    throw new Error(`Folder download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Download multiple items as ZIP with proper naming
 */
export async function downloadMultipleItemsAsZip(
  items: Array<{ id: string, name: string, type: "file" | "folder" }>,
  userKeys?: UserKeys,
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
  pauseController?: PauseController
): Promise<void> {
  try {
    // Generate timestamp and random hex
    const timestamp = Math.floor(Date.now() / 1000);
    const randomHex = Math.random().toString(16).substring(2, 10);
    const zipName = `files-${timestamp}-${randomHex}.zip`;

    // Get all files and folders recursively from all selected items
    onProgress?.({ stage: 'initializing', overallProgress: 0, totalBytes: 0, bytesDownloaded: 0 });
    const allFiles: Array<{ fileId: string, relativePath: string, filename: string }> = [];
    const allFolders: Array<{ folderId: string, relativePath: string, folderName: string }> = [];

    for (const item of items) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
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

    // Calculate total size first for accurate progress
    let totalBytes = 0;
    for (const file of allFiles) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      try {
        const session = await initializeDownloadSession(file.fileId);
        totalBytes += Number(session.size);
      } catch (err) {
        console.warn(`Failed to get size for file ${file.filename}:`, err);
      }
    }

    // Emit initial progress
    onProgress?.({ stage: 'downloading', overallProgress: 0, totalBytes, bytesDownloaded: 0 });

    // Download all files
    const downloadedFiles: Array<{ relativePath: string, filename: string, blob: Blob }> = [];
    let completedFiles = 0;
    let totalDownloadedBytes = 0;

    for (const file of allFiles) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (pauseController?.isPaused) await pauseController.waitIfPaused();

      const result = await downloadEncryptedFile(file.fileId, userKeys, (progress) => {
        // Update total progress based on bytes
        const currentFileBytes = progress.bytesDownloaded || 0;
        const currentTotalDownloaded = totalDownloadedBytes + currentFileBytes;

        // Calculate percentage based on bytes if we have a valid total
        let overallProgress = 0;
        if (totalBytes > 0) {
          overallProgress = (currentTotalDownloaded / totalBytes) * 90; // Allocate 90% for downloading
        } else {
          const fileProgress = progress.overallProgress / 100;
          overallProgress = ((completedFiles + fileProgress) / allFiles.length) * 90;
        }

        onProgress?.({
          stage: 'downloading',
          overallProgress: Math.min(overallProgress, 90),
          currentChunk: completedFiles + 1,
          totalChunks: allFiles.length,
          bytesDownloaded: currentTotalDownloaded,
          totalBytes: totalBytes,
          downloadSpeed: progress.downloadSpeed,
          timeRemaining: progress.timeRemaining
        });
      }, signal, pauseController);

      downloadedFiles.push({
        relativePath: file.relativePath,
        filename: result.filename,
        blob: result.blob
      });

      completedFiles++;
      totalDownloadedBytes += result.size;
    }

    // Create ZIP with both files and folders
    onProgress?.({ stage: 'assembling', overallProgress: 95, totalBytes, bytesDownloaded: totalBytes });
    const zipBlob = await createZipFromFilesAndFolders(downloadedFiles, allFolders, '');
    onProgress?.({ stage: 'assembling', overallProgress: 98, totalBytes, bytesDownloaded: totalBytes });

    // Trigger download
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onProgress?.({ stage: 'complete', overallProgress: 100, totalBytes, bytesDownloaded: totalBytes });

  } catch (error) {
    // Check for abort errors
    if (error instanceof Error && (
      error.name === 'AbortError' ||
      error.message.includes('Aborted') ||
      error.message.includes('BodyStreamBuffer was aborted') ||
      error.message.includes('The operation was aborted')
    )) {
      console.log('Bulk download cancelled by user');
      return; // Return silently
    }
    console.error('Bulk ZIP download failed:', error);
    throw new Error(`Bulk download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create ZIP file from array of files and folders with their relative paths
 */
export async function createZipFromFilesAndFolders(
  files: Array<{ relativePath: string, filename: string, blob: Blob }>,
  folders: Array<{ folderId: string, relativePath: string, folderName: string }>,
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
    zip(zipData, { level: 0 }, (err: Error | null, data?: Uint8Array) => {
      if (err) {
        reject(err);
      } else {
        // `data` is a Uint8Array from fflate
        // Use .slice() to create a concrete Uint8Array backed by an ArrayBuffer so Blob accepts it
        resolve(new Blob([data!.slice()], { type: 'application/zip' }));
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
