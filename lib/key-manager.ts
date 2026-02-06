/**
 * Key Manager - Provides access to user's cryptographic keys
 * Manages CEK generation and access to PQC keypairs
 */

import { decryptUserPrivateKeys, UserCryptoData } from './crypto';
import type { UserData } from './api';
import { cacheManager } from './cache-manager';

export interface UserKeypairs {
  ed25519PrivateKey: Uint8Array;
  ed25519PublicKey: string;
  dilithiumPrivateKey: Uint8Array;
  dilithiumPublicKey: string;
  x25519PrivateKey: Uint8Array;
  x25519PublicKey: string;
  kyberPrivateKey: Uint8Array;
  kyberPublicKey: string;
}

export interface UserKeys {
  cek: Uint8Array; // Content Encryption Key (32 bytes)
  keypairs: UserKeypairs;
}

class KeyManager {
  private cachedKeys: UserKeys | null = null;
  private userData: UserCryptoData | null = null;
  private readonly STORAGE_KEY = 'user_crypto_data';

  constructor() {
    // Try to restore user data from localStorage on initialization
    this.restoreFromStorage();
  }

  /**
   * Initialize KeyManager with user data from login
   */
  async initialize(userData: UserData | UserCryptoData): Promise<void> {
    if (!userData?.crypto_keypairs?.pqcKeypairs) {
      throw new Error('Invalid user data: missing crypto keypairs');
    }

    const requiredKeys = ['ed25519', 'x25519', 'kyber', 'dilithium'] as const;
    for (const keyType of requiredKeys) {
      const keypair = userData.crypto_keypairs.pqcKeypairs[keyType as typeof requiredKeys[number]];
      if (!keypair) {
        throw new Error(`Missing ${keyType} keypair in user data`);
      }

      const requiredFields = ['publicKey', 'encryptedPrivateKey', 'privateKeyNonce', 'encryptionKey', 'encryptionNonce'];
      for (const field of requiredFields) {
        const value = (keypair as unknown as Record<string, unknown>)[field];
        if (!value) {
          throw new Error(`Missing ${field} in ${keyType} keypair`);
        }

        if (typeof value === 'string') {
          const maxLength = field === 'encryptedPrivateKey' ? 6000 :  // Increased for PQC keys
            field === 'publicKey' ? 5000 :             // Increased for PQC public keys (hex encoded)
              field === 'encryptionKey' ? 200 :
                field === 'encryptionNonce' ? 100 : 1000;
          if ((value as string).length > maxLength) {
            // console.error(`Suspiciously long ${field} in ${keyType} keypair: ${(value as string).length} characters (max: ${maxLength})`);
            throw new Error(`Corrupted ${field} data in ${keyType} keypair`);
          }
        }
      }
    }

    this.userData = userData;
    this.cachedKeys = null; // Clear cache to force re-decryption

    // Persist user data to localStorage (client-side only)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(userData));
      } catch {
        // console.warn('Failed to persist user data to localStorage:', error);
      }
    }
  }

  /**
   * Restore user data from localStorage
   */
  private restoreFromStorage(): void {
    if (typeof window === 'undefined') return; // Skip on server-side

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsedData = JSON.parse(stored);

        // Validate stored data structure and content
        if (parsedData?.crypto_keypairs?.pqcKeypairs) {
          const requiredKeys = ['ed25519', 'x25519', 'kyber', 'dilithium'] as const;
          const hasAllKeys = requiredKeys.every(key => parsedData.crypto_keypairs.pqcKeypairs[key]);

          if (hasAllKeys) {
            // Validate data lengths to prevent restoring corrupted data
            let isValid = true;
            for (const keyType of requiredKeys) {
              const keypair = parsedData.crypto_keypairs.pqcKeypairs[keyType as typeof requiredKeys[number]];
              if (keypair) {
                const requiredFields = ['publicKey', 'encryptedPrivateKey', 'privateKeyNonce', 'encryptionKey', 'encryptionNonce'];
                for (const field of requiredFields) {
                  if (typeof keypair[field] === 'string') {
                    const maxLength = field === 'encryptedPrivateKey' ? 6000 :  // Increased for PQC keys
                      field === 'publicKey' ? 5000 :             // Increased for PQC public keys (hex encoded)
                        field === 'encryptionKey' ? 200 :
                          field === 'encryptionNonce' ? 100 : 1000;
                    if (keypair[field].length > maxLength) {
                      // console.warn(`Stored ${field} in ${keyType} keypair is too long (${keypair[field].length} > ${maxLength}), clearing localStorage`);
                      isValid = false;
                      break;
                    }
                  }
                }
                if (!isValid) break;
              }
            }

            if (isValid) {
              this.userData = parsedData;
              // console.log('Restored user crypto data from localStorage');
            } else {
              // console.warn('Stored crypto data has invalid lengths, clearing localStorage');
              localStorage.removeItem(this.STORAGE_KEY);
            }
          } else {
            // console.warn('Stored crypto data is incomplete, clearing localStorage');
            localStorage.removeItem(this.STORAGE_KEY);
          }
        } else {
          // console.warn('Stored crypto data has invalid structure, clearing localStorage');
          localStorage.removeItem(this.STORAGE_KEY);
        }
      }
    } catch {
      // console.warn('Failed to restore user data from localStorage:', error);
      this.clearKeys();
    }
  }

  /**
   * Get user's cryptographic keys (decrypts on first access)
   */
  async getUserKeys(): Promise<UserKeys> {
    if (this.cachedKeys) {
      return this.cachedKeys;
    }

    if (!this.userData) {
      throw new Error('KeyManager not initialized. Call initialize() first.');
    }

    // Decrypt user's private keys
    const keypairs = await decryptUserPrivateKeys(this.userData);

    // Generate a new CEK for this file upload
    const cek = new Uint8Array(32);
    crypto.getRandomValues(cek);

    this.cachedKeys = {
      cek,
      keypairs
    };

    return this.cachedKeys;
  }

  /**
   * Generate a new CEK for file encryption
   */
  generateCEK(): Uint8Array {
    const cek = new Uint8Array(32);
    crypto.getRandomValues(cek);
    return cek;
  }

  /**
   * Clear cached keys and persisted data (logout)
   */
  clearKeys(): void {
    this.cachedKeys = null;
    this.userData = null;

    // Clear all application caches
    cacheManager.clearAllCaches();

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(this.STORAGE_KEY);
      } catch {
        // console.warn('Failed to clear user data from localStorage:', error);
      }
    }
  }

  /**
   * Force clear localStorage data (for corrupted data recovery)
   */
  forceClearStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(this.STORAGE_KEY);
        // console.log('Force cleared corrupted crypto data from localStorage');
      } catch {
        // console.warn('Failed to force clear localStorage:', error);
      }
    }
    this.clearKeys();
  }

  /**
   * Check if keys are available
   */
  hasKeys(): boolean {
    return this.userData !== null;
  }
}

// Export singleton instance
export const keyManager = new KeyManager();
