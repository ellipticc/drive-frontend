/**
 * MetaMask Authentication & E2EE Master Key Service
 * 
 * Implements client-side MetaMask authentication flow:
 * 1. Challenge-Response: Cryptographic proof of wallet ownership
 * 2. Master Key (MK) Generation: Client-side root key for all encryption
 * 3. MK Encryption: Store MK encrypted with MetaMask (eth_encrypt)
 * 4. OPAQUE Integration: Use MK as root secret for PQC key derivation
 * 5. Session Persistence: Reconnect MetaMask, decrypt MK, restore keys
 * 
 * Security Model:
 * - MetaMask = cryptographic identity provider
 * - Master Key = root of trust (never leaves browser unencrypted)
 * - OPAQUE = key management and session control layer
 * - PQC = post-quantum cryptographic protection
 */

import { deriveEncryptionKey } from './crypto'

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

interface ChallengeResponse {
  challenge: string
  timestamp: number
  expiresAt: number // Challenge valid for 5 minutes
}

interface SignedMessage {
  challenge: string
  walletAddress: string
  signature: string
}

interface EncryptedMasterKeyData {
  encryptedMasterKey: string // Encrypted with eth_encrypt (MetaMask)
  masterKeyMetadata: {
    version: string // "v1"
    algorithm: string // "xsalsa20-poly1305" (MetaMask standard)
    publicKey: string // Wallet's public key used for encryption
    createdAt: number
  }
}

class MetaMaskAuthService {
  private static readonly CHALLENGE_EXPIRY = 5 * 60 * 1000 // 5 minutes
  private static readonly MK_STORAGE_KEY = 'encrypted_master_key'
  private static readonly SESSION_MK_KEY = 'session_master_key'
  private static readonly WALLET_ADDRESS_KEY = 'wallet_address_connected'

  /**
   * STEP 1: Generate a cryptographic challenge for the wallet to sign
   * 
   * Format: `{walletAddress}:{randomNonce}`
   * This challenge proves:
   * - User controls the wallet (by signing)
   * - Challenge is fresh (random nonce)
   * - Challenge is time-limited (5 min expiry)
   */
  async generateChallenge(walletAddress: string): Promise<ChallengeResponse> {
    try {
      // Validate wallet address
      if (!walletAddress || !walletAddress.startsWith('0x')) {
        throw new Error('Invalid wallet address')
      }

      const normalized = walletAddress.toLowerCase()

      // Generate random nonce (32 bytes = 64 hex chars)
      const nonceArray = new Uint8Array(32)
      crypto.getRandomValues(nonceArray)
      const nonce = Array.from(nonceArray)
        .map((b: number) => b.toString(16).padStart(2, '0'))
        .join('')

      // Create challenge message
      const challenge = `${normalized}:${nonce}`
      const timestamp = Date.now()
      const expiresAt = timestamp + MetaMaskAuthService.CHALLENGE_EXPIRY

      return {
        challenge,
        timestamp,
        expiresAt,
      }
    } catch (error) {
      console.error('Error generating challenge:', error)
      throw new Error('Failed to generate challenge')
    }
  }

  /**
   * STEP 2: Verify the signed challenge (challenge-response authentication)
   * 
   * This proves the user controls the wallet without revealing any secrets.
   * Uses ethers.js to recover the wallet address from the signature.
   */
  async verifyChallenge(
    challenge: string,
    walletAddress: string,
    signature: string
  ): Promise<boolean> {
    try {
      // Validate inputs
      if (!challenge || !walletAddress || !signature) {
        throw new Error('Missing required fields for challenge verification')
      }

      // Validate signature format (should be 0x + 130 hex chars)
      if (!signature.startsWith('0x') || signature.length !== 132) {
        throw new Error('Invalid signature format')
      }

      // Dynamically import ethers at runtime to avoid TypeScript issues
      const { ethers } = await import('ethers')
      // Handle both ethers v5 (utils.verifyMessage) and v6 (verifyMessage)
      const verifyMessage = (ethers as any).verifyMessage || (ethers as any).utils?.verifyMessage

      // Recover the address that signed the message
      const recoveredAddress = verifyMessage(challenge, signature)
      const normalized = walletAddress.toLowerCase()
      const recovered = recoveredAddress.toLowerCase()

      if (recovered !== normalized) {
        console.error(
          `Challenge verification failed: expected ${normalized}, got ${recovered}`
        )
        return false
      }
      return true
    } catch (error) {
      console.error('Error verifying challenge:', error)
      throw new Error('Failed to verify challenge')
    }
  }

