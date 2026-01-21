/**
 * Transfer Queue for Bulk Operations (Chunk Uploads/Downloads)
 * 
 * Separate from API request queue to prevent throttling transfers that already
 * have presigned URLs. This queue focuses on maximizing network throughput
 * without blocking dashboard API calls.
 */

interface QueuedTransfer {
  execute: () => Promise<Response>;
  resolve: (value: Response) => void;
  reject: (error: unknown) => void;
}

export class TransferQueue {
  private queue: QueuedTransfer[] = [];
  private activeTransfers = 0;
  private maxConcurrent: number;

  constructor(maxConcurrent: number = 20) {
    // Higher limit than API queue - we want to maximize network throughput
    this.maxConcurrent = maxConcurrent;
  }

  async enqueue(execute: () => Promise<Response>): Promise<Response> {
    return new Promise((resolve, reject) => {
      const transfer: QueuedTransfer = { execute, resolve, reject };
      this.queue.push(transfer);
      this.processQueue();
    });
  }

  private async processQueue() {
    // Process all queued transfers up to max concurrency
    while (this.activeTransfers < this.maxConcurrent && this.queue.length > 0) {
      const transfer = this.queue.shift();
      if (!transfer) break;
      
      this.executeTransfer(transfer);
    }
  }

  private async executeTransfer(transfer: QueuedTransfer) {
    this.activeTransfers++;
    
    try {
      const result = await transfer.execute();
      transfer.resolve(result);
    } catch (error) {
      transfer.reject(error);
    } finally {
      this.activeTransfers--;
      this.processQueue(); // Process next transfer
    }
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      activeTransfers: this.activeTransfers,
      maxConcurrent: this.maxConcurrent
    };
  }

  // Allow dynamic adjustment of concurrency (e.g., during navigation)
  setMaxConcurrent(max: number) {
    this.maxConcurrent = max;
    this.processQueue(); // Process any queued items if we increased limit
  }
}

// Singleton instance
let transferQueueInstance: TransferQueue | null = null;

export function getTransferQueue(): TransferQueue {
  if (!transferQueueInstance) {
    transferQueueInstance = new TransferQueue(20); // High limit for transfers
  }
  return transferQueueInstance;
}
