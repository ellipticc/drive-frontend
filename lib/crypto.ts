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
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';

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
  return {
    publicKey: uint8ArrayToHex(new Uint8Array(keys.publicKey)),
    privateKey: new Uint8Array(keys.secretKey)
  };
}

// Derive encryption key from password using Argon2id
export async function deriveEncryptionKey(password: string, salt: string): Promise<Uint8Array> {
  let saltBytes: Uint8Array;
  try {
    // Try base64 first (expected format for account salt)
    saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
  } catch (base64Error) {
    try {
      // Try hex as fallback
      saltBytes = hexToUint8Array(salt);
    } catch (hexError) {
      const base64ErrorMsg = base64Error instanceof Error ? base64Error.message : String(base64Error);
      const hexErrorMsg = hexError instanceof Error ? hexError.message : String(hexError);
      throw new Error(`Invalid salt format: not base64 or hex. Base64 error: ${base64ErrorMsg}, Hex error: ${hexErrorMsg}`);
    }
  }

  const hash = await argon2id({
    password: password,
    salt: saltBytes,
    parallelism: 1,
    iterations: 2,
    memorySize: 19456,
    hashLength: 32,
    outputType: 'binary'
  });

  return hash;
}

// Utility function to convert Uint8Array to base64 safely (avoids stack overflow)
function uint8ArrayToBase64(array: Uint8Array): string {
  // Process in chunks to avoid stack overflow with large arrays
  const chunkSize = 8192; // 8KB chunks
  let result = '';

  for (let i = 0; i < array.length; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize);
    result += String.fromCharCode.apply(null, chunk as any);
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
  let isPadded = false;

  if (data.length < 16) {
    // Pad to exactly 16 bytes to ensure encrypted result is >= 16 bytes
    dataToEncrypt = new Uint8Array(17); // 1 byte for original length + 16 bytes data
    dataToEncrypt[0] = data.length; // Store original length (0-15)
    dataToEncrypt.set(data, 1); // Copy original data
    // Fill remaining with zeros
    dataToEncrypt.fill(0, 1 + data.length);
    isPadded = true;
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
  let finalData = decrypted;
  if (decrypted.length === 17) {
    const originalLength = decrypted[0];
    // If first byte indicates original length 0-15, this was padded data
    if (originalLength <= 15) {
      finalData = decrypted.slice(1, 1 + originalLength);
    }
  }

  // Validate decryption result
  if (!finalData || finalData.length === 0) {
    throw new Error('Decryption resulted in empty data');
  }

  return finalData;
}

// Generate a random mnemonic phrase for backup/recovery using BIP39
export function generateRecoveryMnemonic(): string {
  return generateMnemonic(wordlist);
}

// Create and sign a folder manifest for zero-knowledge folder creation
export async function createSignedFolderManifest(
  folderName: string,
  parentId: string | null,
  userKeys: {
    ed25519PrivateKey: Uint8Array;
    ed25519PublicKey: string;
    dilithiumPrivateKey?: Uint8Array;
    dilithiumPublicKey?: string;
  }
): Promise<{
  manifestJson: string;
  manifestSignatureEd25519: string;
  manifestPublicKeyEd25519: string;
  manifestSignatureDilithium?: string;
  manifestPublicKeyDilithium?: string;
  algorithmVersion: string;
}> {
  // Create the manifest object
  const manifest = {
    name: folderName,
    parentId: parentId,
    created: Math.floor(Date.now() / 1000),
    version: '2.0-hybrid',
    algorithmVersion: 'v3-hybrid-pqc-xchacha20'
  };

  // Convert manifest to canonical JSON for signing
  const manifestJson = JSON.stringify(manifest);
  const manifestBytes = new TextEncoder().encode(manifestJson);

  // Sign with Ed25519
  const ed25519Signature = await ed.sign(manifestBytes, userKeys.ed25519PrivateKey);
  const manifestSignatureEd25519 = btoa(String.fromCharCode(...ed25519Signature));

  // Sign with Dilithium if available
  let manifestSignatureDilithium: string | undefined;
  if (userKeys.dilithiumPrivateKey && userKeys.dilithiumPublicKey) {
    const dilithiumSignature = ml_dsa65.sign(userKeys.dilithiumPrivateKey, manifestBytes);
    manifestSignatureDilithium = btoa(String.fromCharCode(...new Uint8Array(dilithiumSignature)));
  }

  return {
    manifestJson,
    manifestSignatureEd25519,
    manifestPublicKeyEd25519: userKeys.ed25519PublicKey,
    manifestSignatureDilithium,
    manifestPublicKeyDilithium: userKeys.dilithiumPublicKey,
    algorithmVersion: 'v3-hybrid-pqc-xchacha20'
  };
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

  // Encrypt mnemonic with XChaCha20-Poly1305 using SHA256(mnemonic) as key (for recovery purposes)
  const mnemonicBytes = new TextEncoder().encode(mnemonic);
  const mnemonicHash = await crypto.subtle.digest('SHA-256', mnemonicBytes);
  const mnemonicKey = new Uint8Array(mnemonicHash);
  const mnemonicEncrypted = encryptData(mnemonicBytes, mnemonicKey);

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
    encryptedMnemonic: mnemonicEncrypted.encryptedData,
    mnemonicSalt: '', // Not used for SHA256-based encryption
    mnemonicIv: mnemonicEncrypted.nonce
  };
}

