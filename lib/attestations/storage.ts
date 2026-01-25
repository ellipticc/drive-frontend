
import type { AttestationKey } from './types';

const STORAGE_KEY = 'attestation_keys';

export const AttestationStorage = {
    getKeys(): AttestationKey[] {
        if (typeof window === 'undefined') return [];
        try {
            const json = localStorage.getItem(STORAGE_KEY);
            if (!json) return [];
            return JSON.parse(json);
        } catch (e) {
            console.error('Failed to load attestation keys', e);
            return [];
        }
    },

    saveKey(key: AttestationKey): void {
        const keys = AttestationStorage.getKeys();
        keys.push(key);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    },

    updateKey(updatedKey: AttestationKey): void {
        const keys = AttestationStorage.getKeys();
        const index = keys.findIndex(k => k.id === updatedKey.id);
        if (index !== -1) {
            keys[index] = updatedKey;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
        }
    },

    deleteKey(id: string): void {
        const keys = AttestationStorage.getKeys();
        const newKeys = keys.filter(k => k.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newKeys));
    }
};
