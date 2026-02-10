import { WorkerPool } from './worker-pool';

// Singleton instance
let decryptionPool: WorkerPool | null = null;

function getDecryptionPool(): WorkerPool {
    if (!decryptionPool) {
        const concurrency = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
        decryptionPool = new WorkerPool(() => {
            return new Worker(new URL('./workers/decrypt-filename.worker.ts', import.meta.url));
        }, {
            maxWorkers: concurrency,
            maxQueueSize: 100,
            taskTimeout: 5000,
        });
    }
    return decryptionPool;
}

/**
 * Decrypts a filename using a background worker thread.
 * This prevents the main thread from freezing when decrypting thousands of filenames.
 */
export async function decryptFilenameInWorker(
    encryptedFilename: string,
    filenameSalt: string,
    masterKey: Uint8Array
): Promise<string> {
    const pool = getDecryptionPool();

    const id = Math.random().toString(36).substring(7);

    return pool.execute<string>({
        id,
        encryptedFilename,
        filenameSalt,
        masterKey
    });
}
