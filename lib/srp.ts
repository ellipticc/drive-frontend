// SRP Constants - RFC 5054 3072-bit group parameters with backward compatibility
// Source: RFC 5054 Appendix A - https://tools.ietf.org/html/rfc5054#appendix-A
// These are well-documented, standardized safe-prime parameters for SRP-6a.
// Client-side operations are not vulnerable to realistic timing side-channels in browsers.
//
// Migration strategy: Client now uses RFC 5054 parameters for new authentications.
// Server must support both old and new parameters during transition period.
const SRP_GROUP_N = BigInt('0xFFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864D87602733EC86A64521F2B18177B200CBBE117577A615D6C770988C0BAD946E208E49FA680AB13CBB21303ECB4AABDD4C6D2D9BAE83B9F2D5A7E50D4F0DDBC4969BC9B5BEF0608028');
const SRP_GROUP_G = 5n;

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
      // Convert bigint to 384-byte buffer (big-endian) for RFC 5054 3072-bit parameters
      const hex = arg.toString(16).padStart(768, '0'); // 384 bytes * 2 hex chars
      const bytes = new Uint8Array(384);
      for (let i = 0; i < 384; i++) {
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
function bigintToHex(value: bigint, length: number = 96): string {
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
async function calculateU(A: bigint, B: bigint, bufferSize: number): Promise<bigint> {
  // Convert A and B to bytes with correct length
  const aBytes = new Uint8Array(bufferSize);
  const aHex = A.toString(16).padStart(bufferSize * 2, '0');
  for (let i = 0; i < bufferSize; i++) {
    aBytes[i] = parseInt(aHex.slice(i * 2, i * 2 + 2), 16);
  }

  const bBytes = new Uint8Array(bufferSize);
  const bHex = B.toString(16).padStart(bufferSize * 2, '0');
  for (let i = 0; i < bufferSize; i++) {
    bBytes[i] = parseInt(bHex.slice(i * 2, i * 2 + 2), 16);
  }

  const hash = await H(aBytes, bBytes);
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
  private N!: bigint;
  private G!: bigint;
  private bufferSize!: number;

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
    const verifierHex = bigintToHex(verifier, 96);

    return { salt, verifier: verifierHex };
  }

  /**
   * Get SRP parameters for a user (used before authentication)
   */
  static async getSRPParameters(email: string, apiBaseUrl: string = ''): Promise<{ params: 'legacy' | 'rfc5054' }> {
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/login/parameters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get SRP parameters: ${response.status}`);
    }

    const data = await response.json();
    return { params: data.srpParams };
  }

  /**
   * Start SRP authentication - generate A with appropriate parameters
   */
  async startAuthentication(apiBaseUrl: string = ''): Promise<{ A: string }> {
    // First get the SRP parameters for this user
    const paramsResponse = await SRPClient.getSRPParameters(this.username, apiBaseUrl);
    
    // Set parameters based on server response
    if (paramsResponse.params === 'legacy') {
      this.N = BigInt('0xAC6BDB41324A9A9BF166DE5E1389582FAF72B6651987EE07FC3192943DB56050A37329CBB4A099ED8193E0757767A13DD52312AB4B03310DCD7F48A9DA04FD50E8083969EDB767B0CF6095179A163AB3661A05FBD5FAAAE82918A9962F0B93B855F97993EC975EEAA80D740ADBF4FF747359D041D5C33EA71D281E446B14773BCA97B43A23FB801676BD207A436C6481F1D2B9078717461A5B9D32E688F87748544523B524B0D57D5EA77A2775D2ECFA032CFBDBF52FB3786160279004E57AE6AF874E7303CE53299CCC041C7BC308D82A5698F3A8D0C38271AE35F8E9DBFBB694B5C803D89F7AE435DE236D525F54759B65E372FCD68EF20FA7111F9E4AFF73');
      this.G = 2n;
      this.bufferSize = 256;
    } else {
      // RFC 5054 3072-bit parameters
      this.N = SRP_GROUP_N;
      this.G = SRP_GROUP_G;
      this.bufferSize = 384;
    }

    // Generate random private key 'a'
    this.a = generateRandomBigint(256);

    // Calculate public key A = g^a mod N
    this.A = modPow(this.G, this.a, this.N);

    return {
      A: bigintToHex(this.A, this.bufferSize)
    };
  }

  /**
   * Process server challenge and calculate proof
   */
  async processChallenge(salt: string, B: string): Promise<{ clientProof: string }> {
    this.salt = salt;
    this.B = hexToBigint(B);

    // Detect SRP parameters based on B length
    // 512 hex chars = 256 bytes = 2048-bit legacy parameters
    // 768 hex chars = 384 bytes = 3072-bit RFC 5054 parameters
    if (B.length === 512) {
      // Legacy 2048-bit parameters
      this.N = BigInt('0xAC6BDB41324A9A9BF166DE5E1389582FAF72B6651987EE07FC3192943DB56050A37329CBB4A099ED8193E0757767A13DD52312AB4B03310DCD7F48A9DA04FD50E8083969EDB767B0CF6095179A163AB3661A05FBD5FAAAE82918A9962F0B93B855F97993EC975EEAA80D740ADBF4FF747359D041D5C33EA71D281E446B14773BCA97B43A23FB801676BD207A436C6481F1D2B9078717461A5B9D32E688F87748544523B524B0D57D5EA77A2775D2ECFA032CFBDBF52FB3786160279004E57AE6AF874E7303CE53299CCC041C7BC308D82A5698F3A8D0C38271AE35F8E9DBFBB694B5C803D89F7AE435DE236D525F54759B65E372FCD68EF20FA7111F9E4AFF73');
      this.G = 2n;
      this.bufferSize = 256;
    } else {
      // RFC 5054 3072-bit parameters
      this.N = SRP_GROUP_N;
      this.G = SRP_GROUP_G;
      this.bufferSize = 384;
    }

    // Validate B
    if (this.B % this.N === 0n) {
      throw new Error('Invalid server public key');
    }

    // Calculate u = H(A, B)
    this.u = await calculateU(this.A, this.B, this.bufferSize);
    if (this.u === 0n) {
      throw new Error('Invalid u parameter');
    }

    // Calculate x = H(salt, H(username, password))
    const x = await calculateX(this.salt, this.username, this.password);

    // Calculate k = H(N, g)
    const k = calculateK();

    // Calculate S = (B - k * g^x)^(a + u * x) mod N
    const gx = modPow(this.G, x, this.N);
    const kgx = (k * gx) % this.N;
    const bMinusKgx = (this.B - kgx + this.N) % this.N; // Ensure positive
    const au = (this.a + this.u * x) % this.N;

    this.S = modPow(bMinusKgx, au, this.N);

    // Calculate session key K = H(S) - convert S to bytes with correct length
    const sBytes = new Uint8Array(this.bufferSize);
    const sHex = this.S.toString(16).padStart(this.bufferSize * 2, '0');
    for (let i = 0; i < this.bufferSize; i++) {
      sBytes[i] = parseInt(sHex.slice(i * 2, i * 2 + 2), 16);
    }
    this.K = await H(sBytes);

    // Calculate client proof M1 = H(H(N) XOR H(g), H(username), salt, A, B, K)
    const nBuffer = new Uint8Array(this.bufferSize);
    const nHex = this.N.toString(16).padStart(this.bufferSize * 2, '0');
    for (let i = 0; i < this.bufferSize; i++) {
      nBuffer[i] = parseInt(nHex.slice(i * 2, i * 2 + 2), 16);
    }
    const nHash = await H(nBuffer);

    const gBuffer = new Uint8Array(this.bufferSize);
    const gHex = this.G.toString(16).padStart(this.bufferSize * 2, '0');
    for (let i = 0; i < this.bufferSize; i++) {
      gBuffer[i] = parseInt(gHex.slice(i * 2, i * 2 + 2), 16);
    }
    const gHash = await H(gBuffer);

    const ngXor = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      ngXor[i] = nHash[i] ^ gHash[i];
    }

    const usernameHash = await H(this.username);

    // Convert A and B to bytes with correct length for hashing
    const aBytes = new Uint8Array(this.bufferSize);
    const aHex = this.A.toString(16).padStart(this.bufferSize * 2, '0');
    for (let i = 0; i < this.bufferSize; i++) {
      aBytes[i] = parseInt(aHex.slice(i * 2, i * 2 + 2), 16);
    }

    const bBytes = new Uint8Array(this.bufferSize);
    const bHex = this.B.toString(16).padStart(this.bufferSize * 2, '0');
    for (let i = 0; i < this.bufferSize; i++) {
      bBytes[i] = parseInt(bHex.slice(i * 2, i * 2 + 2), 16);
    }

    const m1Hash = await H(ngXor, usernameHash, new Uint8Array(Buffer.from(this.salt, 'hex')), aBytes, bBytes, this.K);
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
    // A should be the raw big-endian representation matching the buffer size
    const aBytes = new Uint8Array(this.bufferSize);
    const aHex = this.A.toString(16).padStart(this.bufferSize * 2, '0');
    for (let i = 0; i < this.bufferSize; i++) {
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
  return bigintToHex(verifier, 96);
}