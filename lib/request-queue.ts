/**
 * Request Queue with Priority
 * Ensures critical API calls (dashboard navigation) aren't blocked by bulk operations (uploads/downloads)
 */

interface QueuedRequest {
  priority: 'high' | 'normal' | 'low';
  execute: () => Promise<Response>;
  resolve: (value: Response) => void;
  reject: (error: unknown) => void;
}

export class RequestQueue {
  private queue: QueuedRequest[] = [];
  private activeRequests = 0;
  private maxConcurrent: number;
  private maxConcurrentLowPriority: number;

  constructor(maxConcurrent: number = 6, maxConcurrentLowPriority: number = 4) {
    this.maxConcurrent = maxConcurrent;
    this.maxConcurrentLowPriority = maxConcurrentLowPriority;
  }

  async enqueue(execute: () => Promise<Response>, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<Response> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = { priority, execute, resolve, reject };
      
      // High priority requests go to front, others to back
      if (priority === 'high') {
        this.queue.unshift(request);
      } else {
        this.queue.push(request);
      }
      
      this.processQueue();
    });
  }

  private async processQueue() {
    // Don't start new requests if we're at max capacity
    if (this.activeRequests >= this.maxConcurrent) {
      return;
    }

    // Find next request to process (prioritize high priority)
    const highPriorityIndex = this.queue.findIndex(r => r.priority === 'high');
    const normalPriorityIndex = this.queue.findIndex(r => r.priority === 'normal');
    
    // If we're near low-priority limit and there are high/normal priority requests, skip low priority
    const hasHigherPriority = highPriorityIndex !== -1 || normalPriorityIndex !== -1;
    if (this.activeRequests >= this.maxConcurrentLowPriority && hasHigherPriority) {
      // Only process high/normal priority
      const nextIndex = highPriorityIndex !== -1 ? highPriorityIndex : normalPriorityIndex;
      if (nextIndex === -1) return;
      
      const request = this.queue.splice(nextIndex, 1)[0];
      await this.executeRequest(request);
      return;
    }

    // Normal processing: take first request (high priority is already at front)
    const request = this.queue.shift();
    if (!request) return;

    await this.executeRequest(request);
  }

  private async executeRequest(request: QueuedRequest) {
    this.activeRequests++;
    
    try {
      const result = await request.execute();
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    } finally {
      this.activeRequests--;
      this.processQueue(); // Process next request
    }
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      highPriority: this.queue.filter(r => r.priority === 'high').length,
      normalPriority: this.queue.filter(r => r.priority === 'normal').length,
      lowPriority: this.queue.filter(r => r.priority === 'low').length
    };
  }
}

// Singleton instance
let requestQueueInstance: RequestQueue | null = null;

export function getRequestQueue(): RequestQueue {
  if (!requestQueueInstance) {
    requestQueueInstance = new RequestQueue(6, 4); // Max 6 total, but only 4 for low-priority
  }
  return requestQueueInstance;
}