// Decrypt user's PQC private keys using cached master key
export async function decryptUserPrivateKeys(
  userData: {
    crypto_keypairs?: {
      accountSalt: string;
      pqcKeypairs?: {
        kyber: { publicKey: string; encryptedPrivateKey: string; privateKeyNonce: string; encryptionKey: string; encryptionNonce: string };
        x25519: { publicKey: string; encryptedPrivateKey: string; privateKeyNonce: string; encryptionKey: string; encryptionNonce: string };
        dilithium: { publicKey: string; encryptedPrivateKey: string; privateKeyNonce: string; encryptionKey: string; encryptionNonce: string };
        ed25519: { publicKey: string; encryptedPrivateKey: string; privateKeyNonce: string; encryptionKey: string; encryptionNonce: string };
      };
    };
  }
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

  const pqcKeypairs = userData.crypto_keypairs.pqcKeypairs;

  // Import master key manager dynamically to avoid circular dependencies
  const { masterKeyManager } = await import('./master-key');

  // Get cached master key
  const masterKey = masterKeyManager.getMasterKey();

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
  const ed25519PrivateKey = decryptData(pqcKeypairs.ed25519.encryptedPrivateKey, ed25519Key, pqcKeypairs.ed25519.privateKeyNonce);
  const dilithiumPrivateKey = decryptData(pqcKeypairs.dilithium.encryptedPrivateKey, dilithiumKey, pqcKeypairs.dilithium.privateKeyNonce);
  const x25519PrivateKey = decryptData(pqcKeypairs.x25519.encryptedPrivateKey, x25519Key, pqcKeypairs.x25519.privateKeyNonce);
  const kyberPrivateKey = decryptData(pqcKeypairs.kyber.encryptedPrivateKey, kyberKey, pqcKeypairs.kyber.privateKeyNonce);

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

    // Diagnostic logging
    console.log('🔍 DEBUG filename decryption:', {
      masterKeyLength: masterKey.length,
      masterKeyPreview: uint8ArrayToHex(masterKey.slice(0, 8)) + '...',
      saltLength: decodedSalt.length,
      saltPreview: uint8ArrayToHex(decodedSalt.slice(0, 8)) + '...',
      nonceLength: filenameNonce.length,
      encryptedBytesLength: encryptedBytes.length,
      encryptedPreview: uint8ArrayToHex(encryptedBytes.slice(0, 16)) + '...'
    });

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

    console.log('🔍 DEBUG derived key:', {
      derivedKeyLength: filenameKey.length,
      derivedKeyPreview: uint8ArrayToHex(filenameKey.slice(0, 8)) + '...'
    });

    // Decrypt filename
    const decryptedBytes = xchacha20poly1305(filenameKey, filenameNonce).decrypt(encryptedBytes);
    const filename = new TextDecoder().decode(decryptedBytes);

    console.log('✅ Filename decrypted successfully');
    return filename;
  } catch (error) {
    throw new Error(`Failed to decrypt filename: ${error instanceof Error ? error.message : String(error)}`);
  }
}
