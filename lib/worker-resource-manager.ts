/**
 * Worker Resource Manager
 * Intelligently manages worker pool lifecycle based on actual feature usage
 * 
 * Instead of creating all worker pools on startup, this manager:
 * - Creates pools only when first needed (lazy loading)
 * - Tracks if a pool is actively being used
 * - Cleans up unused pools after idle timeout to free memory
 * - Reinitializes pools if needed again
 */

import { WorkerPool } from './worker-pool';

export type WorkerPoolType = 
  | 'filename-decryption' 
  | 'share-decryption' 
  | 'download' 
  | 'markdown' 
  | 'highlight' 
  | 'paper' 
  | 'upload' 
  | 'sort';

interface PoolEntry {
  pool: WorkerPool | null;
  factory: () => WorkerPool;
  lastUsedAt: number;
  idleTimeoutMs: number;
  timeoutHandle: NodeJS.Timeout | null;
}

class WorkerResourceManager {
  private pools = new Map<WorkerPoolType, PoolEntry>();
  private readonly IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  private readonly CLEANUP_CHECK_INTERVAL = 60 * 1000; // Check every minute

  constructor() {
    // Start periodic cleanup
    this.startCleanupTimer();
  }

  /**
   * Get or lazily create a worker pool
   * Only creates the pool on first access, then reuses it
   */
  getPool(type: WorkerPoolType): WorkerPool {
    let entry = this.pools.get(type);

    // First time accessing this pool type - register it
    if (!entry) {
      entry = {
        pool: null,
        factory: this.getPoolFactory(type),
        lastUsedAt: Date.now(),
        idleTimeoutMs: this.IDLE_TIMEOUT_MS,
        timeoutHandle: null,
      };
      this.pools.set(type, entry);
    }

    // Initialize pool if not yet created
    if (!entry.pool) {
      entry.pool = entry.factory();
      console.log(`[WorkerPool] Initialized ${type} pool on-demand`);
    }

    // Update last access time and reset idle timeout
    entry.lastUsedAt = Date.now();
    this.resetIdleTimeout(type, entry);

    return entry.pool;
  }

  /**
   * Check if a pool has been initialized already (doesn't initialize if not)
   */
  isPoolActive(type: WorkerPoolType): boolean {
    const entry = this.pools.get(type);
    return entry?.pool !== null;
  }

  /**
   * Get metrics for all active pools
   */
  getActivePoolMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    for (const [type, entry] of this.pools) {
      if (entry.pool) {
        metrics[type] = entry.pool.getMetrics();
      }
    }
    return metrics;
  }

  /**
   * Manually cleanup a specific pool
   */
  destroyPool(type: WorkerPoolType): void {
    const entry = this.pools.get(type);
    if (entry?.pool) {
      entry.pool.terminate();
      entry.pool = null;
      console.log(`[WorkerPool] Terminated ${type} pool`);
    }
    this.clearIdleTimeout(type, entry);
  }

  /**
   * Manually cleanup all pools
   */
  destroyAll(): void {
    for (const [type] of this.pools) {
      this.destroyPool(type);
    }
  }

  /**
   * Reset the idle timeout for a pool
   */
  private resetIdleTimeout(type: WorkerPoolType, entry: PoolEntry): void {
    // Clear existing timeout
    this.clearIdleTimeout(type, entry);

    // Set new timeout (only for non-critical pools)
    if (['markdown', 'highlight'].includes(type)) {
      entry.timeoutHandle = setTimeout(() => {
        this.destroyPool(type);
      }, entry.idleTimeoutMs);
    }
  }

  /**
   * Clear the idle timeout for a pool
   */
  private clearIdleTimeout(type: WorkerPoolType, entry?: PoolEntry): void {
    const e = entry || this.pools.get(type);
    if (e?.timeoutHandle) {
      clearTimeout(e.timeoutHandle);
      e.timeoutHandle = null;
    }
  }

  /**
   * Periodic check for idle pools to clean up
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [type, entry] of this.pools) {
        // Only auto-cleanup non-critical pools after idle timeout
        if (entry.pool && ['markdown', 'highlight'].includes(type)) {
          if (now - entry.lastUsedAt > entry.idleTimeoutMs) {
            console.log(`[WorkerPool] Auto-cleanup ${type} pool (idle for ${(now - entry.lastUsedAt) / 1000}s)`);
            this.destroyPool(type);
          }
        }
      }
    }, this.CLEANUP_CHECK_INTERVAL);
  }

  /**
   * Get the factory function for a pool type
   */
  private getPoolFactory(type: WorkerPoolType): () => WorkerPool {
    switch (type) {
      case 'filename-decryption':
        return () => {
          const concurrency = Math.min((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2, 4);
          return new WorkerPool(() => {
            return new Worker(new URL('./workers/decrypt-filename.worker.ts', import.meta.url));
          }, {
            maxWorkers: concurrency,
            maxQueueSize: 100,
            taskTimeout: 20000,
          });
        };

      case 'share-decryption':
        return () => {
          return new WorkerPool(() => new Worker(new URL('./workers/decrypt-share.worker.ts', import.meta.url)), {
            maxWorkers: 4,
            taskTimeout: 60000,
          });
        };

      case 'download':
        return () => {
          return new WorkerPool(() => new Worker(new URL('./workers/download-worker.ts', import.meta.url)), {
            maxWorkers: 4,
            taskTimeout: 60000,
          });
        };

      case 'markdown':
        return () => {
          return new WorkerPool(
            () => new Worker(new URL('./workers/markdown-worker.ts', import.meta.url), { type: 'module' }),
            {
              maxWorkers: 1,
              maxQueueSize: 30,
              taskTimeout: 15000,
            }
          );
        };

      case 'highlight':
        return () => {
          return new WorkerPool(
            () => new Worker(new URL('./workers/highlight-worker.ts', import.meta.url), { type: 'module' }),
            {
              maxWorkers: 1,
              maxQueueSize: 50,
              taskTimeout: 10000,
            }
          );
        };

      case 'paper':
        return () => {
          // Paper uses a different single-worker pattern, but we wrap it for compatibility
          const worker = new Worker(new URL('./workers/paper.worker.ts', import.meta.url), { type: 'module' });
          return new WorkerPool(() => worker, { maxWorkers: 1, taskTimeout: 30000 });
        };

      case 'upload':
        return () => {
          return new WorkerPool(() => new Worker(new URL('./workers/upload-worker.ts', import.meta.url), { type: 'module' }), {
            maxWorkers: 2,
            taskTimeout: 30000,
          });
        };

      case 'sort':
        return () => {
          return new WorkerPool(() => new Worker(new URL('./workers/sort-worker.ts', import.meta.url)), {
            maxWorkers: 1,
            taskTimeout: 10000,
          });
        };

      default:
        throw new Error(`Unknown worker pool type: ${type}`);
    }
  }
}

// Global singleton instance
let managerInstance: WorkerResourceManager | null = null;

/**
 * Get the global worker resource manager
 */
export function getWorkerManager(): WorkerResourceManager {
  if (!managerInstance) {
    managerInstance = new WorkerResourceManager();
  }
  return managerInstance;
}

/**
 * Get a specific worker pool
 */
export function getWorkerPool(type: WorkerPoolType): WorkerPool {
  return getWorkerManager().getPool(type);
}
