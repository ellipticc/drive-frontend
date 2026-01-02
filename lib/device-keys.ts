import { getPublicKey, utils, sign, etc } from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

// Configure SHA-512 for noble/ed25519
// @ts-ignore - noble-ed25519 v2/v3 compatibility
if (!etc.sha512Sync) {
    // @ts-ignore
    etc.sha512Sync = (...m) => sha512(etc.concatBytes(...m));
    // @ts-ignore
    etc.sha512Async = (...m) => Promise.resolve(sha512(etc.concatBytes(...m)));
}

const DB_NAME = 'drive_device_keys';
const STORE_NAME = 'keys';
const DB_VERSION = 1;
const KEY_NAME = 'device_identity';

interface DeviceKeyPair {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
    createdAt: number;
}

/**
 * Open IndexedDB database
 */
const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined') {
            return reject(new Error('IndexedDB is not available on server side'));
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('IndexedDB error:', event);
            reject('Error opening IndexedDB');
        };

        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

/**
 * Store keypair in IndexedDB
 * Private key is stored here and NEVER leaves the device
 */
const storeKeyPair = async (keyPair: DeviceKeyPair): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const request = store.put({
            id: KEY_NAME,
            ...keyPair
        });

        request.onsuccess = () => resolve();
        request.onerror = () => reject('Error storing keypair');
    });
};

/**
 * Get keypair from IndexedDB
 */
const getKeyPair = async (): Promise<DeviceKeyPair | null> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(KEY_NAME);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => reject('Error getting keypair');
        });
    } catch (error) {
        console.warn('Could not access IndexedDB for device keys:', error);
        return null;
    }
};

/**
 * Convert Uint8Array to Hex string
 */
function uint8ArrayToHex(array: Uint8Array): string {
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Initialize device keys
 * call this on successful login
 * 
 * 1. Checks if keys exist in IDB
 * 2. If not, generates new Ed25519 keypair
 * 3. Stores in IDB
 * 4. Returns Public Key (hex)
 */
export async function initializeDeviceKeys(): Promise<string> {
    if (typeof window === 'undefined') return '';

    try {
        // 1. Check existing keys
        const existingKeys = await getKeyPair();

        if (existingKeys) {
            console.log('Device keys already exist', {
                createdAt: new Date(existingKeys.createdAt).toISOString()
            });
            return uint8ArrayToHex(existingKeys.publicKey);
        }

        // 2. Generate new keys if none exist
        console.log('Generating new device identity keys...');

        // Generate private key (32 bytes)
        const privateKey = utils.randomSecretKey();
        // Derive public key
        const publicKey = await getPublicKey(privateKey);

        const newKeyPair: DeviceKeyPair = {
            publicKey,
            privateKey,
            createdAt: Date.now()
        };

        // 3. Store in IDB
        await storeKeyPair(newKeyPair);

        console.log('Device keys generated and stored securely in IndexedDB');

        // 4. Return public key
        return uint8ArrayToHex(publicKey);

    } catch (error) {
        console.error('Failed to initialize device keys:', error);
        // Determine if we should throw or fail silently
        // For now, fail silently but log error, as this shouldn't block login
        return '';
    }
}

/**
 * Sign a message using the device's private key
 * This proves the device identity without revealing the private key
 */
export async function signWithDeviceKey(message: Uint8Array | string): Promise<string> {
    const keys = await getKeyPair();
    if (!keys) {
        throw new Error('Device keys not found. Please log in again to generate them.');
    }

    const messageBytes = typeof message === 'string'
        ? new TextEncoder().encode(message)
        : message;

    // Sign hash(message) or message directly? Ed25519 signs message directly usually
    // noble-ed25519 sign() takes (message, privateKey)
    const signature = await sign(messageBytes, keys.privateKey);

    return uint8ArrayToHex(signature);
}

/**
 * Get the current device's public key
 */
export async function getDevicePublicKey(): Promise<string | null> {
    const keys = await getKeyPair();
    if (keys) {
        return uint8ArrayToHex(keys.publicKey);
    }
    return null;
}
