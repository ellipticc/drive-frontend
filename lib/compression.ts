/**
 * Compression Utility Module
 * 
 * Implements intelligent per-file compression with fallback strategies:
 * 1. Native CompressionStream('zstd') when available
 * 2. zstd-wasm fallback for WASM support
 * 3. fflate (gzip) as final fallback
 * 
 * Only compresses when savings > 8-10% (configurable ratio threshold of 0.92)
 * Uses 512KB test sample for compressibility detection per file
 */

import { compress as fflateCompress, decompress as fflateDecompress } from 'fflate';

export enum CompressionAlgorithm {
  NONE = 'none',
  NATIVE_ZSTD = 'native-zstd',
  ZSTD_WASM = 'zstd-wasm',
  GZIP = 'gzip'
}

export interface CompressionResult {
  isCompressed: boolean;
  algorithm: CompressionAlgorithm;
  originalSize: number;
  compressedSize: number;
  ratio: number; // compressedSize / originalSize
  data: Uint8Array;
}

export interface CompressionMetadata {
  isCompressed: boolean;
  algorithm: CompressionAlgorithm;
  originalSize: number;
  compressedSize: number;
  ratio: number;
}

// Configuration
const MIN_COMPRESSION_THRESHOLD = 0.92; // Only compress if ratio < 0.92 (8%+ savings)
const COMPRESSIBILITY_TEST_SIZE = 512 * 1024; // 512KB sample for testing
const zstdWasm: any = null;
let zstdWasmLoaded = false;
let zstdWasmError: Error | null = null;

/**
 * Load zstd-wasm if available (placeholder for future zstd-wasm support)
 * Currently falls back to fflate as zstd-wasm is not in dependencies
 */
async function loadZstdWasm(): Promise<boolean> {
  if (zstdWasmLoaded) {
    return zstdWasm !== null;
  }

  try {
    // TODO: Add zstd-wasm package when available
    // For now, we'll rely on native CompressionStream or fflate
    zstdWasmLoaded = true;
    zstdWasmError = new Error('zstd-wasm not installed in dependencies');
    console.warn('zstd-wasm not available, will use native CompressionStream or fflate:', zstdWasmError.message);
    return false;
  } catch (error) {
    zstdWasmLoaded = true;
    zstdWasmError = error instanceof Error ? error : new Error(String(error));
    console.warn('zstd-wasm not available, will use fflate fallback:', zstdWasmError.message);
    return false;
  }
}

/**
 * Test compressibility of a chunk using a sample
 * Takes first 512KB of chunk to determine if compression is worthwhile
 */
async function testCompressibility(data: Uint8Array, targetAlgorithm: CompressionAlgorithm): Promise<CompressionMetadata> {
  const testSize = Math.min(data.length, COMPRESSIBILITY_TEST_SIZE);
  const testData = data.slice(0, testSize);

  try {
    let compressedTest: Uint8Array;
    let algorithm = targetAlgorithm;

    // Try target algorithm first
    if (targetAlgorithm === CompressionAlgorithm.NATIVE_ZSTD && hasNativeCompressionStream()) {
      compressedTest = await compressWithNativeZstd(testData);
    } else if (targetAlgorithm === CompressionAlgorithm.ZSTD_WASM && zstdWasm) {
      compressedTest = compressWithZstdWasm(testData);
    } else {
      // Fallback to gzip
      compressedTest = await compressWithGzip(testData);
      algorithm = CompressionAlgorithm.GZIP;
    }

    const ratio = compressedTest.length / testData.length;
    const shouldCompress = ratio < MIN_COMPRESSION_THRESHOLD;

    return {
      isCompressed: shouldCompress,
      algorithm: shouldCompress ? algorithm : CompressionAlgorithm.NONE,
      originalSize: data.length,
      compressedSize: 0, // Will be set after full compression
      ratio: shouldCompress ? ratio : 1.0
    };
  } catch (error) {
    console.warn('Compressibility test failed:', error);
    return {
      isCompressed: false,
      algorithm: CompressionAlgorithm.NONE,
      originalSize: data.length,
      compressedSize: 0,
      ratio: 1.0
    };
  }
}

/**
 * Check if native CompressionStream with zstd is available
 */
function hasNativeCompressionStream(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    // Test if CompressionStream exists and supports zstd
    const CompressionStreamClass = (window as any).CompressionStream;
    if (CompressionStreamClass) {
      const testStream = new CompressionStreamClass('zstd');
      if (testStream) {
        return true;
      }
    }
  } catch (error) {
    // zstd not supported
  }

  return false;
}

/**
 * Compress using native CompressionStream (zstd)
 */
