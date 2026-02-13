'use client';

import * as React from 'react';

import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';

import { MarkdownPlugin } from '@platejs/markdown';
import { ArrowDownToLineIcon } from 'lucide-react';
import { createSlateEditor } from 'platejs';
import { useEditorRef } from 'platejs/react';
import { serializeHtml } from 'platejs/static';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BaseEditorKit } from '@/components/editor-base-kit';
import { useUser } from '@/components/user-context';
import { useTheme } from 'next-themes';

import { EditorStatic } from './editor-static';
import { ToolbarButton } from './toolbar';

const siteUrl = 'https://platejs.org';

import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
// @ts-ignore - no type definitions available
import htmlDocx from 'html-docx-js/dist/html-docx';

export function ExportToolbarButton(props: DropdownMenuProps) {
  const { fileId } = useParams();
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);
  const { user } = useUser();
  const { resolvedTheme } = useTheme();

  const getCanvas = async () => {
    const { default: html2canvas } = await import('html2canvas-pro');

    const style = document.createElement('style');
    document.head.append(style);

    // Check if we're in dark mode - apply light theme ONLY to cloned document
    const isDark = resolvedTheme === 'dark';
    const editorElement = editor.api.toDOMNode(editor)!;

    const canvas = await html2canvas(editorElement, {
      backgroundColor: '#ffffff', // Force white background for PDF
      onclone: (clonedDocument: Document) => {
        // Remove dark class from cloned document only (user never sees this)
        if (isDark) {
          clonedDocument.documentElement.classList.remove('dark');
        }

        const editorElement = clonedDocument.querySelector(
          '[contenteditable="true"]'
        );
        if (editorElement) {
          // Apply light theme styles to cloned elements for readable PDF export
          Array.from(editorElement.querySelectorAll('*')).forEach((element) => {
            const existingStyle = element.getAttribute('style') || '';
            element.setAttribute(
              'style',
              `${existingStyle}; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important; color: #000000 !important`
            );
          });
        }
      },
    });

    style.remove();

    return canvas;
  };

  const downloadFile = async (url: string, filename: string) => {
    const response = await fetch(url);

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();

    // Clean up the blob URL
    window.URL.revokeObjectURL(blobUrl);
  };

  const getExportFilename = (extension: string) => {
    // Try to get title from document title (set in page.tsx) or fallback to timestamp
    let name = document.title || `Untitled paper ${new Date().toISOString().replace(/[:.]/g, '-')}`;
    // Clean up filename
    name = name.replace(/[^a-z0-9\s-_]/gi, '').trim();
    return `${name}.${extension}`;
  };

  const triggerSnapshot = async () => {
    if (fileId && typeof fileId === 'string') {
      try {
        // Trigger backend snapshot with 'export' type
        await apiClient.savePaperVersion(fileId, false, 'export');
      } catch (e) {
        console.error('Failed to trigger export snapshot', e);
      }
    }
  };

  const processMediaForExport = async (html: string) => {
    if (typeof window === 'undefined') return html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const images = Array.from(doc.querySelectorAll('img'));
    const videos = Array.from(doc.querySelectorAll('video'));
    const audios = Array.from(doc.querySelectorAll('audio'));

    // Process images: convert to Data URL for PDF/Word compatibility
    await Promise.all(
      images.map(async (img) => {
        try {
          const src = img.getAttribute('src');
          if (!src) return;

          let dataUrl = src;

          // If it's not a data URL, fetch it
          if (!src.startsWith('data:')) {
            const absoluteSrc = src.startsWith('/') ? `${window.location.origin}${src}` : src;
            const response = await fetch(absoluteSrc);
            const blob = await response.blob();
            dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          }

          // Convert SVG/WebP to PNG for max compatibility with PDF/Word
          const isSvg = dataUrl.includes('image/svg+xml') || src.toLowerCase().endsWith('.svg');
          const isWebp = dataUrl.includes('image/webp') || src.toLowerCase().endsWith('.webp');

          if (isSvg || isWebp) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const imgElement = new Image();

            await new Promise((resolve, reject) => {
              imgElement.onload = resolve;
              imgElement.onerror = reject;
              imgElement.src = dataUrl;
            });

            canvas.width = imgElement.naturalWidth || 800;
            canvas.height = imgElement.naturalHeight || 600;

            if (ctx) {
              ctx.fillStyle = 'white';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
              dataUrl = canvas.toDataURL('image/png');
            }
          }

          img.setAttribute('src', dataUrl);

          const finalImg = new Image();
          finalImg.src = dataUrl;
          await new Promise((resolve) => {
            finalImg.onload = resolve;
            finalImg.onerror = resolve;
          });

          if (finalImg.width) {
            const maxWidth = 500;
            const width = Math.min(finalImg.width, maxWidth);
            const height = Math.round((width / finalImg.width) * finalImg.height);
            img.setAttribute('width', width.toString());
            img.setAttribute('height', height.toString());
          }
        } catch (e) {
          console.warn('Failed to process image for export:', e);
        }
      })
    );

    // Process videos/audios: Replace with a placeholder and direct link
    const processMediaPlaceholder = (el: HTMLElement, type: 'Video' | 'Audio') => {
      const src = el.getAttribute('src') || el.querySelector('source')?.getAttribute('src');
      const placeholder = doc.createElement('div');
      placeholder.setAttribute('style', 'padding: 12px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 8px; margin: 12px 0; font-family: sans-serif;');

      const title = doc.createElement('div');
      title.innerText = `${type} Content`;
      title.setAttribute('style', 'font-weight: bold; margin-bottom: 4px; color: #1e293b;');

      const link = doc.createElement('a');
      link.setAttribute('href', src || '#');
      link.innerText = src ? `View original ${type.toLowerCase()}` : `Link not available`;
      link.setAttribute('style', 'color: #2563eb; text-decoration: underline; font-size: 14px;');

      placeholder.appendChild(title);
      placeholder.appendChild(link);
      el.parentNode?.replaceChild(placeholder, el);
    };

    videos.forEach(v => processMediaPlaceholder(v, 'Video'));
    audios.forEach(a => processMediaPlaceholder(a, 'Audio'));

    return doc.body.innerHTML;
  };

  const exportToPdf = async () => {
    triggerSnapshot(); // Fire and forget

    // Serialize the editor to HTML so it closely matches the visual output
    const editorStatic = createSlateEditor({
      plugins: BaseEditorKit,
      value: editor.children,
    });

    let editorHtml = await serializeHtml(editorStatic, {
      editorComponent: EditorStatic,
      props: { style: { padding: '0 calc(50% - 350px)', paddingBottom: '' } },
    });

    // Process images and media before passing to pdfmake
    editorHtml = await processMediaForExport(editorHtml);

    // Convert HTML to pdfmake structure
    // @ts-ignore - html-to-pdfmake has no type definitions
    const htmlToPdfmake = ((await import('html-to-pdfmake')) as any).default;
    // @ts-ignore - pdfmake has no types here
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfMake = pdfMakeModule.default || pdfMakeModule;

    // @ts-ignore - vfs fonts
    const pdfFontsModule = await import('pdfmake/build/vfs_fonts');
    const pdfFonts = pdfFontsModule.default || pdfFontsModule;

    // Use the vfs from the module or global if necessary
    // Some versions of vfs_fonts export an object with pdfMake property, others export vfs directly
    let vfs = (pdfFonts && pdfFonts.pdfMake && pdfFonts.pdfMake.vfs) ||
      (pdfFonts && pdfFonts.vfs) ||
      (pdfFontsModule && pdfFontsModule.pdfMake && pdfFontsModule.pdfMake.vfs) ||
      (pdfFontsModule && pdfFontsModule.vfs);

    if (!vfs && typeof window !== 'undefined') {
      vfs = (window as any).pdfMake?.vfs;
    }

    if (vfs) {
      pdfMake.vfs = vfs;
    } else {
      console.warn('pdfMake vfs fonts not found, check build/vfs_fonts.js');
    }

    // Explicitly define fonts to avoid "Font not defined" errors
    // Roboto is the default font bundled with pdfmake's vfs_fonts
    pdfMake.fonts = {
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf'
      }
    };

    const content = htmlToPdfmake(editorHtml, { window });

    const docDefinition = {
      content,
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: 'Roboto' },
    };

    // Generate blob and download
    const blob = await new Promise<Blob>((resolve) => {
      pdfMake.createPdf(docDefinition).getBlob((b: Blob) => resolve(b));
    });

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = getExportFilename('pdf');
    document.body.append(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  };

  const exportToImage = async () => {
    // Image export is free
    triggerSnapshot();
    const canvas = await getCanvas();
    await downloadFile(canvas.toDataURL('image/png'), getExportFilename('png'));
  };

  const exportToHtml = async () => {
    triggerSnapshot();

    const editorStatic = createSlateEditor({
      plugins: BaseEditorKit,
      value: editor.children,
    });

    const editorHtml = await serializeHtml(editorStatic, {
      editorComponent: EditorStatic,
      props: { style: { padding: '0 calc(50% - 350px)', paddingBottom: '' } },
    });

    const tailwindCss = `<link rel="stylesheet" href="${siteUrl}/tailwind.css">`;
    const katexCss = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/katex.css" integrity="sha384-9PvLvaiSKCPkFKB1ZsEoTjgnJn+O3KvEwtsz37/XrkYft3DTk2gHdYvd9oWgW3tV" crossorigin="anonymous">`;

    const html = `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="light dark" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&family=JetBrains+Mono:wght@400..700&display=swap"
          rel="stylesheet"
        />
        ${tailwindCss}
        ${katexCss}
        <style>
          :root {
            --font-sans: 'Inter', 'Inter Fallback';
            --font-mono: 'JetBrains Mono', 'JetBrains Mono Fallback';
          }
        </style>
      </head>
      <body>
        ${editorHtml}
      </body>
    </html>`;

    const url = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

    await downloadFile(url, getExportFilename('html'));
  };

  const exportToMarkdown = async () => {
    triggerSnapshot();

    const md = editor.getApi(MarkdownPlugin).markdown.serialize();
    const url = `data:text/markdown;charset=utf-8,${encodeURIComponent(md)}`;
    await downloadFile(url, getExportFilename('md'));
  };

  const exportToWord = async () => {
    triggerSnapshot();

    // Serialize the editor to HTML to preserve exact visual appearance
    const editorStatic = createSlateEditor({
      plugins: BaseEditorKit,
      value: editor.children,
    });

    let editorHtml = await serializeHtml(editorStatic, {
      editorComponent: EditorStatic,
      props: { style: { padding: '20px' } },
    });

    // Process images and media (essential for Word to show images)
    editorHtml = await processMediaForExport(editorHtml);

    // Create a complete HTML document
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: 'Calibri', 'Arial', sans-serif;
              font-size: 11pt;
              line-height: 1.5;
              color: #000000;
            }
            img {
              max-width: 100%;
              height: auto;
              display: block;
              margin: 10px 0;
            }
          </style>
        </head>
        <body>${editorHtml}</body>
      </html>
    `;

    // Convert HTML to DOCX
    const docxBlob = htmlDocx.asBlob(htmlContent);

    // Download the file
    const blobUrl = window.URL.createObjectURL(docxBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = getExportFilename('docx');
    document.body.append(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton pressed={open} tooltip="Export" isDropdown>
          <ArrowDownToLineIcon className="size-4" />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={exportToHtml}>
            Export as HTML
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={exportToPdf}>
            Export as PDF
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={exportToWord}>
            Export as Word
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={exportToImage}>
            Export as Image
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={exportToMarkdown}>
            Export as Markdown
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
