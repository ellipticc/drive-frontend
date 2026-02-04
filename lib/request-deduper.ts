// Request deduplication and batching for API calls
// Prevents duplicate requests and reduces server load

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
  abortController?: AbortController;
}

class RequestDeduper {
  private pendingRequests = new Map<string, PendingRequest<any>>();
  private readonly maxAge = 30000; // 30 seconds

  // Generate a unique key for the request
  private generateKey(endpoint: string, method: string, body?: any): string {
    const bodyStr = body ? JSON.stringify(body) : '';
    return `${method}:${endpoint}:${bodyStr}`;
  }

  // Clean up old requests
  private cleanup(): void {
    const now = Date.now();
    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.maxAge) {
        this.pendingRequests.delete(key);
        // Abort the request if it has an AbortController
        if (request.abortController) {
          request.abortController.abort();
        }
      }
    }
  }

  // Deduplicate a request
  async dedupe<T>(
    endpoint: string,
    method: string,
    requestFn: () => Promise<T>,
    body?: any
  ): Promise<T> {
    const key = this.generateKey(endpoint, method, body);

    // Check if we have a pending request
    const existing = this.pendingRequests.get(key);
    if (existing && Date.now() - existing.timestamp < this.maxAge) {
      return existing.promise;
    }

    // Clean up old requests periodically
    if (Math.random() < 0.1) { // 10% chance to cleanup
      this.cleanup();
    }

    // Create new request
    const abortController = new AbortController();
    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
      abortController
    });

    return promise;
  }

  // Cancel all pending requests
  cancelAll(): void {
    for (const [key, request] of this.pendingRequests.entries()) {
      if (request.abortController) {
        request.abortController.abort();
      }
    }
    this.pendingRequests.clear();
  }

  // Get stats for monitoring
  getStats(): { pending: number; total: number } {
    return {
      pending: this.pendingRequests.size,
      total: this.pendingRequests.size
    };
  }
}

export const requestDeduper = new RequestDeduper();