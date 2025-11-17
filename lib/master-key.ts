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

  // Get current storage, defaulting to localStorage if not set
  private getStorage(): Storage {
    if (this.storage) return this.storage;
    // Default to localStorage, but only access it on client side
    if (typeof window !== 'undefined') {
      return localStorage;
    }
    // This should never happen in practice, but provide a fallback
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
      this.getStorage().setItem(MasterKeyManager.MASTER_KEY_STORAGE_KEY, masterKeyBase64);
      this.getStorage().setItem(MasterKeyManager.ACCOUNT_SALT_STORAGE_KEY, accountSalt);

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
   * Derive and cache master key from password and account salt
   * This is used during normal login when we need to derive the master key from credentials
   */
  async deriveAndCacheMasterKey(password: string, accountSalt: string): Promise<void> {
    try {
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
