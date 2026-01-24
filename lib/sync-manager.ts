import { syncDb } from './db/sync-db';
import { apiClient } from './api';

class SyncManagerClass {
    private isSyncing = false;
    private listeners: ((pendingCount: number) => void)[] = [];

    constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                console.log('[SyncManager] Online detected. Attempting sync...');
                this.processQueue();
            });

            // Periodically check queue in case of silent failures or stuck items
            setInterval(() => this.processQueue(), 60000); // Check every minute

            // Initial check
            this.updateListeners();
        }
    }

    subscribe(callback: (pendingCount: number) => void) {
        this.listeners.push(callback);
        this.updateListeners(); // Initial value
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    private async updateListeners() {
        const count = await syncDb.getCount();
        this.listeners.forEach(cb => cb(count));
    }

    async enqueueFailedUpload(
        paperId: string,
        type: 'upload_chunk' | 'save_manifest',
        payload: any,
        title?: string
    ) {
        console.warn(`[SyncManager] Enqueueing failed ${type} for paper ${paperId}`);
        await syncDb.enqueue({
            paperId,
            type,
            payload,
            title
        });
        this.updateListeners();
        return true;
    }

    async processQueue() {
        if (this.isSyncing || typeof navigator !== 'undefined' && !navigator.onLine) return;

        this.isSyncing = true;

        try {
            const queue = await syncDb.getAll();
            if (queue.length === 0) {
                this.isSyncing = false;
                return;
            }

            console.log(`[SyncManager] Processing ${queue.length} queued items...`);

            // Sort by creation time to ensure order (e.g. chunk before manifest)
            queue.sort((a, b) => a.createdAt - b.createdAt);

            for (const item of queue) {
                try {
                    let success = false;

                    if (item.type === 'upload_chunk') {
                        // Payload: { chunkId, content, checksum }
                        const { paperId, payload } = item;

                        // Payload contains: { blockId, size, checksum, payloadStr/content }
                        const chunksToUpload = [item.payload];

                        const response = await apiClient.getPaperUploadUrls(paperId, chunksToUpload.map(c => ({
                            blockId: c.blockId,
                            size: c.size,
                            checksum: c.checksum
                        })));

                        if (response.success && response.data && response.data.urls) {
                            const url = response.data.urls[item.payload.blockId];
                            if (url) {
                                const body = item.payload.payloadStr || JSON.stringify(item.payload.content);
                                const uploadRes = await fetch(url, {
                                    method: 'PUT',
                                    body: body,
                                    headers: {
                                        'Content-Type': 'application/x-paper',
                                        'x-amz-checksum-sha256': item.payload.checksum
                                    }
                                });
                                if (uploadRes.ok) success = true;
                            }
                        }
                    } else if (item.type === 'save_manifest') {
                        // Simply calling the API endpoint
                        const response = await apiClient.savePaperBlocks(item.paperId, item.payload);
                        if (response.success) success = true;
                    }

                    if (success) {
                        console.log(`[SyncManager] Item ${item.id} (${item.type}) synced successfully.`);
                        await syncDb.delete(item.id!);
                        this.updateListeners();
                    } else {
                        console.warn(`[SyncManager] Failed to sync item ${item.id}. Retrying later.`);
                        await syncDb.incrementRetry(item.id!);

                        // Exponential Backoff Logic
                        // Delay = min(30s, 1000ms * 2^retryCount)
                        const retryCount = (item.retryCount || 0) + 1;
                        const delayMs = Math.min(30000, 1000 * Math.pow(2, retryCount));
                        console.log(`[SyncManager] Waiting ${delayMs}ms before processing next items due to failure...`);

                        await new Promise(resolve => setTimeout(resolve, delayMs));

                        // If we failed, we might want to stop processing the queue for a bit
                        // rather than failing every single item in succession
                        break;
                    }

                } catch (err) {
                    console.error(`[SyncManager] Error syncing item ${item.id}`, err);
                    await syncDb.incrementRetry(item.id!);

                    // Break loop on critical error to prevent rapid-fire failures
                    break;
                }
            }

        } finally {
            this.isSyncing = false;
            this.updateListeners();
        }
    }
}

export const syncManager = new SyncManagerClass();
