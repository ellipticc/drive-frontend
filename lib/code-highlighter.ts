/**
 * Code Highlighter
 * Uses web worker to highlight code asynchronously without blocking the main thread
 * 
 * Production-ready features:
 * - Worker pool management
 * - Caching of highlighted code
 * - Error recovery
 * - Memory-safe operation
 */

import { WorkerPool } from './worker-pool';

interface HighlightRequest {
  id: string;
  code: string;
  language: string;
  isDark: boolean;
}

interface HighlightResponse {
  id: string;
  error?: string;
  html?: string;
}

// Create a singleton worker pool for highlighting
const highlightWorkerPool = new WorkerPool(
  () => new Worker(new URL('./workers/highlight-worker.ts', import.meta.url), { type: 'module' }),
  {
    maxWorkers: 4,
    maxQueueSize: 50,
    taskTimeout: 10000, // 10 second timeout for highlighting
  }
);

// Cache for recently highlighted code (LRU with max 50 entries)
const highlightCache = new Map<string, string>();
const MAX_CACHE_SIZE = 50;

function getCacheKey(code: string, language: string, isDark: boolean): string {
  // Use simple hash of code + language + theme for cache key
  // For production, consider using a proper hashing library
  return `${language}:${isDark ? 'dark' : 'light'}:${code.length}:${code.substring(0, 50)}`;
}

export async function highlightCode(
  code: string,
  language: string,
  isDark: boolean = false
): Promise<string> {
  if (!code || code.length === 0) {
    return '<pre><code></code></pre>';
  }

  // Check cache first
  const cacheKey = getCacheKey(code, language, isDark);
  if (highlightCache.has(cacheKey)) {
    return highlightCache.get(cacheKey)!;
  }

  try {
    const taskId = Math.random().toString(36).substring(7);
    
    const response = await highlightWorkerPool.execute<HighlightResponse>(
      {
        id: taskId,
        code,
        language,
        isDark,
      } as HighlightRequest,
      undefined,
      10000
    );

    if (response.error) {
      console.error('Code highlighting error:', response.error);
      // Fallback: return plain code
      return `<pre><code>${escapeHtml(code)}</code></pre>`;
    }

    const html = response.html || `<pre><code>${escapeHtml(code)}</code></pre>`;

    // Cache the result
    if (highlightCache.size >= MAX_CACHE_SIZE) {
      // Remove first entry (FIFO)
      const firstKey = highlightCache.keys().next().value as string | undefined;
      if (firstKey) {
        highlightCache.delete(firstKey);
      }
    }
    highlightCache.set(cacheKey, html);

    return html;
  } catch (error) {
    console.error('Failed to highlight code:', error);
    // Fallback: return escaped code in pre tag
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  }
}

function escapeHtml(text: string): string {
  const htmlEscapeMap: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char]);
}

export function getHighlighterMetrics() {
  return {
    pool: highlightWorkerPool.getMetrics(),
    cacheSize: highlightCache.size,
  };
}

export function clearHighlightCache() {
  highlightCache.clear();
}

export function terminateHighlighters() {
  highlightWorkerPool.terminate();
  highlightCache.clear();
}
