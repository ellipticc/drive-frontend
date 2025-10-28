// SRP Constants - Must match server
const SRP_GROUP_N = BigInt('0x' + process.env.NEXT_PUBLIC_SRP_GROUP_N!);
const SRP_GROUP_G = BigInt(process.env.NEXT_PUBLIC_SRP_GROUP_G!);

// Import fast SHA-256 from hash-wasm
import { sha256 } from 'hash-wasm';

/**
 * Hash function using fast hash-wasm SHA-256
 */
async function H(...args: (string | Uint8Array | bigint)[]): Promise<Uint8Array> {
  const data = args.reduce((acc: number[], arg) => {
    if (typeof arg === 'string') {
      const encoder = new TextEncoder();
      return [...acc, ...encoder.encode(arg)];
    } else if (arg instanceof Uint8Array) {
      return [...acc, ...arg];
    } else if (typeof arg === 'bigint') {
      // Convert bigint to 256-byte buffer (big-endian) to match server
      const hex = arg.toString(16).padStart(512, '0'); // 256 bytes * 2 hex chars
      const bytes = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        // Big-endian: most significant byte first
        const hexIndex = i * 2;
        bytes[i] = parseInt(hex.slice(hexIndex, hexIndex + 2), 16);
      }
      return [...acc, ...bytes];
    }
    return acc;
  }, []);

  // Use fast hash-wasm SHA-256 instead of WebCrypto
  const hashHex = await sha256(new Uint8Array(data));
  const hashBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    hashBytes[i] = parseInt(hashHex.slice(i * 2, i * 2 + 2), 16);
  }
  return hashBytes;
}

/**
 * Convert bigint to hex string with fixed length
 */
function bigintToHex(value: bigint, length: number = 64): string {
  return value.toString(16).padStart(length * 2, '0');
}

/**
 * Convert hex string to bigint
 */
function hexToBigint(hex: string): bigint {
  return BigInt('0x' + hex);
}

/**
 * Modular exponentiation
 */
function modPow(base: bigint, exp: bigint, modulus: bigint): bigint {
  let result = 1n;
  base = base % modulus;

  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % modulus;
    }
    exp = exp >> 1n;
    base = (base * base) % modulus;
  }

  return result;
}

/**
 * Generate random bigint
 */
function generateRandomBigint(bitLength: number): bigint {
  const byteLength = Math.ceil(bitLength / 8);
  const randomBytesArray = new Uint8Array(byteLength);

  // Use crypto.getRandomValues if available (browser), otherwise fallback
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytesArray);
  } else {
    // Node.js fallback
    for (let i = 0; i < byteLength; i++) {
      randomBytesArray[i] = Math.floor(Math.random() * 256);
    }
  }

  // Convert to bigint
  let result = 0n;
  for (let i = 0; i < byteLength; i++) {
    result = (result << 8n) | BigInt(randomBytesArray[i]);
  }

  // Ensure it's within the correct bit length
  const mask = (1n << BigInt(bitLength)) - 1n;
  return result & mask;
}

/**
 * Calculate k = H(N, g)
 */
function calculateK(): bigint {
  // Use constant k=3 to match server implementation
  return 3n;
}

/**
 * Calculate u = H(A, B)
 */
async function calculateU(A: bigint, B: bigint): Promise<bigint> {
  const hash = await H(A, B);
  return hexToBigint(Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join(''));
}

/**
 * Calculate x = H(salt, H(username, password))
 */
async function calculateX(salt: string, username: string, password: string): Promise<bigint> {
  // Calculate H(username, ':', password)
  const identityData = `${username}:${password}`;
  const identityHash = await H(identityData);

  // Convert salt from hex to bytes
  const saltBytes = new Uint8Array(salt.length / 2);
  for (let i = 0; i < saltBytes.length; i++) {
    saltBytes[i] = parseInt(salt.slice(i * 2, i * 2 + 2), 16);
  }

  // Calculate H(salt, identityHash)
  const xHash = await H(saltBytes, identityHash);
  return hexToBigint(Array.from(xHash).map(b => b.toString(16).padStart(2, '0')).join(''));
}

/**
 * SRP Client class for authentication
 */
