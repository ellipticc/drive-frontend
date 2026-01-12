
import {
    DownloadSession,
    DownloadChunk,
    getChunkIndex,
    processDecryptInWorker,
    initializeDownloadSession,
    unwrapCEK,
    DownloadProgress
} from './download';
import type { ShareItem } from './api';
import { keyManager } from './key-manager';

interface StreamRequest {
    type: 'STREAM_REQUEST';
    requestId: string;
    fileId: string;
    start: number;
    end?: number;
}

interface StreamResponse {
    success: boolean;
    content?: ArrayBuffer;
    start?: number;
    end?: number;
    totalSize?: number;
    mimeType?: string;
    error?: string;
}

// 16 bytes Auth Tag for Poly1305
const ENCRYPTION_OVERHEAD = 16;

export class StreamManager {
    private static instance: StreamManager;
    private sessions: Map<string, { session: DownloadSession, cek: Uint8Array }> = new Map();
    private pendingRegistrations: Map<string, Promise<void>> = new Map();
    private chunkMaps: Map<string, Array<{ index: number, start: number, end: number, encryptedSize: number }>> = new Map();
    private activeFetches: Map<string, Promise<Uint8Array>> = new Map();

    private constructor() {
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', this.handleMessage.bind(this));
            // Ensure we start receiving messages immediately
            if (navigator.serviceWorker.startMessages) {
                navigator.serviceWorker.startMessages();
            }
        }
    }

    public static getInstance(): StreamManager {
        if (!StreamManager.instance) {
            StreamManager.instance = new StreamManager();
        }
        return StreamManager.instance;
    }

    public async registerFile(fileId: string, shareDetails?: ShareItem, onGetShareCEK?: () => Promise<Uint8Array>) {
        // Check if already registered
        if (this.sessions.has(fileId)) {
            console.log(`[StreamManager] File ${fileId} already registered.`);
            return;
        }

        // If registration is in progress, wait for it
        if (this.pendingRegistrations.has(fileId)) {
            console.log(`[StreamManager] Waiting for existing registration of ${fileId}...`);
            return this.pendingRegistrations.get(fileId);
        }

        const registrationPromise = (async () => {
            try {
                console.log(`[StreamManager] Initializing registration for ${fileId}...`);
                // Initialize full session from backend (metadata + URLs)
                const session = await initializeDownloadSession(fileId);
                console.log(`[StreamManager] Download session initialized for ${fileId}. Getting keys...`);

                let cek: Uint8Array;

                // Handle Share CEK vs User CEK
                if (onGetShareCEK) {
                    const shareCekRaw = await onGetShareCEK();
                    const shareCek = new Uint8Array(shareCekRaw);

                    // Unwrap if needed
                    if (shareDetails && !(((shareDetails as any).is_folder) ?? shareDetails.isFolder) && ((shareDetails as any).wrapped_cek) && ((shareDetails as any).nonce_wrap)) {
                        const { decryptData } = await import('./crypto');
                        try {
                            const wrapped = (shareDetails as any).wrapped_cek;
                            const nonce = (shareDetails as any).nonce_wrap;
                            cek = new Uint8Array(decryptData(wrapped, shareCek, nonce));
                        } catch (e) {
                            console.error('Failed to unwrap shared file key', e);
                            throw e;
                        }
                    } else {
                        cek = shareCek;
                    }
                } else {
                    // Standard User Key Unwrap
                    if (!session.encryption) throw new Error('No encryption metadata');
                    const keys = await keyManager.getUserKeys();
                    cek = await unwrapCEK(session.encryption, keys.keypairs);
                }

                this.sessions.set(fileId, { session, cek });
                this.buildChunkMap(fileId, session);

                console.log(`[StreamManager] Successfully registered ${fileId}. Size: ${session.size}`);

            } catch (err) {
                console.error('[StreamManager] Failed to register file:', err);
                throw err;
            } finally {
                this.pendingRegistrations.delete(fileId);
            }
        })();

        this.pendingRegistrations.set(fileId, registrationPromise);
        return registrationPromise;
    }

    private buildChunkMap(fileId: string, session: DownloadSession) {
        const sortedChunks = [...session.chunks].sort((a, b) => getChunkIndex(a) - getChunkIndex(b));
        const map = [];
        let offset = 0;

        for (let i = 0; i < sortedChunks.length; i++) {
            const chunk = sortedChunks[i];
            let plaintextLimit = 0;

            if (chunk.isCompressed && chunk.compressionOriginalSize) {
                plaintextLimit = chunk.compressionOriginalSize;
            } else {
                plaintextLimit = Math.max(0, chunk.size - ENCRYPTION_OVERHEAD);
            }

            // For the last chunk, ensure it covers perfectly to the reported file size
            if (i === sortedChunks.length - 1) {
                const remaining = session.size - offset;
                if (remaining > 0 && Math.abs(remaining - plaintextLimit) < 100) {
                    plaintextLimit = remaining;
                }
            }

            map.push({
                index: getChunkIndex(chunk),
                start: offset,
                end: offset + plaintextLimit,
                encryptedSize: chunk.size
            });
            offset += plaintextLimit;
        }

        this.chunkMaps.set(fileId, map);
    }

    private async handleMessage(event: MessageEvent) {
        if (!event.data || event.data.type !== 'STREAM_REQUEST') return;

        const { requestId, fileId, start, end } = event.data as StreamRequest;
        console.log(`[StreamManager] Received STREAM_REQUEST ${requestId} for ${fileId}, range: ${start}-${end || ''}`);
        const port = event.ports[0];

        try {
            // If this file is currently being registered in this tab, wait for it
            if (this.pendingRegistrations.has(fileId)) {
                console.log(`[StreamManager] Received request for ${fileId} while registration is pending. Waiting...`);
                await this.pendingRegistrations.get(fileId);
            }

            const result = await this.fetchRange(fileId, start, end);

            if (result.success || this.sessions.has(fileId)) {
                port.postMessage(result, result.content ? [result.content] : []);
            } else {
                port.postMessage({ success: false, requestId });
            }
        } catch (err: unknown) {
            console.error('[StreamManager] Error handling range:', err);
            port.postMessage({ success: false, error: err instanceof Error ? err.message : String(err), requestId });
        }
    }

    public async fetchRange(fileId: string, start: number, explicitEnd?: number): Promise<StreamResponse> {
        console.log(`[StreamManager] fetchRange called for ${fileId}, start: ${start}, end: ${explicitEnd}`);
        const data = this.sessions.get(fileId);
        const map = this.chunkMaps.get(fileId);

        if (!data || !map) {
            console.error(`[StreamManager] fetchRange failed: ${fileId} not registered or map missing.`);
            return { success: false, error: 'File not registered' };
        }

        const { session, cek } = data;
        const totalSize = session.size;

        // Validate range
        if (start >= totalSize) {
            return { success: false, error: 'Range Not Satisfiable' }; // 416
        }

        // Default chunk size to return if end is missing: 2MB or rest of file
        // Browser usually requests small chunks.
        const DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024;
        let end = explicitEnd || Math.min(start + DEFAULT_CHUNK_SIZE - 1, totalSize - 1);

        // Clamp end
        if (end >= totalSize) end = totalSize - 1;

        // Identify needed chunks
        const chunksToFetch = map.filter(c =>
            (c.start <= end && c.end > start) // Overlap check
        );

        if (chunksToFetch.length === 0) {
            return { success: false, error: 'No chunks found for range' };
        }

        console.log(`[StreamManager] Range ${start}-${end} covers chunks: ${chunksToFetch.map(c => c.index).join(',')}`);

        // Fetch and decrypt needed chunks
        const buffers: Uint8Array[] = [];
        let totalLength = 0;

        for (const chunkInfo of chunksToFetch) {
            const chunkDef = session.chunks.find(c => getChunkIndex(c) === chunkInfo.index);
            if (!chunkDef) continue; // Should not happen

            try {
                const bytes = await this.getDecryptedChunk(fileId, chunkDef, cek);
                buffers.push(bytes);
                totalLength += bytes.length;
            } catch (e) {
                console.error(`Failed to fetch chunk ${chunkInfo.index}`, e);
                throw e;
            }
        }

        // Concatenate
        const fullBuffer = new Uint8Array(totalLength);
        let pos = 0;
        for (const b of buffers) {
            fullBuffer.set(b, pos);
            pos += b.length;
        }

        // Calculate slice within the fullBuffer
        // The `fullBuffer` starts at `chunksToFetch[0].start`.
        // Requested `start` is likely >= `chunksToFetch[0].start`.
        const bufferStartOffset = chunksToFetch[0].start;

        const sliceStart = start - bufferStartOffset;
        const sliceEnd = sliceStart + (end - start + 1);

        const finalSlice = fullBuffer.slice(sliceStart, sliceEnd);

        return {
            success: true,
            content: finalSlice.buffer, // Transferable
            start,
            end: start + finalSlice.length - 1,
            totalSize,
            mimeType: session.mimetype
        };
    }

    private async getDecryptedChunk(fileId: string, chunk: DownloadChunk, cek: Uint8Array): Promise<Uint8Array> {
        const cacheKey = `${fileId}-chunk-${getChunkIndex(chunk)}`;

        // Deduplication: if already fetching, return promise
        if (this.activeFetches.has(cacheKey)) {
            return this.activeFetches.get(cacheKey)!;
        }

        const promise = (async () => {
            try {
                const resp = await fetch(chunk.getUrl);
                if (!resp.ok) throw new Error(`Fetch error ${resp.status}`);
                const arrayBuffer = await resp.arrayBuffer();
                let chunkData = new Uint8Array(arrayBuffer);

                // Strip B2 trailers/padding if fetches exceeded expected size
                // (Should handle this better for encrypted streams, but assuming exact fetch)
                if (chunkData.length > chunk.size) {
                    chunkData = chunkData.subarray(0, chunk.size);
                }

                if (!chunk.nonce) throw new Error('No nonce');

                const isCompressed = !!(chunk.isCompressed && chunk.compressionAlgorithm);

                const decrypted = await processDecryptInWorker(
                    chunkData,
                    cek,
                    chunk.nonce,
                    isCompressed,
                    chunk.shaHash
                );

                return decrypted;
            } finally {
                this.activeFetches.delete(cacheKey);
            }
        })();

        this.activeFetches.set(cacheKey, promise);
        return promise;
    }
}
