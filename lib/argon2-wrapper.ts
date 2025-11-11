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
  // argon2id from hash-wasm handles both string and Uint8Array inputs
  const encoder = new TextEncoder()
  const saltBytes = encoder.encode(salt)

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