export class SRPClient {
  private username: string;
  private password: string;
  private a!: bigint;
  private A!: bigint;
  private salt!: string;
  private B!: bigint;
  private u!: bigint;
  private S!: bigint;
  private K!: Uint8Array;
  private M1!: string;

  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
  }

  /**
   * Generate salt and verifier for registration
   */
  static async generateSaltAndVerifier(username: string, password: string): Promise<{ salt: string; verifier: string }> {
    // Generate random salt (32 bytes = 64 hex chars)
    const saltBytes = new Uint8Array(32);
    crypto.getRandomValues(saltBytes);
    const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    // Calculate x = H(salt, H(username, password))
    const x = await calculateX(salt, username, password);

    // Calculate v = g^x mod N
    const verifier = modPow(SRP_GROUP_G, x, SRP_GROUP_N);
    const verifierHex = bigintToHex(verifier, 64);

    return { salt, verifier: verifierHex };
  }

  /**
   * Start SRP authentication - generate A
   */
  startAuthentication(): { A: string } {
    // Generate random private key 'a'
    this.a = generateRandomBigint(256);

    // Calculate public key A = g^a mod N
    this.A = modPow(SRP_GROUP_G, this.a, SRP_GROUP_N);

    return {
      A: bigintToHex(this.A, 64)
    };
  }

  /**
   * Process server challenge and calculate proof
   */
  async processChallenge(salt: string, B: string): Promise<{ clientProof: string }> {
    this.salt = salt;
    this.B = hexToBigint(B);

    // Validate B
    if (this.B % SRP_GROUP_N === 0n) {
      throw new Error('Invalid server public key');
    }

    // Calculate u = H(A, B)
    this.u = await calculateU(this.A, this.B);
    if (this.u === 0n) {
      throw new Error('Invalid u parameter');
    }

    // Calculate x = H(salt, H(username, password))
    const x = await calculateX(this.salt, this.username, this.password);

    // Calculate k = H(N, g)
    const k = calculateK();

    // Calculate S = (B - k * g^x)^(a + u * x) mod N
    const gx = modPow(SRP_GROUP_G, x, SRP_GROUP_N);
    const kgx = (k * gx) % SRP_GROUP_N;
    const bMinusKgx = (this.B - kgx + SRP_GROUP_N) % SRP_GROUP_N; // Ensure positive
    const au = (this.a + this.u * x) % SRP_GROUP_N;

    this.S = modPow(bMinusKgx, au, SRP_GROUP_N);

    // Calculate session key K = H(S)
    const sBytes = await H(this.S);
    this.K = sBytes;

    // Calculate client proof M1 = H(H(N) XOR H(g), H(username), salt, A, B, K) - RFC 5054 with server-compatible byte conversion
    const nBuffer = new Uint8Array(256);
    const nHex = SRP_GROUP_N.toString(16).padStart(512, '0'); // 256 bytes * 2 hex chars
    for (let i = 0; i < 256; i++) {
      nBuffer[i] = parseInt(nHex.slice(i * 2, i * 2 + 2), 16);
    }
    const nHash = await H(nBuffer);

    const gBuffer = new Uint8Array(256);
    const gHex = SRP_GROUP_G.toString(16).padStart(512, '0'); // 256 bytes * 2 hex chars
    for (let i = 0; i < 256; i++) {
      gBuffer[i] = parseInt(gHex.slice(i * 2, i * 2 + 2), 16);
    }
    const gHash = await H(gBuffer);

    const ngXor = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      ngXor[i] = nHash[i] ^ gHash[i];
    }

    const usernameHash = await H(this.username);

    const m1Hash = await H(ngXor, usernameHash, new Uint8Array(Buffer.from(this.salt, 'hex')), this.A, this.B, this.K);
    this.M1 = Array.from(m1Hash).map(b => b.toString(16).padStart(2, '0')).join('');

    return {
      clientProof: this.M1
    };
  }

  /**
   * Verify server proof
   */
  async verifyServerProof(serverProof: string): Promise<boolean> {
    // Calculate expected server proof M2 = H(A, M1, K)
    // A should be the raw 256-byte big-endian representation, not H(A)
    const aBytes = new Uint8Array(256);
    const aHex = this.A.toString(16).padStart(512, '0'); // 256 bytes * 2 hex chars
    for (let i = 0; i < 256; i++) {
      // Big-endian: most significant byte first
      const hexIndex = i * 2;
      aBytes[i] = parseInt(aHex.slice(hexIndex, hexIndex + 2), 16);
    }

    const m1Bytes = new Uint8Array(Buffer.from(this.M1, 'hex'));

    const expectedM2 = await H(aBytes, m1Bytes, this.K);
    const expectedM2Hex = Array.from(expectedM2).map(b => b.toString(16).padStart(2, '0')).join('');

    return serverProof === expectedM2Hex;
  }

  /**
   * Get session key for encryption
   */
  getSessionKey(): Uint8Array {
    return this.K;
  }
}

/**
 * Generate a random salt for SRP
 */
export function generateSRPSalt(): string {
  const saltBytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(saltBytes);
  } else {
    for (let i = 0; i < 32; i++) {
      saltBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate SRP verifier from password
 */
export async function generateSRPVerifier(username: string, password: string, salt: string): Promise<string> {
  const x = await calculateX(salt, username, password);
  const verifier = modPow(SRP_GROUP_G, x, SRP_GROUP_N);
  return bigintToHex(verifier, 64);
}