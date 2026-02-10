/**
 * Syntax Highlighting Web Worker
 * Offloads Shiki syntax highlighting from main thread
 * Handles: async code highlighting, theme-aware coloring, language detection
 */

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

// Shiki highlighter instance (lazy loaded)
let highlighter: any = null;
let highlighterInitPromise: Promise<any> | null = null;

// Initialize Shiki highlighter
async function initializeHighlighter() {
  if (highlighter) return highlighter;
  if (highlighterInitPromise) return highlighterInitPromise;

  highlighterInitPromise = (async () => {
    try {
      const { getHighlighter } = await import('shiki');
      highlighter = await getHighlighter({
        themes: ['nord', 'github-light'],
        langs: [
          'javascript', 'typescript', 'jsx', 'tsx', 'python', 'java', 'cpp', 'c',
          'csharp', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala',
          'html', 'css', 'scss', 'less', 'xml', 'json', 'yaml', 'toml',
          'bash', 'shell', 'sh', 'zsh', 'fish', 'powershell',
          'sql', 'mysql', 'postgresql', 'mongodb',
          'groovy', 'gradle', 'maven', 'cmake', 'makefile',
          'diff', 'patch', 'markdown', 'latex', 'tex',
          'lisp', 'scheme', 'clojure', 'erlang', 'elixir',
          'ocaml', 'haskell', 'fsharp', 'perl', 'r', 'lua',
          'vim', 'dockerfile', 'regex', 'graphql', 'vue', 'svelte',
        ],
      });
      return highlighter;
    } catch (error) {
      console.error('Failed to initialize Shiki:', error);
      throw error;
    }
  })();

  return highlighterInitPromise;
}

// Highlight code with proper error handling
async function highlightCode(code: string, language: string, isDark: boolean): Promise<string> {
  try {
    const h = await initializeHighlighter();
    
    // Normalize language name
    const normalizedLang = normalizeLanguage(language);
    
    // Check if language is supported
    const supportedLangs = h.getLoadedLanguages();
    const langToUse = supportedLangs.includes(normalizedLang) ? normalizedLang : 'txt';
    
    // Highlight with appropriate theme
    const theme = isDark ? 'nord' : 'github-light';
    const html = h.codeToHtml(code, { lang: langToUse, theme });
    
    return html;
  } catch (error) {
    console.error(`Highlighting failed for ${language}:`, error);
    // Fallback: return escaped code in a pre tag
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  }
}

// Normalize language names for Shiki compatibility
function normalizeLanguage(lang: string): string {
  if (!lang) return 'txt';
  
  const normalized = lang.toLowerCase().trim();
  const langMap: { [key: string]: string } = {
    'js': 'javascript',
    'mjs': 'javascript',
    'cjs': 'javascript',
    'ts': 'typescript',
    'mts': 'typescript',
    'cts': 'typescript',
    'py': 'python',
    'py3': 'python',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'c++': 'cpp',
    'c': 'c',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'php': 'php',
    'php3': 'php',
    'php4': 'php',
    'php5': 'php',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'zsh',
    'fish': 'fish',
    'ps1': 'powershell',
    'sql': 'sql',
    'html': 'html',
    'htm': 'html',
    'xml': 'xml',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'json': 'json',
    'jsonc': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'md': 'markdown',
    'markdown': 'markdown',
    'tex': 'latex',
    'latex': 'latex',
  };
  
  return langMap[normalized] || normalized;
}

// Utility to escape HTML entities
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

// Main message handler
self.onmessage = async (event: MessageEvent<HighlightRequest>) => {
  const { id, code, language, isDark } = event.data;

  try {
    if (!code || code.length === 0) {
      const response: HighlightResponse = { id, html: '<pre><code></code></pre>' };
      self.postMessage(response);
      return;
    }

    // Limit code size to prevent memory issues (1MB max)
    if (code.length > 1024 * 1024) {
      throw new Error('Code size exceeds 1MB limit');
    }

    const html = await highlightCode(code, language, isDark);
    const response: HighlightResponse = { id, html };
    self.postMessage(response);
  } catch (error) {
    const response: HighlightResponse = {
      id,
      error: error instanceof Error ? error.message : 'Unknown highlighting error',
      html: `<pre><code>${escapeHtml(code)}</code></pre>`, // Fallback
    };
    self.postMessage(response);
  }
};

export {};
