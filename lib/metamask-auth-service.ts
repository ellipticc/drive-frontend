'use client'

/**
 * MetaMask Authentication Service - SECURE IMPLEMENTATION
 * 
 * Uses MetaMask's native wallet APIs for authentication + encryption:
 * - eth_requestAccounts: Connect wallet and request signature
 * - Sign-In with Ethereum (EIP-4361): Server validates signature
 * - personal_sign: Sign challenge message (deterministic, wallet-backed)
 * - Argon2id: Derive encryption key from signature
 * - XChaCha20-Poly1305: Encrypt master key with derived key
 * 
 * Master Key Management:
 * - Generated locally on new account creation (32 random bytes)
 * - User signs a challenge to prove wallet ownership
 * - Challenge includes a per-user random salt (stored on backend)
 * - Signature + salt → derive encryption key using Argon2id
 * - Encrypted master key sent to backend and stored in user profile
 * - On next login: Sign challenge → derive key → decrypt locally
 * 
 * Security Model:
 * - Backend stores: encrypted_master_key + challenge_salt
 * - Backend CANNOT decrypt without the wallet's signature (private key)
 * - Signature is deterministic but requires challenge_salt knowledge
 * - Even if backend is compromised, cannot compute signature without wallet
 * - User signs with private key (never leaves wallet, hardware compatible)
 * 
 * File encryption uses: master_key → account_salt → derived_keys
 * Recovery via password/mnemonic (independent of wallet)
 */

// Declare Ethereum provider type
declare global {
  interface Window {
    ethereum?: {
      request: (args: {
        method: string
        params?: any[]
      }) => Promise<any>
    }
  }
}

import { xchacha20poly1305 } from '@noble/ciphers/chacha'

interface EncryptedMasterKeyData {
  encryptedMasterKey: string
  publicKey: string // Challenge salt (hex encoded)
  masterKeyMetadata: {
    version: string
    algorithm: string
    createdAt: number
  }
}

class MetaMaskAuthService {
  private static readonly MK_STORAGE_KEY = 'encrypted_master_key'
  private static readonly SESSION_MK_KEY = 'session_master_key'
  private static readonly WALLET_ADDRESS_KEY = 'wallet_address_connected'

