
import * as pdfjsLib from 'pdfjs-dist';
import * as mammoth from 'mammoth';

// Configure worker locally - we might need to copy the worker file to public/ or use a CDN
// For Next.js/Webpack, it's often easier to use the CDN for the worker to avoid build config hell
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export type ParsedDocument = {
    title: string;
    content: string;
    type: 'pdf' | 'text' | 'image' | 'unknown';
};

export const parseFile = async (file: File): Promise<ParsedDocument> => {
    const fileType = file.type;

    try {
        if (fileType === 'application/pdf') {
            return await parsePDF(file);
        } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
            return await parseDocx(file);
        } else if (
            fileType.startsWith('text/') ||
            file.name.endsWith('.md') ||
            file.name.endsWith('.txt') ||
            file.name.endsWith('.csv') ||
            file.name.endsWith('.json') ||
            file.name.endsWith('.js') ||
            file.name.endsWith('.ts') ||
            file.name.endsWith('.tsx') ||
            file.name.endsWith('.jsx') ||
            file.name.endsWith('.py') ||
            file.name.endsWith('.html') ||
            file.name.endsWith('.css') ||
            file.name.endsWith('.env')
        ) {
            return await parseText(file);
        } else {
            // Fallback for unknown types - try to read as text anyway if small (< 1MB)
            if (file.size < 1024 * 1024) {
                try {
                    return await parseText(file);
                } catch (e) {
                    // ignore
                }
            }

            return {
                title: file.name,
                content: `[File type ${fileType} not supported for deep analysis]`,
                type: 'unknown'
            };
        }
    } catch (e) {
        console.error("Error parsing file:", e);
        throw new Error(`Failed to parse ${file.name}`);
    }
};

const parseText = async (file: File): Promise<ParsedDocument> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            resolve({
                title: file.name,
                content: content,
                type: 'text'
            });
        };
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
};

const parsePDF = async (file: File): Promise<ParsedDocument> => {
    const arrayBuffer = await file.arrayBuffer();

    // Load the document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = "";

    // Iterate over all pages
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');

        fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }

    return {
        title: file.name,
        content: fullText,
        type: 'pdf'
    };
};

const parseDocx = async (file: File): Promise<ParsedDocument> => {
    const arrayBuffer = await file.arrayBuffer();
    try {
        const result = await mammoth.extractRawText({ arrayBuffer });
        return {
            title: file.name,
            content: result.value.trim(),
            type: 'text' // Store as text since mammoth extracts raw text
        };
    } catch (e) {
        console.error("Error extracting text from DOCX:", e);
        throw new Error(`Failed to parse DOCX: ${file.name}`);
    }
};
