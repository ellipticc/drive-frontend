/**
 * Master Key Manager - Caches derived master keys for the session
 * Implements zero-knowledge architecture where master keys are derived client-side
 * and cached in sessionStorage for cryptographic operations
 */

import { deriveEncryptionKey } from './crypto';

class MasterKeyManager {
  private static readonly MASTER_KEY_STORAGE_KEY = 'master_key';
  private static readonly ACCOUNT_SALT_STORAGE_KEY = 'account_salt';

  /**
   * Derive and cache master key from password and account salt
   * This should be called once per login session
   */
  async deriveAndCacheMasterKey(password: string, accountSalt: string): Promise<void> {
    try {
      const masterKey = await deriveEncryptionKey(password, accountSalt);

      // Store in localStorage as base64 for cross-tab persistence
      const binaryString = String.fromCharCode(...masterKey);
      const masterKeyBase64 = btoa(binaryString);
      localStorage.setItem(MasterKeyManager.MASTER_KEY_STORAGE_KEY, masterKeyBase64);
      localStorage.setItem(MasterKeyManager.ACCOUNT_SALT_STORAGE_KEY, accountSalt);

      // console.log('🔐 Master key cached in localStorage');
    } catch (error) {
      // console.error('Failed to derive master key:', error);
      throw new Error('Failed to derive master key');
    }
  }

  /**
   * Get cached master key
   * Throws error if master key is not cached (user not logged in properly)
   */
  getMasterKey(): Uint8Array {
    const masterKeyBase64 = localStorage.getItem(MasterKeyManager.MASTER_KEY_STORAGE_KEY);
    if (!masterKeyBase64) {
      throw new Error('Master key not cached. Please login first.');
    }

    try {
      // Convert base64 string back to Uint8Array
      const binaryString = atob(masterKeyBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } catch (error) {
      // console.error('Failed to decode master key from localStorage:', error);
      throw new Error('Invalid master key in cache. Please login again.');
    }
  }

  /**
   * Check if master key is cached
   */
  hasMasterKey(): boolean {
    return localStorage.getItem(MasterKeyManager.MASTER_KEY_STORAGE_KEY) !== null;
  }

  /**
   * Clear cached master key (logout)
   */
  clearMasterKey(): void {
    localStorage.removeItem(MasterKeyManager.MASTER_KEY_STORAGE_KEY);
    localStorage.removeItem(MasterKeyManager.ACCOUNT_SALT_STORAGE_KEY);
    // console.log('🔐 Master key cleared from localStorage');
  }

  /**
   * Get account salt
   */
  getAccountSalt(): string | null {
    return localStorage.getItem(MasterKeyManager.ACCOUNT_SALT_STORAGE_KEY);
  }
}

// Export singleton instance
export const masterKeyManager = new MasterKeyManager();
