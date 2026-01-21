
/**
 * Generic Worker Pool Implementation
 * Used to limit concurrent Web Worker usage for heavy cryptographic operations
 */

export interface WorkerTask<T = unknown> {
    message: unknown;
    transferables?: Transferable[];
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
}

export class WorkerPool {
    private workers: Worker[] = [];
    private freeWorkers: Worker[] = [];
    private taskQueue: WorkerTask<unknown>[] = [];    private workerFactory: () => Worker;
    private maxWorkers: number;

    constructor(workerFactory: () => Worker, maxWorkers: number = Math.min(Math.ceil((navigator.hardwareConcurrency || 4) / 2), 6)) {
        this.workerFactory = workerFactory;
        this.maxWorkers = maxWorkers;
    }

    public execute<T>(message: unknown, transferables?: Transferable[]): Promise<T> {
        return new Promise((resolve, reject) => {
            const task: WorkerTask<T> = { message, transferables, resolve, reject };
            this.schedule(task as WorkerTask<unknown>);
        });
    }

    private schedule(task: WorkerTask<unknown>) {
        if (this.freeWorkers.length > 0 || this.workers.length < this.maxWorkers) {
            this.runTask(task);
        } else {
            this.taskQueue.push(task);
        }
    }

    private runTask(task: WorkerTask<unknown>) {
        let worker: Worker | undefined;

        if (this.freeWorkers.length > 0) {
            worker = this.freeWorkers.pop();
        } else if (this.workers.length < this.maxWorkers) {
            worker = this.workerFactory();
            this.workers.push(worker);
        }

        if (!worker) {
            this.taskQueue.unshift(task);
            return;
        }

        const cleanup = () => {
            if (worker) {
                worker.onmessage = null;
                worker.onerror = null;
                this.freeWorkers.push(worker);
                this.processNext();
            }
        };

        worker.onmessage = (e) => {
            const { id, success, result, error } = e.data;
            if (id === (task.message as { id: string }).id) {
                if (success) {
                    task.resolve(result);
                } else {
                    task.reject(new Error(error));
                }
                cleanup();
            }
        };

        worker.onerror = (err) => {
            task.reject(err instanceof Error ? err : new Error(String(err)));
            cleanup();
        };

        worker.postMessage(task.message, task.transferables || []);
    }

    private processNext() {
        if (this.taskQueue.length > 0 && (this.freeWorkers.length > 0 || this.workers.length < this.maxWorkers)) {
            const task = this.taskQueue.shift()! as WorkerTask<unknown>;
            this.runTask(task);
        }
    }

    public terminate() {
        this.workers.forEach(w => w.terminate());
        this.workers = [];
        this.freeWorkers = [];
        // Reject pending tasks
        this.taskQueue.forEach(task => task.reject(new Error('Worker pool terminated')));
        this.taskQueue = [];
    }
}