  /**
   * Check if MetaMask is installed
   */
  static isMetaMaskInstalled(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof (window as any).ethereum !== 'undefined'
    )
  }

  /**
   * Get connected wallet address
   */
  static async getConnectedWallet(): Promise<string> {
    if (!this.isMetaMaskInstalled()) {
      throw new Error('MetaMask not installed')
    }

    try {
      const accounts = await (window as any).ethereum.request({
        method: 'eth_accounts'
      })

      if (!accounts || accounts.length === 0) {
        throw new Error('No connected wallet')
      }

      return accounts[0].toLowerCase()
    } catch (error) {
      console.error('Error getting connected wallet:', error)
      throw error
    }
  }

  /**
   * Request account access from MetaMask
   */
  static async requestAccountAccess(): Promise<string> {
    if (!this.isMetaMaskInstalled()) {
      throw new Error('MetaMask not installed')
    }

    try {
      const accounts = await (window as any).ethereum.request({
        method: 'eth_requestAccounts'
      })

      if (!accounts || accounts.length === 0) {
        throw new Error('User denied account access')
      }

      return accounts[0].toLowerCase()
    } catch (error) {
      console.error('Error requesting account access:', error)
      throw error
    }
  }

  /**
   * STEP 1: Encrypt master key using signature-derived key with random salt
   * 
   * Process:
   * 1. Generate random challenge salt (stored on backend)
   * 2. Ask wallet to sign a challenge message (requires user approval)
   * 3. Derive encryption key from signature using Argon2id with challenge salt
   * 4. Encrypt master key with XChaCha20-Poly1305
   * 5. Send encrypted MK + challenge_salt to backend
   * 
   * Security: Even if backend is compromised, attacker cannot forge signature
   * (would need wallet's private key). Signature is deterministic given the salt,
   * so same login flow always works.
   */
  static async encryptMasterKeyWithWallet(
    masterKey: Uint8Array,
    walletAddress: string,
    publicKey: string
  ): Promise<EncryptedMasterKeyData> {
    if (!this.isMetaMaskInstalled()) {
      throw new Error('MetaMask not installed')
    }

    try {
      const crypto = globalThis.crypto

      // Generate random challenge salt (this will be stored on backend)
      const challengeSalt = new Uint8Array(32)
      crypto.getRandomValues(challengeSalt)
      const challengeSaltHex = Array.from(challengeSalt)
        .map((b: number) => b.toString(16).padStart(2, '0'))
        .join('')

      // Create a challenge message that includes the salt
      // This ensures signature is tied to this specific user
      const challengeMessage = `Decrypt Drive Master Key\nAddress: ${walletAddress.toLowerCase()}\nChallenge: ${challengeSaltHex}`

      console.log('Requesting wallet to sign challenge message for key derivation...')

      // Ask wallet to sign the challenge (deterministic - same challenge always produces same signature)
      const signature = await (window as any).ethereum.request({
        method: 'personal_sign',
        params: [challengeMessage, walletAddress]
      })

      if (!signature) {
        throw new Error('Failed to sign challenge message')
      }

      console.log('Challenge signed successfully, deriving encryption key with Argon2id...')

      // Use argon2-wrapper to hash with Argon2id
      const { hashWithArgon2 } = await import('./argon2-wrapper')

      // Derive encryption key from signature using Argon2id
      // The signature is what we're hashing
      const hashResult = await hashWithArgon2(
        signature,
        walletAddress.toLowerCase(),
        4,           // time iterations (increased for lower memory)
        65536,       // memory: 64 MB (65536 KB)
        1,           // parallelism
        32           // hashLen - 32 bytes output
      )

      const encryptionKey = new Uint8Array(
        (hashResult.match(/.{1,2}/g) || []).map((byte: string) => parseInt(byte, 16))
      )

      // Generate a random nonce for XChaCha20-Poly1305
      const nonce = new Uint8Array(24)
      crypto.getRandomValues(nonce)

      console.log('Encrypting master key with derived key...')

      // Encrypt using XChaCha20-Poly1305 from @noble/ciphers
      const encryptedData = xchacha20poly1305(encryptionKey, nonce).encrypt(masterKey)

      // Format: nonce (24 bytes) || ciphertext
      const encryptedWithNonce = new Uint8Array(24 + encryptedData.length)
      encryptedWithNonce.set(nonce, 0)
      encryptedWithNonce.set(encryptedData, 24)

      // Convert to base64 for storage
      const encryptedMasterKey = Buffer.from(encryptedWithNonce).toString('base64')

      console.log('Master key encrypted successfully with Argon2id-derived key')

      return {
        encryptedMasterKey,
        publicKey: challengeSaltHex,  // Store challenge salt (not really a "public key", but same field)
        masterKeyMetadata: {
          version: 'v10-argon2id-xchacha20',
          algorithm: 'signature-argon2id-xchacha20poly1305',
          createdAt: Date.now()
        }
      }
    } catch (error) {
      console.error('Error encrypting master key with signature:', error)
      throw error
    }
  }

  /**
   * STEP 3: Decrypt master key using signature-derived decryption key
   * 
   * Instead of using deprecated eth_decrypt, we:
   * 1. Ask wallet to sign a challenge message
   * 2. Derive a decryption key from the signature
   * 3. Decrypt the sealed master key locally
   * 
   * This requires the wallet user to approve signing (same UX as eth_decrypt)
   * but avoids the deprecated RPC method and is more reliable
   */
  static async decryptMasterKeyWithWallet(
    encryptedMasterKey: string,
    challengeSalt: string
  ): Promise<Uint8Array> {
    if (!this.isMetaMaskInstalled()) {
      throw new Error('MetaMask not installed')
    }

    try {
      const accounts = await (window as any).ethereum.request({
        method: 'eth_accounts'
      })

      if (!accounts || accounts.length === 0) {
        throw new Error('No connected wallet')
      }

      const walletAddress = accounts[0]

      // Create a challenge message to sign using the provided challenge salt
      const challengeMessage = `Decrypt Drive Master Key\nAddress: ${walletAddress.toLowerCase()}\nChallenge: ${challengeSalt}`

      console.log('Requesting wallet to sign challenge message for key derivation...')

      // Ask wallet to sign the challenge
      const signature = await (window as any).ethereum.request({
        method: 'personal_sign',
        params: [challengeMessage, walletAddress]
      })

      if (!signature) {
        throw new Error('Failed to sign challenge message')
      }

      console.log('Challenge signed successfully, deriving decryption key with Argon2id...')

      // Use argon2-wrapper to hash with Argon2id
      const { hashWithArgon2 } = await import('./argon2-wrapper')

      // Derive same encryption key from signature using Argon2id
      const hashResult = await hashWithArgon2(
        signature,
        walletAddress.toLowerCase(),
        4,    // time
        65536, // memory: 64 MB
        1,    // parallelism
        32    // hashLen
      )

      const decryptionKey = new Uint8Array(
        (hashResult.match(/.{1,2}/g) || []).map((byte: string) => parseInt(byte, 16))
      )

      // Now decrypt the master key using XChaCha20-Poly1305 with the derived key
      // First, convert encrypted master key from base64
      const encryptedBuffer = Buffer.from(encryptedMasterKey, 'base64')
      const encryptedBytes = new Uint8Array(encryptedBuffer)

      // The encrypted format: nonce (24 bytes) || ciphertext (rest)
      const nonce = encryptedBytes.slice(0, 24)
      const ciphertext = encryptedBytes.slice(24)

      // Decrypt using XChaCha20-Poly1305 from @noble/ciphers
      const decryptedBytes = xchacha20poly1305(decryptionKey, nonce).decrypt(ciphertext)

      console.log('Master key decrypted successfully:', decryptedBytes.length, 'bytes')

      return decryptedBytes
    } catch (error) {
      console.error('Error decrypting master key with signature-derived key:', error)
      throw error
    }
  }

  /**
   * Generate a random master key
   */
  static generateMasterKey(): Uint8Array {
    const masterKey = new Uint8Array(32)
    crypto.getRandomValues(masterKey)
    return masterKey
  }

  /**
   * Store encrypted master key in localStorage
   * Safe because it's encrypted with wallet's private key
   */
  static storeEncryptedMasterKeyLocally(
    data: EncryptedMasterKeyData,
    walletAddress: string
  ): void {
    try {
      const key = `${MetaMaskAuthService.MK_STORAGE_KEY}:${walletAddress.toLowerCase()}`
      localStorage.setItem(key, JSON.stringify(data))
      localStorage.setItem(
        MetaMaskAuthService.WALLET_ADDRESS_KEY,
        walletAddress.toLowerCase()
      )
    } catch (error) {
      console.error('Error storing encrypted master key:', error)
      throw error
    }
  }

  /**
   * Retrieve encrypted master key from localStorage
   */
  static getEncryptedMasterKeyFromLocal(
    walletAddress: string
  ): EncryptedMasterKeyData | null {
    try {
      const key = `${MetaMaskAuthService.MK_STORAGE_KEY}:${walletAddress.toLowerCase()}`
      const stored = localStorage.getItem(key)
      if (!stored) return null
      return JSON.parse(stored)
    } catch (error) {
      console.error('Error retrieving encrypted master key:', error)
      return null
    }
  }

  /**
   * Cache master key in sessionStorage for current session
   */
  static cacheMasterKeyInSession(masterKey: Uint8Array): void {
    try {
      const hex =
        '0x' +
        Array.from(masterKey)
          .map((b: number) => b.toString(16).padStart(2, '0'))
          .join('')
      sessionStorage.setItem(MetaMaskAuthService.SESSION_MK_KEY, hex)
    } catch (error) {
      console.error('Error caching master key in session:', error)
    }
  }

  /**
   * Retrieve cached master key from sessionStorage
   */
  static getCachedMasterKeyFromSession(): Uint8Array | null {
    try {
      const hex = sessionStorage.getItem(MetaMaskAuthService.SESSION_MK_KEY)
      if (!hex) return null

      const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
      const bytes = new Uint8Array(
        cleanHex
          .match(/.{1,2}/g)!
          .map((byte: string) => parseInt(byte, 16))
      )
      return bytes
    } catch (error) {
      console.error('Error retrieving cached master key:', error)
      return null
    }
  }

  /**
   * Clear all cached data for wallet
   */
  static clearWalletData(walletAddress: string): void {
    try {
      const key = `${MetaMaskAuthService.MK_STORAGE_KEY}:${walletAddress.toLowerCase()}`
      localStorage.removeItem(key)
      localStorage.removeItem(MetaMaskAuthService.WALLET_ADDRESS_KEY)
      sessionStorage.removeItem(MetaMaskAuthService.SESSION_MK_KEY)
    } catch (error) {
      console.error('Error clearing wallet data:', error)
    }
  }

  /**
   * Get the last connected wallet (for auto-reconnect)
   */
  static getLastConnectedWallet(): string | null {
    try {
      return localStorage.getItem(MetaMaskAuthService.WALLET_ADDRESS_KEY)
    } catch {
      return null
    }
  }

  /**
   * Check if user has a stored encrypted MK (for auto-reconnect)
   */
  static hasStoredEncryptedMK(walletAddress: string): boolean {
    try {
      return (
        this.getEncryptedMasterKeyFromLocal(walletAddress) !== null
      )
    } catch {
      return false
    }
  }
}

// Export singleton
export const metamaskAuthService = new MetaMaskAuthService()

// Export class for type usage
export { MetaMaskAuthService }
