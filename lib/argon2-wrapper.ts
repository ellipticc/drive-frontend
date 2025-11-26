'use client'

/**
 * Argon2 wrapper - uses hash-wasm for browser-compatible hashing
 * (Same library used in crypto.ts)
 */

import { argon2id } from 'hash-wasm'

export async function hashWithArgon2(
  password: string,
  salt: string,
  time: number = 4,
  mem: number = 65536,
  parallelism: number = 1,
  hashLen: number = 32
): Promise<string> {
  // Convert salt string to bytes
  // The salt can be either:
  // - A hex string (64 chars for 32 bytes) from key derivation
  // - A wallet address (42 chars) for MetaMask
  const encoder = new TextEncoder()
  
  let saltBytes: Uint8Array
  
  // Try to interpret as hex first (if even length and all hex chars)
  if (salt.length % 2 === 0 && /^[0-9a-fA-F]*$/.test(salt)) {
    // Valid hex string - convert to bytes
    saltBytes = new Uint8Array(salt.length / 2)
    for (let i = 0; i < salt.length; i += 2) {
      saltBytes[i / 2] = parseInt(salt.substr(i, 2), 16)
    }
  } else {
    // Not hex, treat as plain string (e.g., wallet address)
    saltBytes = encoder.encode(salt)
  }

  // SECURITY: Argon2id requires salt to be at least 8 bytes
  // If salt is shorter, hash it with SHA-256 to expand it to 32 bytes
  if (saltBytes.length < 8) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', saltBytes as any)
    saltBytes = new Uint8Array(hashBuffer)
  }

  // hash-wasm's argon2id expects memorySize in KB
  // mem parameter is now the memory size in KB (65536 KB = 64 MB)
  const hashBytes = await argon2id({
    password: password,
    salt: saltBytes,
    parallelism: parallelism,
    iterations: time,
    memorySize: mem,
    hashLength: hashLen,
    outputType: 'binary'
  })

  // Convert Uint8Array to hex string
  return Array.from(hashBytes)
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('')
}
