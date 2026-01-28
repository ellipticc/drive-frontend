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

    // Serialize the editor to HTML so it closely matches the visual output
    const editorStatic = createSlateEditor({
      plugins: BaseEditorKit,
      value: editor.children,
    });

    let editorHtml = await serializeHtml(editorStatic, {
      editorComponent: EditorStatic,
      props: { style: { padding: '0 calc(50% - 350px)', paddingBottom: '' } },
    });

    // Convert relative image URLs to absolute (so pdfmake can fetch/embed them)
    editorHtml = editorHtml.replace(/src="\//g, `src="${siteUrl}/`);

    // Convert HTML to pdfmake structure
    // @ts-ignore - html-to-pdfmake has no type definitions
    const htmlToPdfmake = ((await import('html-to-pdfmake')) as any).default;
    // @ts-ignore - pdfmake has no types here
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfMake = pdfMakeModule.default || pdfMakeModule;

    // @ts-ignore - vfs fonts
    const pdfFontsModule = await import('pdfmake/build/vfs_fonts');
    const pdfFonts = pdfFontsModule.default || pdfFontsModule;

    // Robust assignment of vfs
    if (pdfFonts && pdfFonts.pdfMake && pdfFonts.pdfMake.vfs) {
      pdfMake.vfs = pdfFonts.pdfMake.vfs;
    } else if (pdfFonts && pdfFonts.vfs) {
      pdfMake.vfs = pdfFonts.vfs;
    } else {
      console.error('Failed to load pdfMake vfs fonts');
    }

    const content = htmlToPdfmake(editorHtml, { window });

    const docDefinition = {
      content,
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: 'Helvetica' },
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

    // Serialize the editor to HTML to preserve exact visual appearance
    const editorStatic = createSlateEditor({
      plugins: BaseEditorKit,
      value: editor.children,
    });

    const editorHtml = await serializeHtml(editorStatic, {
      editorComponent: EditorStatic,
      props: { style: { padding: '20px' } },
    });

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
