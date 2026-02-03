// Filename cache for decrypted file/folder names
// Uses in-memory Map with TTL-based expiration and smart invalidation

interface CachedFilename {
  decryptedName: string;
  timestamp: number;
  ttl: number;
}

class FilenameCache {
  private cache = new Map<string, CachedFilename>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  // Generate cache key from encrypted name and salt
  private getCacheKey(encryptedName: string, salt: string): string {
    return `${encryptedName}:${salt}`;
  }

  // Get cached decrypted filename
  get(encryptedName: string, salt: string): string | null {
    const key = this.getCacheKey(encryptedName, salt);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.decryptedName;
  }

  // Set cached decrypted filename
  set(encryptedName: string, salt: string, decryptedName: string, ttl?: number): void {
    const key = this.getCacheKey(encryptedName, salt);
    this.cache.set(key, {
      decryptedName,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
  }

  // Clear entire cache (on logout)
  clear(): void {
    this.cache.clear();
  }

  // Remove specific entry
  delete(encryptedName: string, salt: string): void {
    const key = this.getCacheKey(encryptedName, salt);
    this.cache.delete(key);
  }

  // Get cache size for monitoring
  size(): number {
    return this.cache.size;
  }

  // Clean expired entries (called periodically)
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Global filename cache instance
export const filenameCache = new FilenameCache();

// Periodic cleanup every 5 minutes
setInterval(() => {
  filenameCache.cleanup();
}, 5 * 60 * 1000);