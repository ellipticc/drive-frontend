// @ts-nocheck
/**
 * Shiki Syntax Highlighter Utilities
 * 
 * Lazy-loads and caches Shiki instance globally.
 * Provides theme-aware syntax highlighting for code blocks.
 * Supports all Shiki languages and both light/dark themes.
 */

// Shiki module (lazy-loaded on first use)
let _shikiModule: any = null;
let _shikiPromise: Promise<any> | null = null;

/**
 * Lazy-load Shiki module once
 * All subsequent calls return the same cached instance
 */
async function getShiki(): Promise<any> {
  // Already loaded
  if (_shikiModule) {
    return _shikiModule;
  }

  // Currently loading - return existing promise
  if (_shikiPromise) {
    return _shikiPromise;
  }

  // Start loading
  _shikiPromise = (async () => {
    try {
      const shiki = await import('shiki') as any;
      _shikiModule = shiki;
      return shiki;
    } catch (error) {
      console.error('Failed to load Shiki:', error);
      throw error;
    }
  })();

  return _shikiPromise;
}

/**
 * Map Tailwind theme to Shiki theme
 */
function mapToShikiTheme(isDark: boolean): string {
  return isDark ? 'github-dark' : 'github-light';
}

/**
 * Highlight code with Shiki
 */
export async function highlightCode(
  code: string,
  language: string = 'plain',
  isDark: boolean = false
): Promise<string> {
  try {
    const shiki = await getShiki();
    const theme = mapToShikiTheme(isDark);

    // Shiki v1.29+ provides codeToHtml as a direct export
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = await (shiki as any).codeToHtml(code, {
      lang: language || 'plain',
      theme,
    });

    return html;
  } catch (error) {
    console.error(`Failed to highlight code (${language}):`, error);
    // Return plain code as fallback
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  }
}

/**
 * Prefetch Shiki (useful for warming up before rendering messages)
 */
export async function prefetchHighlighter(): Promise<void> {
  try {
    await getShiki();
  } catch (error) {
    console.warn('Failed to prefetch Shiki:', error);
  }
}

/**
 * Check if Shiki is ready
 */
export function isHighlighterReady(): boolean {
  return _shikiModule !== null;
}

/**
 * Get current Shiki module if available
 */
export function getHighlighterIfReady(): any {
  return _shikiModule;
}

/**
 * Simple HTML escape
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
