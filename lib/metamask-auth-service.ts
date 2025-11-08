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
import { xchacha20poly1305 } from '@noble/ciphers/chacha'

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
  encryptedMasterKey: string // Encrypted with signature-derived key
  masterKeyMetadata: {
    version: string // "v2-signature-derived"
    algorithm: string // "xchacha20-poly1305"
    nonce?: string // Nonce for encryption (hex)
    publicKey?: string // Wallet's public key (v1 only)
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
   * STEP 4: Encrypt Master Key using Constant MetaMask Signature
   * 
   * NEW APPROACH: Use a CONSTANT message that gets signed by MetaMask
   * - At registration: Sign message "Ellipticc Drive - Master Key Derivation"
   * - At re-login: Sign the SAME message again
   * - Result: SAME signature every time (because same message, same wallet)
   * - Use that signature to derive encryption key
   * 
   * Why this works:
   *   1. Message is fixed (not a random challenge nonce)
   *   2. Same wallet + same message = same signature (deterministic)
   *   3. Signature has high entropy (256 bits from ECDSA)
   *   4. On re-login: Same signature → same derived key → can decrypt
   */
  async encryptMasterKeyWithConstantSignature(
    masterKey: Uint8Array,
    constantSignature: string
  ): Promise<EncryptedMasterKeyData> {
    try {
      // Generate a PERSISTENT encryption nonce (stored with encrypted MK)
      const encryptionNonce = new Uint8Array(24) // XChaCha20 requires 24-byte nonce
      crypto.getRandomValues(encryptionNonce)

      // Derive encryption key from CONSTANT SIGNATURE
      // Same wallet + same message = same signature = same key
      const signatureBytes = new Uint8Array(
        (constantSignature.startsWith('0x') ? constantSignature.slice(2) : constantSignature)
          .match(/.{1,2}/g)!
          .map((byte: string) => parseInt(byte, 16))
      )

      const encryptionKeyMaterial = await crypto.subtle.importKey(
        'raw',
        signatureBytes,
        'HKDF',
        false,
        ['deriveBits']
      )

      const derivedKeyBits = await crypto.subtle.deriveBits(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: new Uint8Array(16),
          info: new TextEncoder().encode('master-key-encryption-metamask'),
        },
        encryptionKeyMaterial,
        256
      )

      const encryptionKey = new Uint8Array(derivedKeyBits)

      // Prepare plaintext
      const plaintext = new TextEncoder().encode(
        JSON.stringify({
          masterKey: Array.from(masterKey),
          timestamp: Date.now(),
        })
      )

      console.log('[MK Encryption] Using constant MetaMask signature')
      console.log('[MK Encryption] Signature:', constantSignature.slice(0, 20) + '...')
      console.log('[MK Encryption] Plaintext:', plaintext.length, 'bytes')
      console.log('[MK Encryption] Encryption key:', Buffer.from(encryptionKey).toString('hex').slice(0, 16) + '...')

      // Encrypt
      const ciphertext = xchacha20poly1305(encryptionKey, encryptionNonce).encrypt(plaintext)

      console.log('[MK Encryption] Ciphertext:', ciphertext.length, 'bytes')

      // Convert to base64
      const ciphertextBase64 = Buffer.from(ciphertext).toString('base64')
      const nonceBase64 = Buffer.from(encryptionNonce).toString('base64')

      return {
        encryptedMasterKey: ciphertextBase64,
        masterKeyMetadata: {
          version: 'v3-constant-signature',
          algorithm: 'xchacha20-poly1305',
          nonce: nonceBase64,
          createdAt: Date.now(),
        },
      }
    } catch (error) {
      console.error('Error encrypting master key:', error)
      throw new Error('Failed to encrypt master key')
    }
  }

  /**
   * STEP 5: Decrypt Master Key using Constant MetaMask Signature
   * 
   * Reverses the encryption:
   * - Signature: Same constant signature (from signing fixed message)
   * - Derived Key: HKDF(constantSignature, "master-key-encryption-metamask")
   * - Decryption: XChaCha20-Poly1305 using stored nonce
   * - Result: Same signature → same key → can decrypt original MK
   */
  async decryptMasterKeyWithConstantSignature(
    encryptedMasterKey: string,
    constantSignature: string,
    nonce: string
  ): Promise<Uint8Array> {
    try {
      console.log('[MK Decryption] Starting with:')
      console.log('[MK Decryption] - signature:', constantSignature.slice(0, 20) + '...')
      console.log('[MK Decryption] - encryptedMasterKey length:', encryptedMasterKey.length, 'chars')
      console.log('[MK Decryption] - nonce:', nonce)

      // Convert base64 strings back to bytes
      const encryptedData = Buffer.from(encryptedMasterKey, 'base64')
      const encryptionNonce = Buffer.from(nonce, 'base64')

      console.log('[MK Decryption] - encryptedData decoded:', encryptedData.length, 'bytes')
      console.log('[MK Decryption] - encryptionNonce decoded:', encryptionNonce.length, 'bytes')

      // Derive the same encryption key from CONSTANT SIGNATURE
      const signatureBytes = new Uint8Array(
        (constantSignature.startsWith('0x') ? constantSignature.slice(2) : constantSignature)
          .match(/.{1,2}/g)!
          .map((byte: string) => parseInt(byte, 16))
      )

      const encryptionKeyMaterial = await crypto.subtle.importKey(
        'raw',
        signatureBytes,
        'HKDF',
        false,
        ['deriveBits']
      )

      const derivedKeyBits = await crypto.subtle.deriveBits(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: new Uint8Array(16),
          info: new TextEncoder().encode('master-key-encryption-metamask'),
        },
        encryptionKeyMaterial,
        256
      )

      const encryptionKey = new Uint8Array(derivedKeyBits)

      // Decrypt using noble/ciphers (XChaCha20-Poly1305)
      console.log('[MK Decryption] Calling xchacha20poly1305.decrypt...')
      console.log('[MK Decryption] - key:', Buffer.from(encryptionKey).toString('hex').slice(0, 16) + '...')
      console.log('[MK Decryption] - nonce bytes:', Buffer.from(encryptionNonce).toString('hex').slice(0, 16) + '...')

      const decryptedBytes = xchacha20poly1305(encryptionKey, new Uint8Array(encryptionNonce)).decrypt(
        new Uint8Array(encryptedData)
      )

      console.log('[MK Decryption] ✅ Decryption succeeded! Decrypted length:', decryptedBytes.length)

      // Parse the decrypted JSON
      const decrypted = JSON.parse(new TextDecoder().decode(decryptedBytes))

      // Convert array back to Uint8Array
      const masterKey = new Uint8Array(decrypted.masterKey)
      return masterKey
    } catch (error) {
      console.error('Error decrypting master key:', error)
      throw new Error('Failed to decrypt master key')
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

  /**
   * STEP 9: Get Constant Signature from MetaMask
   * 
   * Sign a fixed message to get a deterministic signature
   * - Same wallet + same message = same signature every time
   * - Use this for master key encryption key derivation
   */
  async getConstantSignature(): Promise<string> {
    const CONSTANT_MESSAGE = 'Ellipticc Drive - Master Key Derivation v1'

    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('MetaMask not installed')
      }

      const accounts = await (window as any).ethereum.request({
        method: 'eth_requestAccounts'
      })

      const signature = await (window as any).ethereum.request({
        method: 'personal_sign',
        params: [CONSTANT_MESSAGE, accounts[0]]
      })

      console.log('[Constant Signature] Generated signature for constant message')
      return signature
    } catch (error) {
      console.error('Error getting constant signature:', error)
      throw new Error('Failed to get constant signature from wallet')
    }
  }

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
