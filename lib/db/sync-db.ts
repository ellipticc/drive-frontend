import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface PaperSyncItem {
    id?: number;
    paperId: string;
    type: 'upload_chunk' | 'save_manifest';
    payload: any; // The JSON payload we wanted to send to API
    checksum?: string; // For integrity
    retryCount: number;
    createdAt: number;
    title?: string;
}

interface DriveSyncDB extends DBSchema {
    upload_queue: {
        key: number;
        value: PaperSyncItem;
        indexes: { 'by-paper': string };
    };
}

const DB_NAME = 'drive-sync-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<DriveSyncDB>> | null = null;

function getDb() {
    if (!dbPromise) {
        dbPromise = openDB<DriveSyncDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                const store = db.createObjectStore('upload_queue', { keyPath: 'id', autoIncrement: true });
                store.createIndex('by-paper', 'paperId');
            },
        });
    }
    return dbPromise;
}

export const syncDb = {
    async enqueue(item: Omit<PaperSyncItem, 'id' | 'createdAt' | 'retryCount'>) {
        const db = await getDb();
        return db.add('upload_queue', {
            ...item,
            createdAt: Date.now(),
            retryCount: 0
        });
    },

    async getAll() {
        const db = await getDb();
        return db.getAll('upload_queue');
    },

    async delete(id: number) {
        const db = await getDb();
        return db.delete('upload_queue', id);
    },

    async incrementRetry(id: number) {
        const db = await getDb();
        const tx = db.transaction('upload_queue', 'readwrite');
        const store = tx.objectStore('upload_queue');
        const item = await store.get(id);
        if (item) {
            item.retryCount = (item.retryCount || 0) + 1;
            await store.put(item);
        }
        await tx.done;
    },

    async getCount() {
        const db = await getDb();
        return db.count('upload_queue');
    }
};
