import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'ai_preferences_db';
const STORE_NAME = 'preferences';
const DB_VERSION = 1;

interface AIPreferencesStore {
    key: string;
    value: any;
}

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

export function getDB(): Promise<IDBPDatabase<any>> {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            },
        });
    }
    return dbPromise;
}

export async function saveAIPreferences(preferences: string): Promise<void> {
    const db = await getDB();
    // We only store one item: the encrypted preferences string
    await db.put(STORE_NAME, preferences, 'encrypted_settings');
}

export async function getAIPreferences(): Promise<string | null> {
    const db = await getDB();
    return db.get(STORE_NAME, 'encrypted_settings');
}

export async function clearAIPreferences(): Promise<void> {
    const db = await getDB();
    await db.delete(STORE_NAME, 'encrypted_settings');
}