async function compressWithNativeZstd(data: Uint8Array): Promise<Uint8Array> {
  try {
    const stream = new (window as any).CompressionStream('zstd');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    await writer.write(data);
    await writer.close();

    const chunks: Uint8Array[] = [];
    let result;

    while (!result || !result.done) {
      result = await reader.read();
      if (result.value) {
        chunks.push(new Uint8Array(result.value));
      }
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const compressed = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      compressed.set(chunk, offset);
      offset += chunk.length;
    }

    return compressed;
  } catch (error) {
    throw new Error(`Native zstd compression failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Compress using zstd-wasm
 */
function compressWithZstdWasm(data: Uint8Array): Uint8Array {
  if (!zstdWasm) {
    throw new Error('zstd-wasm not loaded');
  }

  try {
    const compressed = zstdWasm.compress(data, 3); // Compression level 3 (balanced speed/ratio)
    return new Uint8Array(compressed);
  } catch (error) {
    throw new Error(`zstd-wasm compression failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Compress using fflate (gzip fallback)
 */
async function compressWithGzip(data: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    fflateCompress(data, (error, compressed) => {
      if (error) {
        reject(new Error(`gzip compression failed: ${error.message}`));
      } else {
        resolve(new Uint8Array(compressed));
      }
    });
  });
}

/**
 * Decompress using native DecompressionStream (zstd)
 */
async function decompressWithNativeZstd(data: Uint8Array): Promise<Uint8Array> {
  try {
    const stream = new (window as any).DecompressionStream('zstd');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    await writer.write(data);
    await writer.close();

    const chunks: Uint8Array[] = [];
    let result;

    while (!result || !result.done) {
      result = await reader.read();
      if (result.value) {
        chunks.push(new Uint8Array(result.value));
      }
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const decompressed = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      decompressed.set(chunk, offset);
      offset += chunk.length;
    }

    return decompressed;
  } catch (error) {
    throw new Error(`Native zstd decompression failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decompress using zstd-wasm
 */
function decompressWithZstdWasm(data: Uint8Array): Uint8Array {
  if (!zstdWasm) {
    throw new Error('zstd-wasm not loaded');
  }

  try {
    const decompressed = zstdWasm.decompress(data);
    return new Uint8Array(decompressed);
  } catch (error) {
    throw new Error(`zstd-wasm decompression failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decompress using fflate (gzip fallback)
 */
async function decompressWithGzip(data: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    fflateDecompress(data, (error, decompressed) => {
      if (error) {
        reject(new Error(`gzip decompression failed: ${error.message}`));
      } else {
        resolve(new Uint8Array(decompressed));
      }
    });
  });
}

/**
 * Main compression function
 * Tests compressibility, then compresses if beneficial
 */
export async function compressChunk(data: Uint8Array): Promise<CompressionResult> {
  try {
    // Determine best available algorithm
    let targetAlgorithm = CompressionAlgorithm.GZIP;

    if (hasNativeCompressionStream()) {
      targetAlgorithm = CompressionAlgorithm.NATIVE_ZSTD;
    } else if (zstdWasm || (await loadZstdWasm())) {
      targetAlgorithm = CompressionAlgorithm.ZSTD_WASM;
    }

    // Test compressibility
    const metadata = await testCompressibility(data, targetAlgorithm);

    if (!metadata.isCompressed) {
      // Not worth compressing
      return {
        isCompressed: false,
        algorithm: CompressionAlgorithm.NONE,
        originalSize: data.length,
        compressedSize: data.length,
        ratio: 1.0,
        data
      };
    }

    // Compress the full chunk
    let compressedData: Uint8Array;
    let algorithm = metadata.algorithm;

    if (metadata.algorithm === CompressionAlgorithm.NATIVE_ZSTD) {
      compressedData = await compressWithNativeZstd(data);
    } else if (metadata.algorithm === CompressionAlgorithm.ZSTD_WASM) {
      compressedData = compressWithZstdWasm(data);
    } else {
      compressedData = await compressWithGzip(data);
      algorithm = CompressionAlgorithm.GZIP;
    }

    const ratio = compressedData.length / data.length;
    const actualSavings = (1 - ratio) * 100;

    return {
      isCompressed: true,
      algorithm,
      originalSize: data.length,
      compressedSize: compressedData.length,
      ratio,
      data: compressedData
    };
  } catch (error) {
    console.error('Compression failed, skipping:', error);
    return {
      isCompressed: false,
      algorithm: CompressionAlgorithm.NONE,
      originalSize: data.length,
      compressedSize: data.length,
      ratio: 1.0,
      data
    };
  }
}

/**
 * Decompress chunk based on algorithm
 */
export async function decompressChunk(
  data: Uint8Array,
  algorithm: CompressionAlgorithm
): Promise<Uint8Array> {
  if (algorithm === CompressionAlgorithm.NONE) {
    return data;
  }

  try {
    if (algorithm === CompressionAlgorithm.NATIVE_ZSTD) {
      return await decompressWithNativeZstd(data);
    } else if (algorithm === CompressionAlgorithm.ZSTD_WASM) {
      // Ensure zstd-wasm is loaded
      if (!zstdWasm && !(await loadZstdWasm())) {
        throw new Error('zstd-wasm not available for decompression');
      }
      return decompressWithZstdWasm(data);
    } else if (algorithm === CompressionAlgorithm.GZIP) {
      return await decompressWithGzip(data);
    } else {
      throw new Error(`Unknown compression algorithm: ${algorithm}`);
    }
  } catch (error) {
    console.error(`Decompression failed for ${algorithm}:`, error);
    throw error;
  }
}

/**
 * Initialize compression module (preload zstd-wasm if available)
 */
export async function initializeCompression(): Promise<void> {
  try {
    await loadZstdWasm();
  } catch (error) {
    console.warn('Compression module initialization warning:', error);
  }
}

/**
 * Get compression algorithm information
 */
export function getCompressionInfo(): {
  nativeZstd: boolean;
  zstdWasm: boolean;
  gzip: boolean;
  preferredAlgorithm: CompressionAlgorithm;
} {
  const nativeZstd = hasNativeCompressionStream();
  const preferredAlgorithm = nativeZstd
    ? CompressionAlgorithm.NATIVE_ZSTD
    : zstdWasm
    ? CompressionAlgorithm.ZSTD_WASM
    : CompressionAlgorithm.GZIP;

  return {
    nativeZstd,
    zstdWasm: zstdWasm !== null || (zstdWasmError === null && !zstdWasmLoaded),
    gzip: true,
    preferredAlgorithm
  };
}
