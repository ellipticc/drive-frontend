
/**
 * Production-Grade Generic Worker Pool Implementation
 * Used to manage Web Worker lifecycle, task queuing, timeouts, and error recovery
 * 
 * Features:
 * - Concurrent worker limiting
 * - Task queuing with max queue size
 * - Per-task timeout handling
 * - Worker error recovery and recycling
 * - Memory management and cleanup
 * - Metrics tracking
 */

export interface WorkerTask<T = unknown> {
    id: string;
    message: unknown;
    transferables?: Transferable[];
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
    timeout: NodeJS.Timeout | null;
    createdAt: number;
}

export interface WorkerPoolMetrics {
    totalTasks: number;
    activeTasks: number;
    queuedTasks: number;
    totalWorkers: number;
    freeWorkers: number;
    taskTimeouts: number;
    taskErrors: number;
}

export class WorkerPool {
    private workers: Worker[] = [];
    private freeWorkers: Worker[] = [];
    private taskQueue: WorkerTask<unknown>[] = [];
    private activeTasks: Map<string, WorkerTask<unknown>> = new Map();
    private workerFactory: () => Worker;
    private maxWorkers: number;
    private maxQueueSize: number;
    private taskTimeout: number;
    private metrics = {
        totalTasks: 0,
        taskTimeouts: 0,
        taskErrors: 0,
    };

    constructor(
        workerFactory: () => Worker,
        options?: {
            maxWorkers?: number;
            maxQueueSize?: number;
            taskTimeout?: number;
        }
    ) {
        this.workerFactory = workerFactory;
        this.maxQueueSize = options?.maxQueueSize || 100;
        this.taskTimeout = options?.taskTimeout || 30000; // 30s default

        if (options?.maxWorkers) {
            this.maxWorkers = options.maxWorkers;
        } else {
            // Safe access to navigator for SSR
            const concurrency = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
            this.maxWorkers = Math.min(concurrency * 2, 20);
        }
    }

    public execute<T>(message: unknown, transferables?: Transferable[], timeoutMs?: number): Promise<T> {
        return new Promise((resolve, reject) => {
            // Check queue size limit
            if (this.taskQueue.length >= this.maxQueueSize) {
                reject(new Error(`Worker pool queue full (max: ${this.maxQueueSize})`));
                return;
            }

            const taskId = Math.random().toString(36).substring(7);
            const task: WorkerTask<T> = {
                id: taskId,
                message,
                transferables,
                resolve,
                reject,
                timeout: null,
                createdAt: Date.now(),
            };

            this.metrics.totalTasks++;
            this.schedule(task as WorkerTask<unknown>, timeoutMs);
        });
    }

    private schedule(task: WorkerTask<unknown>, timeoutMs?: number) {
        if (this.freeWorkers.length > 0 || this.workers.length < this.maxWorkers) {
            this.runTask(task, timeoutMs);
        } else {
            this.taskQueue.push(task);
        }
    }

    private runTask(task: WorkerTask<unknown>, timeoutMs?: number) {
        let worker: Worker | undefined;

        if (this.freeWorkers.length > 0) {
            worker = this.freeWorkers.pop();
        } else if (this.workers.length < this.maxWorkers) {
            try {
                worker = this.workerFactory();
                this.workers.push(worker);
            } catch (err) {
                task.reject(new Error(`Failed to create worker: ${err instanceof Error ? err.message : String(err)}`));
                this.processNext();
                return;
            }
        }

        if (!worker) {
            this.taskQueue.unshift(task);
            return;
        }

        // Track active task
        this.activeTasks.set(task.id, task);

        // Set up timeout
        const timeout = timeoutMs || this.taskTimeout;
        task.timeout = setTimeout(() => {
            this.metrics.taskTimeouts++;
            task.timeout = null;
            task.reject(new Error(`Task ${task.id} timed out after ${timeout}ms`));
            this.activeTasks.delete(task.id);
            // Terminate worker on timeout to prevent hung state
            this.terminateWorker(worker!);
            this.processNext();
        }, timeout);

        // Set up message handler
        const messageHandler = (e: MessageEvent) => {
            const responseId = (e.data as any)?.id;
            if (responseId === task.id) {
                cleanup();
                
                const { error, html } = e.data as any;
                if (error) {
                    this.metrics.taskErrors++;
                    task.reject(new Error(error));
                } else {
                    // Return full response object
                    task.resolve(e.data as any);
                }
            }
        };

        // Set up error handler
        const errorHandler = (err: ErrorEvent) => {
            this.metrics.taskErrors++;
            cleanup();
            task.reject(new Error(`Worker error: ${err.message}`));
            // Terminate worker on error to prevent bad state
            this.terminateWorker(worker!);
        };

        const cleanup = () => {
            if (worker) {
                worker.removeEventListener('message', messageHandler);
                worker.removeEventListener('error', errorHandler);
            }
            if (task.timeout) {
                clearTimeout(task.timeout);
                task.timeout = null;
            }
            this.activeTasks.delete(task.id);
            if (worker) {
                this.freeWorkers.push(worker);
            }
            this.processNext();
        };

        worker.addEventListener('message', messageHandler);
        worker.addEventListener('error', errorHandler);

        // Send task to worker
        try {
            worker.postMessage(task.message, task.transferables || []);
        } catch (err) {
            this.metrics.taskErrors++;
            cleanup();
            task.reject(new Error(`Failed to post message to worker: ${err instanceof Error ? err.message : String(err)}`));
            this.terminateWorker(worker);
        }
    }

    private processNext() {
        if (this.taskQueue.length > 0) {
            if (this.freeWorkers.length > 0) {
                const task = this.taskQueue.shift()!;
                this.runTask(task);
            } else if (this.workers.length < this.maxWorkers) {
                const task = this.taskQueue.shift()!;
                this.runTask(task);
            }
        }
    }

    private terminateWorker(worker: Worker) {
        try {
            worker.terminate();
        } catch (err) {
            console.error('Error terminating worker:', err);
        }
        
        // Remove from both arrays
        const idx = this.workers.indexOf(worker);
        if (idx !== -1) {
            this.workers.splice(idx, 1);
        }
        
        const freeIdx = this.freeWorkers.indexOf(worker);
        if (freeIdx !== -1) {
            this.freeWorkers.splice(freeIdx, 1);
        }
    }

    public getMetrics(): WorkerPoolMetrics {
        return {
            totalTasks: this.metrics.totalTasks,
            activeTasks: this.activeTasks.size,
            queuedTasks: this.taskQueue.length,
            totalWorkers: this.workers.length,
            freeWorkers: this.freeWorkers.length,
            taskTimeouts: this.metrics.taskTimeouts,
            taskErrors: this.metrics.taskErrors,
        };
    }

    public terminate() {
        // Terminate all workers
        this.workers.forEach(w => {
            try {
                w.terminate();
            } catch (err) {
                console.error('Error terminating worker:', err);
            }
        });
        this.workers = [];
        this.freeWorkers = [];

        // Reject all pending tasks
        this.taskQueue.forEach(task => {
            if (task.timeout) clearTimeout(task.timeout);
            task.reject(new Error('Worker pool terminated'));
        });
        this.taskQueue = [];

        // Reject all active tasks
        this.activeTasks.forEach(task => {
            if (task.timeout) clearTimeout(task.timeout);
            task.reject(new Error('Worker pool terminated'));
        });
        this.activeTasks.clear();
    }
}
