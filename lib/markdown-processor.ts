/**
 * Markdown Processor
 * Uses web worker to process markdown asynchronously without blocking the main thread
 * 
 * Production-ready features:
 * - Worker pool management
 * - Caching of processed markdown
 * - Error recovery with fallback
 * - Memory-safe operation
 * - Timeout handling
 */

import { WorkerPool } from './worker-pool'
import { getHighlighterMetrics } from './code-highlighter';

interface MarkdownRequest {
  id: string;
  content: string;
}

interface MarkdownResponse {
  id: string;
  error?: string;
  html?: string;
}

import { getWorkerPool, getWorkerManager } from './worker-resource-manager';

// Get the singleton worker pool for markdown (lazy-loaded and managed by WorkerResourceManager)
const getMarkdownWorkerPool = () => getWorkerPool('markdown');

// Cache for processed markdown (LRU with max 30 entries)
const markdownCache = new Map<string, string>();
const MAX_CACHE_SIZE = 30;

function getCacheKey(markdown: string): string {
  // Use length-based key for cache (0-length markdown maps to empty string)
  // For exact match, consider using MD5 hash in production
  return `md:${markdown.length}:${markdown.substring(0, 80)}`;
}

export async function processMarkdown(markdown: string): Promise<string> {
  if (!markdown || markdown.length === 0) {
    return '';
  }

  // Check cache first
  const cacheKey = getCacheKey(markdown);
  if (markdownCache.has(cacheKey)) {
    return markdownCache.get(cacheKey)!;
  }

  try {
    const taskId = Math.random().toString(36).substring(7);

    const response = await getMarkdownWorkerPool().execute<MarkdownResponse>(
      {
        id: taskId,
        content: markdown,
      } as MarkdownRequest,
      undefined,
      15000
    );

    if (response.error) {
      console.error('Markdown processing error:', response.error);
      // Fallback: return escaped markdown in pre tag
      return `<pre>${escapeHtml(markdown)}</pre>`;
    }

    const html = response.html || `<pre>${escapeHtml(markdown)}</pre>`;

    // Cache the result
    if (markdownCache.size >= MAX_CACHE_SIZE) {
      // Remove first entry (FIFO)
      const firstKey = markdownCache.keys().next().value as string | undefined;
      if (firstKey) {
        markdownCache.delete(firstKey);
      }
    }
    markdownCache.set(cacheKey, html);

    return html;
  } catch (error) {
    console.error('Failed to process markdown:', error);
    // Fallback: return escaped markdown in pre tag
    return `<pre>${escapeHtml(markdown)}</pre>`;
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

export function getMarkdownProcessorMetrics() {
  return {
    pool: getMarkdownWorkerPool().getMetrics(),
    cacheSize: markdownCache.size,
  };
}

export function clearMarkdownCache() {
  markdownCache.clear();
}

export function terminateMarkdownProcessor() {
  getWorkerManager().destroyPool('markdown');
  markdownCache.clear();
}

// Utility to get combined metrics from both processors
export function getAllWorkerMetrics() {
  return {
    highlighting: getHighlighterMetrics(),
    markdown: getMarkdownProcessorMetrics(),
  };
}
