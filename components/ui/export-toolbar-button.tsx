'use client';

import * as React from 'react';

import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';

import { MarkdownPlugin } from '@platejs/markdown';
import { ArrowDownToLineIcon } from 'lucide-react';
import { createSlateEditor } from 'platejs';
import { useEditorRef } from 'platejs/react';
import { serializeHtml } from 'platejs/static';
import { marked } from 'marked';

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
import { exportToDocx, downloadDocx } from '@platejs/docx-io';

export function ExportToolbarButton(props: DropdownMenuProps) {
  const { fileId } = useParams();
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);
  const { user } = useUser();
  const { resolvedTheme } = useTheme();

  const isProOrUnlimited = React.useMemo(() => {
    const planName = (user?.subscription?.plan?.name || '').toLowerCase();
    return planName.includes('pro') || planName.includes('unlimited');
  }, [user]);

  const requirePro = (formatLabel: string): boolean => {
    if (isProOrUnlimited) return true;
    setOpen(false); // close menu
    const message = `Export to ${formatLabel} requires a Pro or Unlimited subscription. Upgrade to export.`;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('export-requires-upgrade', { detail: { message } }));
    }
    return false;
  };

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

  const exportToPdf = async () => {
    if (!requirePro('PDF')) return;
    triggerSnapshot(); // Fire and forget

    // Serialize to markdown
    const md = editor.getApi(MarkdownPlugin).markdown.serialize();
    
    // Convert markdown to HTML
    const contentHtml = await marked(md);
    
    // Create a styled HTML document
    const styledHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
              font-size: 16px;
              line-height: 1.6;
              color: #000;
              background: #fff;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            h1, h2, h3, h4, h5, h6 {
              margin-top: 24px;
              margin-bottom: 16px;
              font-weight: 600;
              line-height: 1.25;
            }
            h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 8px; }
            h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 6px; }
            h3 { font-size: 1.25em; }
            p { margin-bottom: 16px; }
            code {
              background-color: #f6f8fa;
              padding: 2px 6px;
              border-radius: 3px;
              font-family: 'Courier New', 'Consolas', monospace;
              font-size: 0.9em;
            }
            pre {
              background-color: #f6f8fa;
              padding: 16px;
              border-radius: 6px;
              overflow-x: auto;
              margin-bottom: 16px;
            }
            pre code {
              background-color: transparent;
              padding: 0;
            }
            blockquote {
              border-left: 4px solid #dfe2e5;
              padding-left: 16px;
              color: #6a737d;
              margin: 16px 0;
            }
            ul, ol {
              margin-bottom: 16px;
              padding-left: 32px;
            }
            li {
              margin-bottom: 8px;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 16px 0;
            }
            th, td {
              border: 1px solid #dfe2e5;
              padding: 8px 12px;
              text-align: left;
            }
            th {
              background-color: #f6f8fa;
              font-weight: 600;
            }
            img {
              max-width: 100%;
              height: auto;
              margin: 16px 0;
            }
            a {
              color: #0366d6;
              text-decoration: none;
            }
            a:hover {
              text-decoration: underline;
            }
            hr {
              border: none;
              border-top: 2px solid #eaecef;
              margin: 24px 0;
            }
          </style>
        </head>
        <body>${contentHtml}</body>
      </html>
    `;

    // Create hidden iframe to render the HTML
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.width = '800px';
    iframe.style.height = '1000px';
    document.body.appendChild(iframe);

    // Write HTML to iframe
    iframe.contentDocument?.open();
    iframe.contentDocument?.write(styledHtml);
    iframe.contentDocument?.close();

    // Wait for content to render
    await new Promise(resolve => setTimeout(resolve, 500));

    // Capture as canvas
    const html2canvas = (await import('html2canvas-pro')).default;
    const canvas = await html2canvas(iframe.contentDocument!.body, {
      backgroundColor: '#ffffff',
      scale: 2,
    });

    // Remove iframe
    document.body.removeChild(iframe);

    // Convert to PDF
    const PDFLib = await import('pdf-lib');
    const pdfDoc = await PDFLib.PDFDocument.create();
    const page = pdfDoc.addPage([canvas.width, canvas.height]);
    const imageEmbed = await pdfDoc.embedPng(canvas.toDataURL('image/png'));
    const { height, width } = imageEmbed.scale(1);
    page.drawImage(imageEmbed, {
      height,
      width,
      x: 0,
      y: 0,
    });
    const pdfBase64 = await pdfDoc.saveAsBase64({ dataUri: true });

    await downloadFile(pdfBase64, getExportFilename('pdf'));
  };

  const exportToImage = async () => {
    // Image export is free
    triggerSnapshot();
    const canvas = await getCanvas();
    await downloadFile(canvas.toDataURL('image/png'), getExportFilename('png'));
  };

  const exportToHtml = async () => {
    if (!requirePro('HTML')) return;
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
    if (!requirePro('Markdown')) return;
    triggerSnapshot();

    const md = editor.getApi(MarkdownPlugin).markdown.serialize();
    const url = `data:text/markdown;charset=utf-8,${encodeURIComponent(md)}`;
    await downloadFile(url, getExportFilename('md'));
  };

  const exportToWord = async () => {
    if (!requirePro('Word')) return;
    triggerSnapshot();

    const blob = await exportToDocx(editor.children, {
      fontFamily: 'Calibri',
      orientation: 'portrait',
    });
    
    downloadDocx(blob, getExportFilename('docx'));
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
