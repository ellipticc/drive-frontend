// Cache manager for coordinating cache invalidation across all caches
// Clears all caches on logout and provides cache monitoring

import { filenameCache } from './filename-cache';
import { pathCache, metadataCache } from './path-metadata-cache';

class CacheManager {
  // Clear all caches (called on logout)
  clearAllCaches(): void {
    filenameCache.clear();
    pathCache.clear();
    metadataCache.clear();

    // Clear thumbnail cache (global function from file-thumbnail.tsx)
    if (typeof window !== 'undefined') {
      const clearThumbnailCache = (window as any).clearThumbnailCache;
      if (typeof clearThumbnailCache === 'function') {
        clearThumbnailCache();
      }
    }
  }

  // Get cache statistics for monitoring
  getCacheStats(): {
    filename: number;
    path: number;
    metadata: number;
    thumbnail: number;
  } {
    let thumbnailSize = 0;
    if (typeof window !== 'undefined') {
      const getThumbnailCacheSize = (window as any).getThumbnailCacheSize;
      if (typeof getThumbnailCacheSize === 'function') {
        thumbnailSize = getThumbnailCacheSize();
      }
    }

    return {
      filename: filenameCache.size(),
      path: pathCache.size(),
      metadata: metadataCache.size(),
      thumbnail: thumbnailSize
    };
  }

  // Force cleanup of expired entries
  cleanupExpired(): void {
    filenameCache.cleanup();
    pathCache.cleanup();
    metadataCache.cleanup();
  }
}

export const cacheManager = new CacheManager();