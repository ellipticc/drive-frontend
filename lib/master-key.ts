/**
 * Master Key Manager - Caches derived master keys for the session
 * Implements zero-knowledge architecture where master keys are derived client-side
 * and cached in sessionStorage for cryptographic operations
 */

import { deriveEncryptionKey } from './crypto';

class MasterKeyManager {
  private static readonly MASTER_KEY_STORAGE_KEY = 'master_key';
  private static readonly ACCOUNT_SALT_STORAGE_KEY = 'account_salt';
  private storage: Storage | null = null;

  // Set storage type (localStorage or sessionStorage)
  setStorage(storage: Storage): void {
    this.storage = storage;
  }

  // Get current storage, auto-detecting based on where master key is stored
  private getStorage(): Storage {
    if (this.storage) return this.storage;
    
    // Auto-detect storage type based on where master key exists
    if (typeof window !== 'undefined') {
      // Check sessionStorage first, then localStorage
      if (sessionStorage.getItem(MasterKeyManager.MASTER_KEY_STORAGE_KEY)) {
        this.storage = sessionStorage;
        return sessionStorage;
      } else if (localStorage.getItem(MasterKeyManager.MASTER_KEY_STORAGE_KEY)) {
        this.storage = localStorage;
        return localStorage;
      }
      // Default to localStorage if neither has the key
      return localStorage;
    }
    
    // Fallback for server-side
    throw new Error('Storage not available');
  }

  /**
   * Cache an existing master key (for recovery scenarios)
   * This should be called when we already have the master key from recovery
   */
  cacheExistingMasterKey(masterKey: Uint8Array, accountSalt: string): void {
    try {
      // Store in storage as base64 for persistence
      const binaryString = String.fromCharCode(...masterKey);
      const masterKeyBase64 = btoa(binaryString);
      const targetStorage = this.getStorage();
      
      // Before caching new key, clear it from the OTHER storage to prevent conflicts
      // This is critical during TOTP flow when storage type changes
      if (typeof window !== 'undefined') {
        const otherStorage = targetStorage === sessionStorage ? localStorage : sessionStorage;
        otherStorage.removeItem(MasterKeyManager.MASTER_KEY_STORAGE_KEY);
        otherStorage.removeItem(MasterKeyManager.ACCOUNT_SALT_STORAGE_KEY);
      }
      
      targetStorage.setItem(MasterKeyManager.MASTER_KEY_STORAGE_KEY, masterKeyBase64);
      targetStorage.setItem(MasterKeyManager.ACCOUNT_SALT_STORAGE_KEY, accountSalt);

    } catch (error) {
      // console.error('Failed to cache existing master key:', error);
      throw new Error('Failed to cache master key');
    }
  }

  /**
   * Get cached master key
   * Throws error if master key is not cached (user not logged in properly)
   */
  getMasterKey(): Uint8Array {
    const masterKeyBase64 = this.getStorage().getItem(MasterKeyManager.MASTER_KEY_STORAGE_KEY);
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
      // console.error('Failed to decode master key from storage:', error);
      throw new Error('Invalid master key in cache. Please login again.');
    }
  }

  /**
   * Check if master key is cached
   */
  hasMasterKey(): boolean {
    return this.getStorage().getItem(MasterKeyManager.MASTER_KEY_STORAGE_KEY) !== null;
  }

  /**
   * Clear cached master key (logout)
   */
  clearMasterKey(): void {
    this.getStorage().removeItem(MasterKeyManager.MASTER_KEY_STORAGE_KEY);
    this.getStorage().removeItem(MasterKeyManager.ACCOUNT_SALT_STORAGE_KEY);
  }

  /**
   * Complete logout - clear all sensitive data except deviceToken
   */
  completeClearOnLogout(): void {
    // Save deviceToken if it exists
    const deviceToken = localStorage.getItem('deviceToken');
    
    // Clear everything
    localStorage.clear();
    sessionStorage.clear();
    
    // Restore deviceToken if it existed
    if (deviceToken) {
      localStorage.setItem('deviceToken', deviceToken);
    }
  }

  /**
   * Get account salt
   */
  getAccountSalt(): string | null {
    return this.getStorage().getItem(MasterKeyManager.ACCOUNT_SALT_STORAGE_KEY);
  }

  /**
   * Validate that cached master key matches the given account salt
   * Returns true if valid, false if mismatched or missing
   */
  validateMasterKeyForSalt(accountSalt: string): boolean {
    const cachedSalt = this.getAccountSalt();
    if (!cachedSalt || !accountSalt) {
      return false;
    }
    // Check if cached salt matches the server salt
    return cachedSalt === accountSalt;
  }

  /**
   * Derive and cache master key from password and account salt
   * This is used during normal login when we need to derive the master key from credentials
   * 
   * CRITICAL: If the account salt has changed, this will
   * automatically clear stale keys from both storages and cache the new key
   */
  async deriveAndCacheMasterKey(password: string, accountSalt: string): Promise<void> {
    try {
      // Check if there's a stale master key with a different salt
      const currentSalt = this.getAccountSalt();
      if (currentSalt && currentSalt !== accountSalt) {
        // Account salt changed - this happens when TOTP is enabled/disabled
        // Clear stale keys from BOTH storages
        if (typeof window !== 'undefined') {
          localStorage.removeItem(MasterKeyManager.MASTER_KEY_STORAGE_KEY);
          localStorage.removeItem(MasterKeyManager.ACCOUNT_SALT_STORAGE_KEY);
          sessionStorage.removeItem(MasterKeyManager.MASTER_KEY_STORAGE_KEY);
          sessionStorage.removeItem(MasterKeyManager.ACCOUNT_SALT_STORAGE_KEY);
        }
        // Reset storage detection so new key will be cached
        this.storage = null;
      }

      // Derive master key from password and account salt
      const masterKey = await deriveEncryptionKey(password, accountSalt);
      
      // Cache the derived master key
      this.cacheExistingMasterKey(masterKey, accountSalt);
    } catch (error) {
      // console.error('Failed to derive and cache master key:', error);
      throw new Error('Failed to derive master key from password');
    }
  }
}

// Export singleton instance
export const masterKeyManager = new MasterKeyManager();
