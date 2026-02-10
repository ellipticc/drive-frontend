/**
 * Markdown Processing Web Worker
 * Offloads markdown parsing from main thread using remark/rehype pipeline
 * Handles: AST parsing, HTML compilation, plugin execution
 */

interface MarkdownRequest {
  id: string;
  content: string;
}

interface MarkdownResponse {
  id: string;
  error?: string;
  html?: string;
}

// Markdown processor instance (lazy loaded)
let processor: any = null;
let processorInitPromise: Promise<any> | null = null;

// Initialize remark/rehype processor
async function initializeProcessor() {
  if (processor) return processor;
  if (processorInitPromise) return processorInitPromise;

  processorInitPromise = (async () => {
    try {
      const { unified } = await import('unified');
      const remarkParse = await import('remark-parse').then((m: any) => m.default);
      const remarkGfm = await import('remark-gfm').then((m: any) => m.default);
      const remarkRehype = await import('remark-rehype').then((m: any) => m.default);
      const rehypeSanitize = await import('rehype-sanitize').then((m: any) => m.default);
      const rehypeStringify = await import('rehype-stringify').then((m: any) => m.default);

      processor = unified()
        .use(remarkParse)
        .use(remarkGfm) // GitHub Flavored Markdown support
        .use(remarkRehype) // Convert markdown AST to HTML AST
        .use(rehypeSanitize) // Sanitize HTML for security
        .use(rehypeStringify); // Stringify HTML AST

      return processor;
    } catch (error) {
      console.error('Failed to initialize markdown processor:', error);
      throw error;
    }
  })();

  return processorInitPromise;
}

// Process markdown to HTML with proper error handling
async function markdownToHtml(markdown: string): Promise<string> {
  try {
    const p = await initializeProcessor();
    
    // Limit input size to prevent memory issues (2MB max)
    if (markdown.length > 2 * 1024 * 1024) {
      throw new Error('Markdown content exceeds 2MB limit');
    }

    const html = String(await p.process(markdown));
    return html;
  } catch (error) {
    console.error('Markdown processing failed:', error);
    // Fallback: escape and wrap in pre tag
    return `<pre>${escapeHtml(markdown)}</pre>`;
  }
}

// Escape HTML for fallback rendering
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
self.onmessage = async (event: MessageEvent<MarkdownRequest>) => {
  const { id, content } = event.data;

  try {
    if (!content || content.length === 0) {
      const response: MarkdownResponse = { id, html: '' };
      self.postMessage(response);
      return;
    }

    const html = await markdownToHtml(content);
    const response: MarkdownResponse = { id, html };
    self.postMessage(response);
  } catch (error) {
    const response: MarkdownResponse = {
      id,
      error: error instanceof Error ? error.message : 'Unknown markdown processing error',
      html: `<pre>${escapeHtml(content)}</pre>`, // Fallback
    };
    self.postMessage(response);
  }
};

export {};
