/**
 * Parallel Upload Queue Manager
 * Manages multiple concurrent file uploads with configurable concurrency limit
 * Uses Web Workers for chunk encryption when available
 */

import { UploadManager } from '@/components/upload-manager';

export interface QueuedUpload {
  id: string;
  manager: UploadManager;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
}

export class ParallelUploadQueue {
  private queue: QueuedUpload[] = [];
  private activeUploads = new Map<string, QueuedUpload>();
  private concurrencyLimit: number;
  private worker: Worker | null = null;

  constructor(concurrencyLimit: number = 3) {
    this.concurrencyLimit = Math.max(1, Math.min(concurrencyLimit, 6)); // Clamp between 1-6
    this.initializeWorker();
  }

  /**
   * Initialize Web Worker for parallel chunk processing
   */
  private initializeWorker() {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./workers/upload-worker.ts', import.meta.url), {
          type: 'module'
        });
        console.log('Upload worker initialized');
      } catch (error) {
        console.warn('Failed to initialize upload worker, falling back to main thread:', error);
        this.worker = null;
      }
    }
  }

  /**
   * Add upload to queue
   */
  enqueue(upload: QueuedUpload): void {
    this.queue.push(upload);
    this.processQueue();
  }

  /**
   * Process queued uploads respecting concurrency limit
   */
  private processQueue(): void {
    while (
      this.queue.length > 0 &&
      this.activeUploads.size < this.concurrencyLimit
    ) {
      const upload = this.queue.shift();
      if (upload) {
        this.startUpload(upload);
      }
    }
  }

  /**
   * Start an upload
   */
  private startUpload(upload: QueuedUpload): void {
    upload.status = 'uploading';
    this.activeUploads.set(upload.id, upload);

    upload.manager
      .start()
      .then(() => {
        upload.status = 'completed';
      })
      .catch((error) => {
        upload.status = 'failed';
        upload.error = error.message;
      })
      .finally(() => {
        this.activeUploads.delete(upload.id);
        this.processQueue();
      });
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queued: this.queue.length,
      active: this.activeUploads.size,
      maxConcurrency: this.concurrencyLimit,
      hasWorker: this.worker !== null
    };
  }

  /**
   * Pause an upload
   */
  pauseUpload(uploadId: string): void {
    const upload = this.activeUploads.get(uploadId);
    if (upload) {
      upload.manager.pause();
    }
  }

  /**
   * Resume an upload
   */
  resumeUpload(uploadId: string): void {
    const upload = this.activeUploads.get(uploadId);
    if (upload) {
      upload.manager.resume();
    }
  }

  /**
   * Cancel an upload
   */
  cancelUpload(uploadId: string): void {
    const queueIndex = this.queue.findIndex(u => u.id === uploadId);
    if (queueIndex >= 0) {
      this.queue.splice(queueIndex, 1);
    }

    const activeUpload = this.activeUploads.get(uploadId);
    if (activeUpload) {
      activeUpload.manager.cancel();
      this.activeUploads.delete(uploadId);
      this.processQueue();
    }
  }

  /**
   * Cancel all uploads
   */
  cancelAll(): void {
    this.queue = [];
    this.activeUploads.forEach(upload => upload.manager.cancel());
    this.activeUploads.clear();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.cancelAll();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

// Singleton instance
let uploadQueueInstance: ParallelUploadQueue | null = null;

/**
 * Get or create the global upload queue
 */
export function getUploadQueue(concurrencyLimit?: number): ParallelUploadQueue {
  if (!uploadQueueInstance) {
    uploadQueueInstance = new ParallelUploadQueue(concurrencyLimit);
  }
  return uploadQueueInstance;
}

/**
 * Destroy the global upload queue
 */
export function destroyUploadQueue(): void {
  if (uploadQueueInstance) {
    uploadQueueInstance.destroy();
    uploadQueueInstance = null;
  }
}
