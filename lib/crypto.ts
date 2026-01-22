/**
 * Cryptographic utilities for key generation and encryption
 */

import { getPublicKey, utils } from '@noble/ed25519';
import { x25519 } from '@noble/curves/ed25519.js';
import { argon2id } from 'hash-wasm';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
export { ml_kem768 };
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { PerformanceTracker } from './performance-tracker';

// Configure SHA-512 for noble/ed25519
import * as ed from '@noble/ed25519';
ed.hashes.sha512 = sha512;

// Utility functions for hex encoding/decoding
export function uint8ArrayToHex(array: Uint8Array): string {
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Generate a random salt for key derivation
export function generateKeyDerivationSalt(): string {
  const salt = new Uint8Array(32);
  crypto.getRandomValues(salt);
  return uint8ArrayToHex(salt);
}

// Generate Ed25519 keypair for signing
export async function generateEd25519Keypair(): Promise<{
  publicKey: string;
  privateKey: Uint8Array;
}> {
  const privateKey = utils.randomSecretKey();
  const publicKey = await getPublicKey(privateKey);

  return {
    publicKey: uint8ArrayToHex(publicKey),
    privateKey: privateKey
  };
}

// Generate X25519 keypair for ECDH
export async function generateX25519Keypair(): Promise<{
  publicKey: string;
  privateKey: Uint8Array;
}> {
  const privateKey = x25519.utils.randomSecretKey();
  const publicKey = x25519.getPublicKey(privateKey);

  return {
    publicKey: uint8ArrayToHex(publicKey),
    privateKey: privateKey
  };
}

// Generate Kyber (PQC) keypair using noble-post-quantum ML-KEM
export async function generateKyberKeypair(): Promise<{
  publicKey: string;
  privateKey: Uint8Array;
}> {
  const seed = new Uint8Array(64);
  crypto.getRandomValues(seed);
  const keys = ml_kem768.keygen(seed);
  return {
    publicKey: uint8ArrayToHex(new Uint8Array(keys.publicKey)),
    privateKey: new Uint8Array(keys.secretKey)
  };
}

// Generate Dilithium (PQC) keypair using noble-post-quantum ML-DSA
export async function generateDilithiumKeypair(): Promise<{
  publicKey: string;
  privateKey: Uint8Array;
}> {
  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);
  const keys = ml_dsa65.keygen(seed);
  const privateKeyArray = new Uint8Array(keys.secretKey);

  if (privateKeyArray.length !== 4032) {
    console.error('CRITICAL: Dilithium private key has wrong length!', {
      expected: 4032,
      actual: privateKeyArray.length,
      seed: seed.length
    });
  }

  return {
    publicKey: uint8ArrayToHex(new Uint8Array(keys.publicKey)),
    privateKey: privateKeyArray
  };
}

// Derive encryption key from password using Argon2id
export async function deriveEncryptionKey(password: string, salt: string): Promise<Uint8Array> {
  let saltBytes: Uint8Array;

  // Try to decode salt - it could be base64 (from backend storage) or hex (from registration)
  try {
    // First try base64 (expected format from backend /me endpoint)
    saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
  } catch (base64Error) {
    try {
      // Fallback to hex format (used during registration for key derivation)
      saltBytes = hexToUint8Array(salt);
    } catch (hexError) {
      // If both fail, this is an error
      const base64ErrorMsg = base64Error instanceof Error ? base64Error.message : String(base64Error);
      const hexErrorMsg = hexError instanceof Error ? hexError.message : String(hexError);
      throw new Error(`Invalid salt format: not base64 or hex. Base64 error: ${base64ErrorMsg}, Hex error: ${hexErrorMsg}`);
    }
  }

  // SECURITY: Argon2id requires salt to be at least 8 bytes
  // If salt is shorter, hash it with SHA-256 to expand it to 32 bytes
  if (saltBytes.length < 8) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', saltBytes.buffer as ArrayBuffer);
    saltBytes = new Uint8Array(hashBuffer);
  }

  const start = performance.now();
  const hash = await argon2id({
    password: password,
    salt: saltBytes,
    parallelism: 1,
    iterations: 2,
    memorySize: 19456,
    hashLength: 32,
    outputType: 'binary'
  });
  const end = performance.now();
  PerformanceTracker.trackCryptoOp('argon2id.derive_master_key', end - start);

  return hash;
}

// Utility function to convert Uint8Array to base64 safely (avoids stack overflow)
function uint8ArrayToBase64(array: Uint8Array): string {
  // Process in chunks to avoid stack overflow with large arrays
  const chunkSize = 8192; // 8KB chunks
  let result = '';

  for (let i = 0; i < array.length; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize);
    result += String.fromCharCode(...Array.from(chunk));
  }

  return btoa(result);
}

// Encrypt data using XChaCha20-Poly1305
export function encryptData(data: Uint8Array, key: Uint8Array): {
  encryptedData: string;
  nonce: string;
} {
  // For very small data (< 16 bytes), pad to ensure encrypted result meets minimum size requirement
  // XChaCha20-Poly1305 adds ~16 bytes of authentication data, so we need to pad small inputs
  let dataToEncrypt = data;

  if (data.length < 16) {
    // Pad to exactly 16 bytes to ensure encrypted result is >= 16 bytes
    dataToEncrypt = new Uint8Array(17); // 1 byte for original length + 16 bytes data
    dataToEncrypt[0] = data.length; // Store original length (0-15)
    dataToEncrypt.set(data, 1); // Copy original data
    // Fill remaining with zeros
    dataToEncrypt.fill(0, 1 + data.length);
  }

  // Generate random 24-byte nonce
  const nonce = new Uint8Array(24);
  crypto.getRandomValues(nonce);

  // Encrypt using XChaCha20-Poly1305
  const encrypted = xchacha20poly1305(key, nonce).encrypt(dataToEncrypt);

  return {
    encryptedData: uint8ArrayToBase64(encrypted),
    nonce: uint8ArrayToBase64(nonce)
  };
}