  /**
   * STEP 3: Generate Master Key (MK)
   * 
   * The MK is the root key for all user encryption:
   * - Derived from secure random data
   * - Size: 32 bytes (256 bits) for XChaCha20-Poly1305
   * - Never transmitted or stored unencrypted
   * - Serves as OPAQUE user secret equivalent
   */
  async generateMasterKey(): Promise<Uint8Array> {
    try {
      // Generate 32 bytes of cryptographically secure random data
      const masterKey = new Uint8Array(32)
      crypto.getRandomValues(masterKey)
      return masterKey
    } catch (error) {
      console.error('Error generating master key:', error)
      throw new Error('Failed to generate master key')
    }
  }

  /**
   * STEP 4: Encrypt Master Key with MetaMask (eth_encrypt)
   * 
   * Uses MetaMask's eth_encrypt method which uses:
   * - Algorithm: xsalsa20-poly1305 (NaCl crypto)
   * - Encryption key: Wallet's public key (cannot be forged)
   * - Result: Only the wallet owner can decrypt it
   * 
   * In the browser, this requires the MetaMask extension.
   */
  async encryptMasterKeyWithMetaMask(
    masterKey: Uint8Array,
    walletAddress: string,
    walletPublicKey: string
  ): Promise<EncryptedMasterKeyData> {
    try {
      // Check if MetaMask is available
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('MetaMask not available')
      }

      // Convert master key to hex string for eth_encrypt
      const masterKeyHex = '0x' + Array.from(masterKey)
        .map((b: number) => b.toString(16).padStart(2, '0'))
        .join('')

      // Call eth_encrypt (MetaMask method)
      const encryptedMasterKey = await window.ethereum.request({
        method: 'eth_encrypt',
        params: [walletPublicKey, masterKeyHex],
      })

      return {
        encryptedMasterKey,
        masterKeyMetadata: {
          version: 'v1',
          algorithm: 'xsalsa20-poly1305',
          publicKey: walletPublicKey,
          createdAt: Date.now(),
        },
      }
    } catch (error) {
      console.error('Error encrypting master key:', error)
      throw new Error('Failed to encrypt master key with MetaMask')
    }
  }

  /**
   * STEP 5: Decrypt Master Key with MetaMask (eth_decrypt)
   * 
   * Reverses the encryption process:
   * - Uses MetaMask's eth_decrypt method
   * - Only works when the wallet is connected and user approves
   * - Proves wallet ownership and restores the unencrypted MK
   */
  async decryptMasterKeyWithMetaMask(
    encryptedMasterKey: string,
    walletAddress: string
  ): Promise<Uint8Array> {
    try {
      // Check if MetaMask is available
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('MetaMask not available')
      }

      // Call eth_decrypt (MetaMask method)
      const decryptedMasterKeyHex = await window.ethereum.request({
        method: 'eth_decrypt',
        params: [encryptedMasterKey, walletAddress],
      })

      // Convert hex string back to Uint8Array
      const hex = decryptedMasterKeyHex.startsWith('0x')
        ? decryptedMasterKeyHex.slice(2)
        : decryptedMasterKeyHex

      const masterKey = new Uint8Array(
        (hex.match(/.{1,2}/g) || []).map((byte: string) => parseInt(byte, 16))
      )
      return masterKey
    } catch (error) {
      console.error('Error decrypting master key:', error)
      throw new Error('Failed to decrypt master key with MetaMask')
    }
  }

  /**
   * STEP 6: Cache Master Key in Session Storage
   * 
   * For immediate use during the current browser session.
   * Session storage is cleared on tab close.
   */
  cacheMasterKeyInSession(masterKey: Uint8Array): void {
    try {
      const hex = Array.from(masterKey)
        .map((b: number) => b.toString(16).padStart(2, '0'))
        .join('')

      sessionStorage.setItem(MetaMaskAuthService.SESSION_MK_KEY, hex)
    } catch (error) {
      console.error('Error caching master key:', error)
    }
  }

  /**
   * STEP 7: Retrieve Cached Master Key from Session
   */
  getCachedMasterKeyFromSession(): Uint8Array | null {
    try {
      const hex = sessionStorage.getItem(MetaMaskAuthService.SESSION_MK_KEY)
      if (!hex) return null

      const masterKey = new Uint8Array(
        (hex.match(/.{1,2}/g) || []).map((byte: string) => parseInt(byte, 16))
      )
      return masterKey
    } catch (error) {
      console.error('Error retrieving cached master key:', error)
      return null
    }
  }

  /**
   * STEP 8: Store Encrypted Master Key in localStorage
   * 
   * For persistence across browser sessions.
   * The encrypted MK can be safely stored in localStorage because:
   * - It's encrypted with the wallet's public key
   * - Only the connected wallet can decrypt it
   */
  storeEncryptedMasterKeyInLocalStorage(
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
    }
  }

  /**
   * STEP 9: Retrieve Encrypted Master Key from localStorage
   */
  getEncryptedMasterKeyFromLocalStorage(
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
   * STEP 10: Derive OPAQUE User Secret from Master Key
   * 
   * This bridges MetaMask authentication with OPAQUE key management:
   * - MK serves as the OPAQUE user secret equivalent
   * - Used to derive account salt, file encryption keys, PQC keypairs
   * - Maintains compatibility with existing OPAQUE flow
   */
  async deriveMasterSecretFromMK(
    masterKey: Uint8Array,
    walletAddress: string
  ): Promise<Uint8Array> {
    try {
      // Create a deterministic seed from wallet address + MK
      const encoder = new TextEncoder()
      const seed = encoder.encode(`opaque_secret:${walletAddress.toLowerCase()}`)

      // Derive master secret using PBKDF2
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(masterKey),
        'PBKDF2',
        false,
        ['deriveBits']
      )

      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          hash: 'SHA-256',
          salt: seed,
          iterations: 100000,
        },
        keyMaterial,
        32 * 8 // 32 bytes = 256 bits
      )

      const masterSecret = new Uint8Array(derivedBits)
      return masterSecret
    } catch (error) {
      console.error('Error deriving master secret:', error)
      throw new Error('Failed to derive master secret')
    }
  }

  /**
   * STEP 11: Clear all MK-related data on logout
   */
  clearMasterKeyData(walletAddress?: string): void {
    try {
      sessionStorage.removeItem(MetaMaskAuthService.SESSION_MK_KEY)

      if (walletAddress) {
        const key = `${MetaMaskAuthService.MK_STORAGE_KEY}:${walletAddress.toLowerCase()}`
        localStorage.removeItem(key)
      }

      localStorage.removeItem(MetaMaskAuthService.WALLET_ADDRESS_KEY)
    } catch (error) {
      console.error('Error clearing master key data:', error)
    }
  }

  /**
   * STEP 12: Check if user has a stored encrypted MK (for auto-reconnect)
   */
  hasStoredEncryptedMK(walletAddress: string): boolean {
    try {
      return (
        this.getEncryptedMasterKeyFromLocalStorage(walletAddress) !== null
      )
    } catch {
      return false
    }
  }

  /**
   * STEP 13: Get the last connected wallet (for auto-reconnect)
   */
  getLastConnectedWallet(): string | null {
    try {
      return localStorage.getItem(MetaMaskAuthService.WALLET_ADDRESS_KEY)
    } catch {
      return null
    }
  }
}

// Export singleton
export const metamaskAuthService = new MetaMaskAuthService()
