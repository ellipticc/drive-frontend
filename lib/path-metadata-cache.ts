// Path and metadata cache for decrypted paths and file metadata
// Uses in-memory Maps with TTL-based expiration

interface CachedPath {
  fullPath: string;
  timestamp: number;
  ttl: number;
}

interface CachedMetadata {
  metadata: any;
  timestamp: number;
  ttl: number;
}

class PathCache {
  private cache = new Map<string, CachedPath>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  // Generate cache key from file/folder ID and parent path
  private getCacheKey(id: string, parentPath?: string): string {
    return parentPath ? `${id}:${parentPath}` : id;
  }

  // Get cached full path
  get(id: string, parentPath?: string): string | null {
    const key = this.getCacheKey(id, parentPath);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.fullPath;
  }

  // Set cached full path
  set(id: string, fullPath: string, parentPath?: string, ttl?: number): void {
    const key = this.getCacheKey(id, parentPath);
    this.cache.set(key, {
      fullPath,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
  }

  // Clear entire cache (on logout)
  clear(): void {
    this.cache.clear();
  }

  // Remove specific entry
  delete(id: string, parentPath?: string): void {
    const key = this.getCacheKey(id, parentPath);
    this.cache.delete(key);
  }

  // Get cache size for monitoring
  size(): number {
    return this.cache.size;
  }

  // Clean expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

class MetadataCache {
  private cache = new Map<string, CachedMetadata>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  // Get cached metadata
  get(fileId: string): any | null {
    const entry = this.cache.get(fileId);

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(fileId);
      return null;
    }

    return entry.metadata;
  }

  // Set cached metadata
  set(fileId: string, metadata: any, ttl?: number): void {
    this.cache.set(fileId, {
      metadata,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
  }

  // Clear entire cache (on logout)
  clear(): void {
    this.cache.clear();
  }

  // Remove specific entry
  delete(fileId: string): void {
    this.cache.delete(fileId);
  }

  // Get cache size for monitoring
  size(): number {
    return this.cache.size;
  }

  // Clean expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instances
export const pathCache = new PathCache();
export const metadataCache = new MetadataCache();

// Periodic cleanup every 5 minutes
setInterval(() => {
  pathCache.cleanup();
  metadataCache.cleanup();
}, 5 * 60 * 1000);