// Decrypt data using XChaCha20-Poly1305
export function decryptData(encryptedData: string, key: Uint8Array, nonce: string): Uint8Array {
  // Input validation
  if (!encryptedData || typeof encryptedData !== 'string') {
    throw new Error('encryptedData must be a non-empty string');
  }
  if (!key || !(key instanceof Uint8Array) || key.length !== 32) {
    throw new Error('key must be a 32-byte Uint8Array');
  }
  if (!nonce || typeof nonce !== 'string') {
    throw new Error('nonce must be a non-empty string');
  }

  // Prevent stack overflow from extremely long inputs (allow for large file chunks)
  // 4MB chunk = ~5.5MB base64 = ~5.5M chars, so allow up to 10M chars for safety
  if (encryptedData.length > 10000000 || nonce.length > 1000) {
    throw new Error(`Input data too long, possible corruption. encryptedData: ${encryptedData.length} chars, nonce: ${nonce.length} chars`);
  }

  // Convert base64 to Uint8Array with validation and fallback to hex
  let encryptedBytes: Uint8Array;
  let nonceBytes: Uint8Array;

  try {
    encryptedBytes = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  } catch (e) {
    // Try hex decoding as fallback
    try {
      encryptedBytes = hexToUint8Array(encryptedData);
    } catch (hexError) {
      throw new Error(`Invalid encryptedData: not base64 or hex. Base64 error: ${e instanceof Error ? e.message : String(e)}, Hex error: ${hexError instanceof Error ? hexError.message : String(hexError)}`);
    }
  }

  try {
    nonceBytes = Uint8Array.from(atob(nonce), c => c.charCodeAt(0));
  } catch (e) {
    // Try hex decoding as fallback
    try {
      nonceBytes = hexToUint8Array(nonce);
    } catch (hexError) {
      throw new Error(`Invalid nonce: not base64 or hex. Base64 error: ${e instanceof Error ? e.message : String(e)}, Hex error: ${hexError instanceof Error ? hexError.message : String(hexError)}`);
    }
  }

  // Validate decoded data lengths
  if (encryptedBytes.length < 16) {
    throw new Error(`Encrypted data too short: ${encryptedBytes.length} bytes, minimum 16 bytes required`);
  }
  if (nonceBytes.length < 24) {
    throw new Error(`Nonce too short: ${nonceBytes.length} bytes, expected 24 bytes`);
  }

  // Handle nonce length issues by truncating to 24 bytes if longer
  if (nonceBytes.length > 24) {
    nonceBytes = nonceBytes.slice(0, 24);
  } else if (nonceBytes.length < 24) {
    // Pad with zeros if shorter
    const paddedNonce = new Uint8Array(24);
    paddedNonce.set(nonceBytes);
    nonceBytes = paddedNonce;
  }

  // Decrypt using XChaCha20-Poly1305
  let decrypted: Uint8Array;
  try {
    decrypted = xchacha20poly1305(key, nonceBytes).decrypt(encryptedBytes);
  } catch (e) {
    throw new Error(`Decryption failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Check if this data was padded (17 bytes total with length prefix for small files)
  // Only apply unpadding logic to data that was actually padded during encryption (< 16 bytes)
  let finalData = decrypted;
  if (decrypted.length === 17) {
    const originalLength = decrypted[0];
    // If first byte indicates original length 0-15, this was padded data
    if (originalLength <= 15 && originalLength > 0) {
      finalData = decrypted.slice(1, 1 + originalLength);
    }
  }

  // Additional validation: if we expect large data (like private keys), ensure we got the right size
  // Dilithium private keys should be 4032 bytes, Kyber 2400 bytes, etc.
  // If we got 17 bytes but the first byte suggests unpadding, something went wrong
  if (decrypted.length === 17 && decrypted[0] > 15) {
    // This looks like corrupted data - the unpadding logic was applied to non-padded data
    // This can happen if decryption failed or data was corrupted
    throw new Error(`Decryption resulted in corrupted data: expected large data but got 17 bytes with invalid padding marker (${decrypted[0]})`);
  }

  // Validate decryption result
  if (!finalData || finalData.length === 0) {
    throw new Error('Decryption resulted in empty data');
  }

  return finalData;
}

// =====================================================
// MASTER KEY INTEGRITY VALIDATION
// =====================================================

/**
 * Generate HMAC-SHA256 verification hash for master key
 * Used to detect silent decryption failures or data corruption
 * 
 * @param masterKey - 32-byte Master Key
 * @returns Base64 encoded HMAC-SHA256 hash
 */
export async function generateMasterKeyVerificationHash(masterKey: Uint8Array): Promise<string> {
  if (masterKey.length !== 32) {
    throw new Error('Master Key must be 32 bytes');
  }

  // Use HMAC-SHA256 with a fixed constant as verification
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    masterKey.buffer.slice(masterKey.byteOffset, masterKey.byteOffset + masterKey.byteLength) as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const constant = new TextEncoder().encode('master_key_verification');
  const hashBuffer = await crypto.subtle.sign('HMAC', hmacKey, constant);
  const hashArray = new Uint8Array(hashBuffer);

  return uint8ArrayToBase64(hashArray);
}

/**
 * Verify master key integrity using HMAC
 * This detects if the master key was decrypted correctly
 * 
 * @param masterKey - 32-byte Master Key to verify
 * @param storedVerificationHash - Base64 encoded HMAC from database
 * @returns true if verification passes, throws error otherwise
 */
export async function verifyMasterKeyIntegrity(
  masterKey: Uint8Array,
  storedVerificationHash: string
): Promise<boolean> {
  if (masterKey.length !== 32) {
    throw new Error('Master Key must be 32 bytes');
  }

  if (!storedVerificationHash || typeof storedVerificationHash !== 'string') {
    throw new Error('Verification hash must be provided');
  }

  try {
    // Recalculate the verification hash
    const calculatedHash = await generateMasterKeyVerificationHash(masterKey);

    // Compare hashes (use constant-time comparison to prevent timing attacks)
    if (calculatedHash !== storedVerificationHash) {
      throw new Error(
        'Master Key verification failed: Data corruption detected. ' +
        'The master key may have been decrypted incorrectly or the data may be corrupted.'
      );
    }

    return true;
  } catch (error) {
    throw new Error(`Master Key integrity check failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Generate a random mnemonic phrase for backup/recovery using BIP39
export function generateRecoveryMnemonic(): string {
  return generateMnemonic(wordlist);
}

// Generate all required keypairs with proper encryption
export async function generateAllKeypairs(password: string, providedSalt?: string): Promise<{
  publicKey: string;
  encryptedPrivateKey: string;
  keyDerivationSalt: string;
  pqcKeypairs: {
    kyber: { publicKey: string; encryptedPrivateKey: string; privateKeyNonce: string; encryptionKey: string; encryptionNonce: string };
    x25519: { publicKey: string; encryptedPrivateKey: string; privateKeyNonce: string; encryptionKey: string; encryptionNonce: string };
    dilithium: { publicKey: string; encryptedPrivateKey: string; privateKeyNonce: string; encryptionKey: string; encryptionNonce: string };
    ed25519: { publicKey: string; encryptedPrivateKey: string; privateKeyNonce: string; encryptionKey: string; encryptionNonce: string };
  };
  mnemonic: string;
  mnemonicHash: string;
  encryptedMnemonic: string;
  mnemonicSalt: string;
  mnemonicIv: string;
}> {
  // Use provided salt or generate a new one
  const keyDerivationSalt = providedSalt || generateKeyDerivationSalt();

  // Derive master encryption key from password
  const masterKey = await deriveEncryptionKey(password, keyDerivationSalt);

  // Generate all keypairs sequentially to reduce overhead and improve performance
  const ed25519Keys = await generateEd25519Keypair()
  const x25519Keys = await generateX25519Keypair()
  const kyberKeys = await generateKyberKeypair()
  const dilithiumKeys = await generateDilithiumKeypair()

  // Generate random encryption keys for each private key
  const ed25519Key = new Uint8Array(32);
  const x25519Key = new Uint8Array(32);
  const kyberKey = new Uint8Array(32);
  const dilithiumKey = new Uint8Array(32);
  crypto.getRandomValues(ed25519Key);
  crypto.getRandomValues(x25519Key);
  crypto.getRandomValues(kyberKey);
  crypto.getRandomValues(dilithiumKey);

  // Encrypt private keys with their individual random keys
  const ed25519Encrypted = encryptData(ed25519Keys.privateKey, ed25519Key);
  const x25519Encrypted = encryptData(x25519Keys.privateKey, x25519Key);
  const kyberEncrypted = encryptData(kyberKeys.privateKey, kyberKey);
  const dilithiumEncrypted = encryptData(dilithiumKeys.privateKey, dilithiumKey);

  // Encrypt the random keys with the master key
  const ed25519KeyEncrypted = encryptData(ed25519Key, masterKey);
  const x25519KeyEncrypted = encryptData(x25519Key, masterKey);
  const kyberKeyEncrypted = encryptData(kyberKey, masterKey);
  const dilithiumKeyEncrypted = encryptData(dilithiumKey, masterKey);

  // Generate recovery mnemonic
  const mnemonic = generateRecoveryMnemonic();

  // Compute SHA256(mnemonic) - this is sent to server for verification
  const mnemonicBytes = new TextEncoder().encode(mnemonic);
  const mnemonicHash = await crypto.subtle.digest('SHA-256', mnemonicBytes);

  return {
    publicKey: ed25519Keys.publicKey, // Primary Ed25519 public key
    encryptedPrivateKey: ed25519Encrypted.encryptedData,
    keyDerivationSalt,
    pqcKeypairs: {
      kyber: {
        publicKey: kyberKeys.publicKey,
        encryptedPrivateKey: kyberEncrypted.encryptedData,
        privateKeyNonce: kyberEncrypted.nonce,
        encryptionKey: kyberKeyEncrypted.encryptedData,
        encryptionNonce: kyberKeyEncrypted.nonce
      },
      x25519: {
        publicKey: x25519Keys.publicKey,
        encryptedPrivateKey: x25519Encrypted.encryptedData,
        privateKeyNonce: x25519Encrypted.nonce,
        encryptionKey: x25519KeyEncrypted.encryptedData,
        encryptionNonce: x25519KeyEncrypted.nonce
      },
      dilithium: {
        publicKey: dilithiumKeys.publicKey,
        encryptedPrivateKey: dilithiumEncrypted.encryptedData,
        privateKeyNonce: dilithiumEncrypted.nonce,
        encryptionKey: dilithiumKeyEncrypted.encryptedData,
        encryptionNonce: dilithiumKeyEncrypted.nonce
      },
      ed25519: {
        publicKey: ed25519Keys.publicKey,
        encryptedPrivateKey: ed25519Encrypted.encryptedData,
        privateKeyNonce: ed25519Encrypted.nonce,
        encryptionKey: ed25519KeyEncrypted.encryptedData,
        encryptionNonce: ed25519KeyEncrypted.nonce
      },
    },
    mnemonic,
    mnemonicHash: Buffer.from(mnemonicHash).toString('hex'), // Send as hex for backend verification
    encryptedMnemonic: '', // Not sent to backend
    mnemonicSalt: '', // Not used
    mnemonicIv: '' // Not sent to backend
  };
}

// Wrapper for tracking setup performance
export async function trackedGenerateAllKeypairs(password: string, providedSalt?: string) {
  const start = performance.now();
  const result = await generateAllKeypairs(password, providedSalt);
  const end = performance.now();
  PerformanceTracker.trackCryptoOp('setup.generate_all_keys', end - start);
  return result;
}

// Decrypt user's PQC private keys using cached master key
export type UserCryptoData = {
  crypto_keypairs?: {
    accountSalt?: string | null;
    pqcKeypairs?: {
      kyber: { publicKey: string; encryptedPrivateKey: string; privateKeyNonce: string; encryptionKey: string; encryptionNonce: string };
      x25519: { publicKey: string; encryptedPrivateKey: string; privateKeyNonce: string; encryptionKey: string; encryptionNonce: string };
      dilithium: { publicKey: string; encryptedPrivateKey: string; privateKeyNonce: string; encryptionKey: string; encryptionNonce: string };
      ed25519: { publicKey: string; encryptedPrivateKey: string; privateKeyNonce: string; encryptionKey: string; encryptionNonce: string };
    };
  };
};

export async function decryptUserPrivateKeys(
  userData: UserCryptoData
): Promise<{
  ed25519PrivateKey: Uint8Array;
  ed25519PublicKey: string;
  dilithiumPrivateKey: Uint8Array;
  dilithiumPublicKey: string;
  x25519PrivateKey: Uint8Array;
  x25519PublicKey: string;
  kyberPrivateKey: Uint8Array;
  kyberPublicKey: string;
}> {
  if (!userData.crypto_keypairs?.pqcKeypairs) {
    throw new Error('User crypto keypairs not found in user data');
  }

  const start = performance.now();
  const pqcKeypairs = userData.crypto_keypairs.pqcKeypairs;

  // Validate that all required encrypted private keys are present and non-empty
  const requiredKeyTypes = ['ed25519', 'dilithium', 'x25519', 'kyber'] as const;
  for (const keyType of requiredKeyTypes) {
    const keypair = pqcKeypairs[keyType as typeof requiredKeyTypes[number]];
    if (!keypair) {
      throw new Error(`Missing ${keyType} keypair in user data. User setup may be incomplete.`);
    }
    if (!keypair.encryptedPrivateKey || keypair.encryptedPrivateKey === '') {
      throw new Error(`Missing encrypted ${keyType} private key. User setup may be incomplete.`);
    }
    if (!keypair.encryptionKey || keypair.encryptionKey === '') {
      throw new Error(`Missing ${keyType} encryption key. User setup may be incomplete.`);
    }
    if (!keypair.encryptionNonce || keypair.encryptionNonce === '') {
      throw new Error(`Missing ${keyType} encryption nonce. User setup may be incomplete.`);
    }
  }

  // Import master key manager dynamically to avoid circular dependencies
  const { masterKeyManager } = await import('./master-key');

  // Get cached master key
  let masterKey: Uint8Array;
  try {
    masterKey = masterKeyManager.getMasterKey();
  } catch {
    throw new Error('Master key not available. Please login again.');
  }

  try {
    // Decrypt the per-key encryption keys using master key
    const [
      ed25519Key,
      dilithiumKey,
      x25519Key,
      kyberKey
    ] = await Promise.all([
      decryptData(pqcKeypairs.ed25519.encryptionKey, masterKey, pqcKeypairs.ed25519.encryptionNonce),
      decryptData(pqcKeypairs.dilithium.encryptionKey, masterKey, pqcKeypairs.dilithium.encryptionNonce),
      decryptData(pqcKeypairs.x25519.encryptionKey, masterKey, pqcKeypairs.x25519.encryptionNonce),
      decryptData(pqcKeypairs.kyber.encryptionKey, masterKey, pqcKeypairs.kyber.encryptionNonce)
    ]);

    // Decrypt all private keys using their individual encryption keys
    // Decrypt sequentially to avoid any potential race conditions
    const ed25519PrivateKey = await decryptData(pqcKeypairs.ed25519.encryptedPrivateKey, ed25519Key, pqcKeypairs.ed25519.privateKeyNonce);
    const dilithiumPrivateKey = await decryptData(pqcKeypairs.dilithium.encryptedPrivateKey, dilithiumKey, pqcKeypairs.dilithium.privateKeyNonce);
    const x25519PrivateKey = await decryptData(pqcKeypairs.x25519.encryptedPrivateKey, x25519Key, pqcKeypairs.x25519.privateKeyNonce);
    const kyberPrivateKey = await decryptData(pqcKeypairs.kyber.encryptedPrivateKey, kyberKey, pqcKeypairs.kyber.privateKeyNonce);

    // Validate private key lengths to catch decryption corruption
    if (ed25519PrivateKey.length !== 32) {
      throw new Error(`Invalid Ed25519 private key length: expected 32 bytes, got ${ed25519PrivateKey.length} bytes`);
    }
    if (dilithiumPrivateKey.length !== 4032) {
      throw new Error(`Invalid Dilithium private key length: expected 4032 bytes, got ${dilithiumPrivateKey.length} bytes`);
    }
    if (x25519PrivateKey.length !== 32) {
      throw new Error(`Invalid X25519 private key length: expected 32 bytes, got ${x25519PrivateKey.length} bytes`);
    }
    if (kyberPrivateKey.length !== 2400) {
      throw new Error(`Invalid Kyber private key length: expected 2400 bytes, got ${kyberPrivateKey.length} bytes`);
    }

    const end = performance.now();
    PerformanceTracker.trackCryptoOp('login.decrypt_private_keys', end - start);

    return {
      ed25519PrivateKey,
      ed25519PublicKey: pqcKeypairs.ed25519.publicKey,
      dilithiumPrivateKey,
      dilithiumPublicKey: pqcKeypairs.dilithium.publicKey,
      x25519PrivateKey,
      x25519PublicKey: pqcKeypairs.x25519.publicKey,
      kyberPrivateKey,
      kyberPublicKey: pqcKeypairs.kyber.publicKey
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to decrypt private keys: ${errorMsg}. This usually means your master key derivation is incorrect or your password is wrong.`);
  }
}

// =====================================================
// FILENAME ENCRYPTION - ZERO-KNOWLEDGE FILENAMES
// =====================================================

/**
 * Encrypt a filename using XChaCha20-Poly1305
 * Server never sees plaintext filename - complete zero-knowledge
 * 
 * @param filename - Plaintext filename to encrypt
 * @param masterKey - User's master encryption key (32 bytes)
 * @returns Object with encrypted filename and salt for decryption
 */
export async function encryptFilename(filename: string, masterKey: Uint8Array): Promise<{
  encryptedFilename: string;
  filenameSalt: string;
}> {
  if (!filename || typeof filename !== 'string') {
    throw new Error('filename must be a non-empty string');
  }
  if (!masterKey || !(masterKey instanceof Uint8Array) || masterKey.length !== 32) {
    throw new Error('masterKey must be a 32-byte Uint8Array');
  }

  // Generate random 32-byte salt for this specific filename
  const filenameSalt = new Uint8Array(32);
  crypto.getRandomValues(filenameSalt);

  // Derive filename-specific key from master key and salt using deterministic HKDF-like expansion
  // Use HKDF-like construction: HMAC(masterKey, salt + 'filename-key')
  const keyMaterial = new Uint8Array(filenameSalt.length + 12); // salt + 'filename-key'
  keyMaterial.set(filenameSalt, 0);
  keyMaterial.set(new TextEncoder().encode('filename-key'), filenameSalt.length);

  // Use Web Crypto HMAC-SHA256 for key derivation
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    masterKey as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const derivedKeyMaterial = await crypto.subtle.sign('HMAC', hmacKey, keyMaterial);
  const filenameKey = new Uint8Array(derivedKeyMaterial.slice(0, 32));

  // Encrypt filename using XChaCha20-Poly1305
  const filenameBytes = new TextEncoder().encode(filename);
  const filenameNonce = new Uint8Array(24);
  crypto.getRandomValues(filenameNonce);

  const encryptedFilenameBytes = xchacha20poly1305(filenameKey, filenameNonce).encrypt(filenameBytes);

  return {
    encryptedFilename: uint8ArrayToBase64(encryptedFilenameBytes) + ':' + uint8ArrayToBase64(filenameNonce),
    filenameSalt: uint8ArrayToBase64(filenameSalt)
  };
}

/**
 * Decrypt a filename using XChaCha20-Poly1305
 * Called on frontend after fetching encrypted filename from server
 * 
 * @param encryptedFilename - Encrypted filename with embedded nonce (format: "encrypted:nonce" in base64)
 * @param filenameSalt - Salt stored in database (base64)
 * @param masterKey - User's master encryption key (32 bytes)
 * @returns Plaintext filename
 */
export async function decryptFilename(encryptedFilename: string, filenameSalt: string, masterKey: Uint8Array): Promise<string> {
  if (!encryptedFilename || typeof encryptedFilename !== 'string') {
    throw new Error('encryptedFilename must be a non-empty string');
  }
  if (!filenameSalt || typeof filenameSalt !== 'string') {
    throw new Error('filenameSalt must be a non-empty string');
  }
  if (!masterKey || !(masterKey instanceof Uint8Array) || masterKey.length !== 32) {
    throw new Error('masterKey must be a 32-byte Uint8Array');
  }

  try {
    // Parse encrypted filename (format: "encryptedData:nonce" in base64)
    const [encryptedPart, noncePart] = encryptedFilename.split(':');
    if (!encryptedPart || !noncePart) {
      throw new Error('Invalid encrypted filename format: expected "encryptedData:nonce"');
    }

    // Decode salt and nonce from base64
    const decodedSalt = Uint8Array.from(atob(filenameSalt), c => c.charCodeAt(0));
    const filenameNonce = Uint8Array.from(atob(noncePart), c => c.charCodeAt(0));
    const encryptedBytes = Uint8Array.from(atob(encryptedPart), c => c.charCodeAt(0));

    // Derive filename-specific key using the same method as encryption
    const keyMaterial = new Uint8Array(decodedSalt.length + 12); // salt + 'filename-key'
    keyMaterial.set(decodedSalt, 0);
    keyMaterial.set(new TextEncoder().encode('filename-key'), decodedSalt.length);

    // Use Web Crypto HMAC-SHA256 for key derivation (same as encryption)
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      masterKey as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const derivedKeyMaterial = await crypto.subtle.sign('HMAC', hmacKey, keyMaterial);
    const filenameKey = new Uint8Array(derivedKeyMaterial.slice(0, 32));

    // Decrypt filename
    const decryptedBytes = xchacha20poly1305(filenameKey, filenameNonce).decrypt(encryptedBytes);
    const filename = new TextDecoder().decode(decryptedBytes);

    // Sanitize control characters that can cause display issues
    return filename.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
  } catch (error) {
    throw new Error(`Failed to decrypt filename: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// =====================================================
// DOUBLE-WRAPPED MASTER KEY - ACCOUNT RECOVERY
// =====================================================

/**
 * Derive Recovery Key Encryption Key (RKEK) from mnemonic
 * RKEK is used to encrypt the Recovery Key (RK)
 * RK is used to decrypt the Master Key
 * 
 * This scheme allows:
 * 1. User forgets password but has mnemonic
 * 2. User can derive RKEK from mnemonic
 * 3. User can decrypt RK using RKEK
 * 4. User can decrypt Master Key using RK
 * 5. User can access files without losing data
 * 
 * @param mnemonic - 12-word recovery phrase
 * @returns RKEK (32 bytes for XChaCha20-Poly1305)
 */
export async function deriveRecoveryKeyEncryptionKey(mnemonic: string): Promise<Uint8Array> {
  // Hash the mnemonic with SHA-256 twice for additional security
  const mnemonicBytes = new TextEncoder().encode(mnemonic);
  const firstHash = await crypto.subtle.digest('SHA-256', mnemonicBytes);
  const secondHash = await crypto.subtle.digest('SHA-256', firstHash);

  return new Uint8Array(secondHash);
}

/**
 * Generate Recovery Key (RK) - a random 32-byte key
 * RK will be encrypted with RKEK and stored as encryptedRecoveryKey
 * RK will be used to decrypt the Master Key
 * 
 * @returns 32-byte Recovery Key
 */
export function generateRecoveryKey(): Uint8Array {
  const rk = new Uint8Array(32);
  crypto.getRandomValues(rk);
  return rk;
}

/**
 * Encrypt Recovery Key with RKEK from mnemonic
 * Returns encryptedRecoveryKey that can be stored on server
 * 
 * @param recoveryKey - 32-byte RK to encrypt
 * @param rkek - Recovery Key Encryption Key (32 bytes)
 * @returns Base64 encoded encrypted RK with embedded nonce
 */
export function encryptRecoveryKey(recoveryKey: Uint8Array, rkek: Uint8Array): {
  encryptedRecoveryKey: string;
  recoveryKeyNonce: string;
} {
  if (recoveryKey.length !== 32) {
    throw new Error('Recovery Key must be 32 bytes');
  }
  if (rkek.length !== 32) {
    throw new Error('RKEK must be 32 bytes');
  }

  // Generate random nonce
  const nonce = new Uint8Array(24);
  crypto.getRandomValues(nonce);

  // Encrypt RK with RKEK using XChaCha20-Poly1305
  const encrypted = xchacha20poly1305(rkek, nonce).encrypt(recoveryKey);

  return {
    encryptedRecoveryKey: uint8ArrayToBase64(encrypted),
    recoveryKeyNonce: uint8ArrayToBase64(nonce)
  };
}

/**
 * Decrypt Recovery Key using RKEK
 * 
 * @param encryptedRecoveryKey - Base64 encoded encrypted RK
 * @param recoveryKeyNonce - Base64 encoded nonce
 * @param rkek - Recovery Key Encryption Key (32 bytes)
 * @returns Decrypted 32-byte Recovery Key
 */
export function decryptRecoveryKey(encryptedRecoveryKey: string, recoveryKeyNonce: string, rkek: Uint8Array): Uint8Array {
  if (rkek.length !== 32) {
    throw new Error('RKEK must be 32 bytes');
  }

  try {
    const encryptedBytes = Uint8Array.from(atob(encryptedRecoveryKey), c => c.charCodeAt(0));
    const nonceBytes = Uint8Array.from(atob(recoveryKeyNonce), c => c.charCodeAt(0));

    if (nonceBytes.length !== 24) {
      throw new Error(`Invalid nonce length: ${nonceBytes.length}, expected 24`);
    }

    const decrypted = xchacha20poly1305(rkek, nonceBytes).decrypt(encryptedBytes);

    if (decrypted.length !== 32) {
      throw new Error(`Invalid decrypted key length: ${decrypted.length}, expected 32`);
    }

    return decrypted;
  } catch (error) {
    throw new Error(`Failed to decrypt recovery key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Encrypt Master Key with Recovery Key
 * During registration, we encrypt MK with RK
 * During recovery, we can decrypt MK with RK (after decrypting RK with RKEK from mnemonic)
 * 
 * @param masterKey - 32-byte Master Key to encrypt
 * @param recoveryKey - 32-byte Recovery Key
 * @returns Base64 encoded encrypted MK with embedded nonce
 */
export function encryptMasterKeyWithRecoveryKey(masterKey: Uint8Array, recoveryKey: Uint8Array): {
  encryptedMasterKey: string;
  masterKeyNonce: string;
} {
  if (masterKey.length !== 32) {
    throw new Error('Master Key must be 32 bytes');
  }
  if (recoveryKey.length !== 32) {
    throw new Error('Recovery Key must be 32 bytes');
  }

  // Generate random nonce
  const nonce = new Uint8Array(24);
  crypto.getRandomValues(nonce);

  // Encrypt MK with RK using XChaCha20-Poly1305
  const encrypted = xchacha20poly1305(recoveryKey, nonce).encrypt(masterKey);

  return {
    encryptedMasterKey: uint8ArrayToBase64(encrypted),
    masterKeyNonce: uint8ArrayToBase64(nonce)
  };
}

/**
 * Decrypt Master Key using Recovery Key
 * This is done during account recovery after decrypting RK with RKEK
 * 
 * @param encryptedMasterKey - Base64 encoded encrypted MK
 * @param masterKeyNonce - Base64 encoded nonce
 * @param recoveryKey - 32-byte Recovery Key (decrypted from RKEK)
 * @returns Decrypted 32-byte Master Key
 */
export function decryptMasterKeyWithRecoveryKey(encryptedMasterKey: string, masterKeyNonce: string, recoveryKey: Uint8Array): Uint8Array {
  if (recoveryKey.length !== 32) {
    throw new Error('Recovery Key must be 32 bytes');
  }

  try {
    const encryptedBytes = Uint8Array.from(atob(encryptedMasterKey), c => c.charCodeAt(0));
    const nonceBytes = Uint8Array.from(atob(masterKeyNonce), c => c.charCodeAt(0));

    if (nonceBytes.length !== 24) {
      throw new Error(`Invalid nonce length: ${nonceBytes.length}, expected 24`);
    }

    const decrypted = xchacha20poly1305(recoveryKey, nonceBytes).decrypt(encryptedBytes);

    if (decrypted.length !== 32) {
      throw new Error(`Invalid decrypted key length: ${decrypted.length}, expected 32`);
    }

    return decrypted;
  } catch (error) {
    throw new Error(`Failed to decrypt master key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Derive a key using HKDF-SHA256
 * @param ikm - Input Key Material (32 bytes)
 * @param salt - Salt string
 * @param info - Info string
 * @param length - Desired output length in bytes
 * @returns CryptoKey for HMAC operations
 */
async function deriveHKDFKey(
  ikm: Uint8Array,
  salt: string,
  info: string,
  length: number = 32
): Promise<CryptoKey> {
  // Convert salt and info to bytes
  const saltBytes = new TextEncoder().encode(salt);
  const infoBytes = new TextEncoder().encode(info);

  // Import IKM as raw key
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ikm.buffer.slice(ikm.byteOffset, ikm.byteOffset + ikm.byteLength) as ArrayBuffer,
    'HKDF',
    false,
    ['deriveKey']
  );

  // Convert desired length in bytes to bits for WebCrypto API
  const lengthBits = length * 8;

  // Derive HMAC key using HKDF
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: saltBytes,
      info: infoBytes
    },
    keyMaterial,
    {
      name: 'HMAC',
      hash: 'SHA-256',
      length: lengthBits
    } as HmacKeyGenParams,
    false,
    ['sign']
  );

  return derivedKey;
}

/**
 * Convert Uint8Array to base64url (URL-safe base64)
 * @param array - Input bytes
 * @returns base64url encoded string
 */


// =====================================================
// FOLDER MANIFEST CREATION AND SIGNING
// =====================================================

/**
 * Create canonical JSON representation of a manifest for consistent signing/verification
 * This MUST match the backend's JSON.stringify() output exactly
 * @param manifest - The manifest object to canonicalize
 * @returns The canonical JSON string
 */
function createCanonicalManifest(manifest: Record<string, unknown> | unknown[]): string {
  // Use JSON.stringify with consistent property ordering
  // Keys are already in consistent order in the manifest object
  return JSON.stringify(manifest);
}

/**
 * Sign a manifest hash with the appropriate algorithm
 * @param hashBytes - SHA512 hash of the manifest as Uint8Array
 * @param privateKey - Private key as Uint8Array (32 for Ed25519, 4032 for Dilithium)
 * @returns Base64 encoded signature
 */
async function signManifest(hashBytes: Uint8Array, privateKey: Uint8Array): Promise<string> {
  if (privateKey.length === 32) {
    // Ed25519: sign the hash bytes directly (no double hashing)
    const signature = ed.sign(hashBytes, privateKey);
    return Buffer.from(signature).toString('base64');
  } else if (privateKey.length === 4032) {
    // Dilithium: sign the hash bytes
    const signature = ml_dsa65.sign(privateKey, hashBytes);
    return Buffer.from(signature).toString('base64');
  } else {
    throw new Error(`Unsupported private key length: ${privateKey.length}`);
  }
}

/**
 * Create a signed folder manifest for zero-knowledge folder operations
 * Computes HMAC for duplicate checking, encrypts folder name, and signs manifest
 *
 * @param folderName - Plaintext folder name
 * @param parentId - Parent folder ID (null for root)
 * @param privateKeys - User's private keys for signing
 * @returns Signed manifest data ready for backend submission
 */
export async function createSignedFolderManifest(
  folderName: string,
  parentId: string | null,
  privateKeys: {
    ed25519PrivateKey: Uint8Array;
    ed25519PublicKey: string;
    dilithiumPrivateKey: Uint8Array;
    dilithiumPublicKey: string;
  }
): Promise<{
  encryptedName: string;
  nameSalt: string;
  manifestHash: string;
  manifestCreatedAt: number;
  manifestSignatureEd25519: string;
  manifestPublicKeyEd25519: string;
  manifestSignatureDilithium: string;
  manifestPublicKeyDilithium: string;
  algorithmVersion: string;
  nameHmac: string;
}> {
  // Get master key for encryption and HMAC computation
  const { masterKeyManager } = await import('./master-key');
  const masterKey = masterKeyManager.getMasterKey();

  // Encrypt folder name for zero-knowledge storage
  const { encryptedFilename: encryptedName, filenameSalt: nameSalt } = await encryptFilename(folderName, masterKey);

  // Compute HMAC for zero-knowledge duplicate checking
  const normalizedName = folderName.toLowerCase().normalize('NFC');
  const hmacKey = await deriveHKDFKey(masterKey, 'EllipticcDrive-DuplicateCheck-v1', `filename-hmac-key||${parentId || 'root'}`, 32);
  const nameHmacBytes = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(normalizedName));
  const nameHmac = Array.from(new Uint8Array(nameHmacBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Create folder manifest
  const manifestCreatedAt = Math.floor(Date.now() / 1000);
  const manifest = {
    encryptedName,
    parentId: parentId || null,
    created: manifestCreatedAt,
    version: '2.0-hybrid',
    algorithmVersion: 'v3-hybrid-pqc-xchacha20'
  };

  // Create canonical JSON representation
  const canonicalJson = createCanonicalManifest(manifest);

  // Compute SHA512 hash of manifest
  const manifestBytes = new TextEncoder().encode(canonicalJson);
  const manifestHashBytes = sha512(manifestBytes);
  const manifestHash = Buffer.from(manifestHashBytes).toString('hex');

  // Sign manifest with Ed25519
  const ed25519Signature = await signManifest(manifestHashBytes, privateKeys.ed25519PrivateKey);

  // Sign manifest with Dilithium (required for post-quantum security)
  // Dilithium signs the SHA512 hash of the manifest
  // IMPORTANT: Make a defensive copy of the private key in case it's being mutated
  const dilithiumKeyForSigning = new Uint8Array(privateKeys.dilithiumPrivateKey);
  const dilithiumSignature = await signManifest(manifestHashBytes, dilithiumKeyForSigning);

  return {
    encryptedName,
    nameSalt,
    manifestHash,
    manifestCreatedAt,
    manifestSignatureEd25519: ed25519Signature,
    manifestPublicKeyEd25519: privateKeys.ed25519PublicKey,
    manifestSignatureDilithium: dilithiumSignature,
    manifestPublicKeyDilithium: privateKeys.dilithiumPublicKey,
    algorithmVersion: 'v3-hybrid-pqc-xchacha20',
    nameHmac
  };
}

/**
 * Create a signed file manifest for zero-knowledge file operations (like renaming)
 * Computes HMAC for duplicate checking, encrypts filename, and signs manifest
 *
 * @param filename - Plaintext filename
 * @param folderId - Parent folder ID (or null for root)
 * @param privateKeys - User's private keys for signing
 * @returns Signed manifest data ready for backend submission
 */
export async function createSignedFileManifest(
  filename: string,
  folderId: string | null,
  privateKeys: {
    ed25519PrivateKey: Uint8Array;
    ed25519PublicKey: string;
    dilithiumPrivateKey: Uint8Array;
    dilithiumPublicKey: string;
  }
): Promise<{
  encryptedFilename: string;
  filenameSalt: string;
  manifestHash: string;
  manifestCreatedAt: number;
  manifestSignatureEd25519: string;
  manifestPublicKeyEd25519: string;
  manifestSignatureDilithium: string;
  manifestPublicKeyDilithium: string;
  algorithmVersion: string;
  nameHmac: string;
}> {
  // Get master key for encryption and HMAC computation
  const { masterKeyManager } = await import('./master-key');
  const masterKey = masterKeyManager.getMasterKey();

  // Encrypt filename for zero-knowledge storage
  const { encryptedFilename, filenameSalt } = await encryptFilename(filename, masterKey);

  // Compute HMAC for zero-knowledge duplicate checking
  const normalizedName = filename.toLowerCase().normalize('NFC');
  const hmacKey = await deriveHKDFKey(masterKey, 'EllipticcDrive-DuplicateCheck-v1', `filename-hmac-key||${folderId || 'root'}`, 32);
  const nameHmacBytes = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(normalizedName));
  const nameHmac = Array.from(new Uint8Array(nameHmacBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Create file manifest for rename operation
  const manifestCreatedAt = Math.floor(Date.now() / 1000);
  const manifest = {
    filename: encryptedFilename, // Use encrypted filename for manifest verification
    created: manifestCreatedAt,
    version: '2.0-file-rename',
    algorithmVersion: 'v3-hybrid-pqc-xchacha20'
  };

  // Create canonical JSON representation
  const canonicalJson = createCanonicalManifest(manifest);

  // Compute SHA512 hash of manifest
  const manifestBytes = new TextEncoder().encode(canonicalJson);
  const manifestHashBytes = sha512(manifestBytes);
  const manifestHash = Buffer.from(manifestHashBytes).toString('hex');

  // Sign manifest with Ed25519
  const ed25519Signature = await signManifest(manifestHashBytes, privateKeys.ed25519PrivateKey);

  // Sign manifest with Dilithium (required for post-quantum security)
  // IMPORTANT: Make a defensive copy of the private key in case it's being mutated
  const dilithiumKeyForSigning = new Uint8Array(privateKeys.dilithiumPrivateKey);
  const dilithiumSignature = await signManifest(manifestHashBytes, dilithiumKeyForSigning);

  return {
    encryptedFilename,
    filenameSalt,
    manifestHash,
    manifestCreatedAt,
    manifestSignatureEd25519: ed25519Signature,
    manifestPublicKeyEd25519: privateKeys.ed25519PublicKey,
    manifestSignatureDilithium: dilithiumSignature,
    manifestPublicKeyDilithium: privateKeys.dilithiumPublicKey,
    algorithmVersion: 'v3-hybrid-pqc-xchacha20',
    nameHmac
  };
}

/**
 * Compute HMAC for a filename for zero-knowledge duplicate detection
 * This matches the folder implementation exactly but for files
 * @param filename - The plaintext filename
 * @param folderId - The parent folder ID (or null for root)
 * @returns Promise<string> - The HMAC hex string
 */
export async function computeFilenameHmac(filename: string, folderId: string | null = null): Promise<string> {
  const { masterKeyManager } = await import('./master-key');
  const masterKey = masterKeyManager.getMasterKey();

  // Normalize filename for consistent HMAC computation
  const normalizedName = filename.toLowerCase().normalize('NFC');

  // Derive HMAC key using HKDF - same as folder implementation
  const hmacKey = await deriveHKDFKey(masterKey, 'EllipticcDrive-DuplicateCheck-v1', `filename-hmac-key||${folderId || 'root'}`, 32);

  // Compute HMAC using normalized filename
  const nameHmacBytes = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(normalizedName));
  const nameHmac = Array.from(new Uint8Array(nameHmacBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return nameHmac;
}

// =====================================================
// PAPER CONTENT ENCRYPTION
// =====================================================

/**
 * Encrypt paper content using a key derived from the master key and a random salt
 * @param content - The plaintext content
 * @param masterKey - User's master encryption key
 */
export async function encryptPaperContent(content: string, masterKey: Uint8Array): Promise<{
  encryptedContent: string;
  iv: string;
  salt: string;
}> {
  if (content === undefined || content === null) {
    throw new Error('Content cannot be null or undefined');
  }

  // 1. Generate random salt
  const salt = new Uint8Array(32);
  crypto.getRandomValues(salt);

  // 2. Derive key: HMAC(masterKey, salt + 'paper-content-key')
  const keyMaterial = new Uint8Array(salt.length + 17); // salt + 'paper-content-key'
  keyMaterial.set(salt, 0);
  keyMaterial.set(new TextEncoder().encode('paper-content-key'), salt.length);

  const hmacKey = await crypto.subtle.importKey(
    'raw',
    masterKey as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const derivedKeyMaterial = await crypto.subtle.sign('HMAC', hmacKey, keyMaterial);
  const paperKey = new Uint8Array(derivedKeyMaterial.slice(0, 32));

  // 3. Encrypt content
  const contentBytes = new TextEncoder().encode(content);
  const nonce = new Uint8Array(24);
  crypto.getRandomValues(nonce);

  const encryptedBytes = xchacha20poly1305(paperKey, nonce).encrypt(contentBytes);

  return {
    encryptedContent: uint8ArrayToBase64(encryptedBytes),
    iv: uint8ArrayToBase64(nonce),
    salt: uint8ArrayToBase64(salt)
  };
}

/**
 * Decrypt paper content
 */
export async function decryptPaperContent(
  encryptedContent: string,
  iv: string,
  salt: string,
  masterKey: Uint8Array
): Promise<string> {
  if (!encryptedContent) return '';

  try {
    // Decode base64 inputs
    const encryptedBytes = Uint8Array.from(atob(encryptedContent), c => c.charCodeAt(0));
    const nonceBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
    const saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0));

    // Derive same key
    const keyMaterial = new Uint8Array(saltBytes.length + 17);
    keyMaterial.set(saltBytes, 0);
    keyMaterial.set(new TextEncoder().encode('paper-content-key'), saltBytes.length);

    const hmacKey = await crypto.subtle.importKey(
      'raw',
      masterKey as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const derivedKeyMaterial = await crypto.subtle.sign('HMAC', hmacKey, keyMaterial);
    const paperKey = new Uint8Array(derivedKeyMaterial.slice(0, 32));

    // Decrypt
    const decryptedBytes = xchacha20poly1305(paperKey, nonceBytes).decrypt(encryptedBytes);
    return new TextDecoder().decode(decryptedBytes);
  } catch (error) {
    console.error('Failed to decrypt paper content:', error);
    throw new Error('Failed to decrypt paper content');
  }
}

/**
 * Decrypt paper content when the paper key (derived CEK) is already available.
 * This is used for shared previews where the recipient derives the paper key
 * (via envelope decryption) and can decrypt blocks without having the master key.
 */
export async function decryptPaperContentWithPaperKey(
  encryptedContent: string,
  iv: string,
  paperKey: Uint8Array
): Promise<string> {
  if (!encryptedContent) return '';

  try {
    const encryptedBytes = Uint8Array.from(atob(encryptedContent), c => c.charCodeAt(0));
    const nonceBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
    const decryptedBytes = xchacha20poly1305(paperKey, nonceBytes).decrypt(encryptedBytes);
    return new TextDecoder().decode(decryptedBytes);
  } catch (error) {
    console.error('Failed to decrypt paper content with provided paper key:', error);
    throw new Error('Failed to decrypt paper content');
  }
}

