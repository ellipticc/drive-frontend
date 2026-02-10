import { getWorkerPool } from './worker-resource-manager';

/**
 * Decrypts a filename using a background worker thread.
 * This prevents the main thread from freezing when decrypting thousands of filenames.
 * 
 * Uses the WorkerResourceManager for smart lazy loading and idle cleanup.
 */
export async function decryptFilenameInWorker(
    encryptedFilename: string,
    filenameSalt: string,
    masterKey: Uint8Array
): Promise<string> {
    const pool = getWorkerPool('filename-decryption');

    const id = Math.random().toString(36).substring(7);

    return pool.execute<string>({
        id,
        encryptedFilename,
        filenameSalt,
        masterKey
    });
}
