# Secure File Upload System

This module implements a complete browser-side secure file upload pipeline for a hybrid PQC (Post-Quantum Cryptography) end-to-end encrypted storage system.

## Features

- **SHA-256 file hashing** before upload for deduplication
- **File chunking** (configurable 4-8MB chunks)
- **Compression** using pako (gzip) for efficient storage
- **XChaCha20-Poly1305 encryption** per chunk with per-chunk nonces
- **BLAKE3 integrity hashing** for each encrypted chunk
- **Streaming uploads** to Backblaze B2 via presigned URLs
- **Progress callbacks** with detailed stage tracking
- **Resumable uploads** and idempotent operations
- **Memory efficient** processing for large files (multi-GB support)

## Security

- **Zero-knowledge architecture** - plaintext never leaves browser
- **Hybrid PQC encryption** - XChaCha20-Poly1305 + Kyber/Dilithium key wrapping
- **Per-file CEK** (Content Encryption Key) generated client-side
- **Per-chunk encryption** with unique nonces
- **Cryptographic integrity** verification with BLAKE3
- **SHA-256 deduplication** for file-level verification

## Architecture

### Upload Pipeline

1. **File Analysis**: Compute SHA-256 hash of entire file
2. **Chunking**: Split file into 4MB chunks
3. **Compression**: Compress each chunk with gzip
4. **Encryption**: Encrypt compressed chunks with XChaCha20-Poly1305
5. **Integrity**: Compute BLAKE3 hash of each encrypted chunk
6. **Session Init**: Get upload session ID and presigned URLs from backend
7. **Upload**: Stream encrypted chunks to Backblaze B2
8. **Finalize**: Confirm upload completion with backend

### Key Components

- `uploadEncryptedFile()` - Main upload orchestration function
- `KeyManager` - Manages user cryptographic keys and CEK generation
- `Compression Worker` - Web Worker for CPU-intensive compression
- `API Client` - Backend communication for session management

## Usage

```typescript
import { uploadEncryptedFile, UploadProgress } from '@/lib/upload';
import { keyManager } from '@/lib/key-manager';

// Basic usage
async function uploadFile(file: File) {
  // Ensure user is authenticated
  if (!keyManager.hasKeys()) {
    throw new Error('User must be logged in');
  }

  // Progress callback
  const onProgress = (progress: UploadProgress) => {
    console.log(`${progress.stage}: ${progress.overallProgress}%`);
  };

  try {
    const result = await uploadEncryptedFile(file, onProgress);
    console.log('Upload successful:', result.fileId);
    return result;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}
```

## API Reference

### `uploadEncryptedFile(file, onProgress?)`

Main upload function that orchestrates the entire secure upload pipeline.

**Parameters:**
- `file: File` - The file to upload
- `onProgress?: (progress: UploadProgress) => void` - Optional progress callback

**Returns:** `Promise<UploadResult>`

### UploadProgress Interface

```typescript
interface UploadProgress {
  stage: 'hashing' | 'chunking' | 'compressing' | 'encrypting' | 'uploading' | 'finalizing';
  overallProgress: number; // 0-100
  currentChunk?: number;
  totalChunks?: number;
  bytesProcessed?: number;
  totalBytes?: number;
  chunkProgress?: number;
}
```

### UploadResult Interface

```typescript
interface UploadResult {
  fileId: string;
  sessionId: string;
  metadata: FileMetadata;
  chunks: ChunkInfo[];
}
```

## Configuration

- **Chunk Size**: 4MB (configurable via `CHUNK_SIZE`)
- **Compression Level**: 6 (pako gzip level)
- **Concurrency**: 3 simultaneous uploads
- **Hash Algorithms**: SHA-256 (file), BLAKE3 (chunks)

## Dependencies

- `pako` - Compression library
- `@noble/ciphers` - XChaCha20-Poly1305 encryption
- `@noble/hashes` - SHA-256 hashing
- `hash-wasm` - BLAKE3 hashing
- Web Crypto API - Browser crypto primitives

## Backend Integration

The system expects these backend endpoints:

- `POST /upload/init` - Initialize upload session
- `PUT {presignedUrl}` - Upload chunk to Backblaze B2
- `POST /upload/finalize` - Confirm upload completion

## Error Handling

The system includes comprehensive error handling:
- Network failures with retry logic
- Chunk upload failures with partial recovery
- Session management and cleanup
- User-friendly error messages

## Performance

- **Memory efficient**: Streams file data without loading entire file
- **CPU optimized**: Uses Web Workers for compression
- **Network efficient**: Concurrent uploads with controlled parallelism
- **Scalable**: Handles files from KB to multi-GB

## Security Considerations

- All encryption happens client-side
- Keys never leave the browser
- Secure random nonces for each chunk
- Cryptographic integrity verification
- Zero-trust architecture

## Browser Support

Requires modern browsers with:
- Web Crypto API
- Web Workers
- ReadableStream
- BigInt support (for PQC operations)