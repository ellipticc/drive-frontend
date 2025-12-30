import {
    IconFileText as FileText,
    IconPhoto as FileImage,
    IconMovie as FileVideo,
    IconMusic as FileAudio,
    IconZip as FileArchive,
    IconFileCode as FileCode,
    IconFileTypeXls as FileSpreadsheet,
    IconFile as FileGeneric,
    IconFileDescription as FileType2,
    IconFileTypeJs as FileJson,
    IconDatabase as Database,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"

interface FileIconProps {
    filename?: string
    mimeType?: string
    className?: string
}

export function FileIcon({ filename = '', mimeType = '', className }: FileIconProps) {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mime = mimeType.toLowerCase();

    // Helper to merge class names
    const iconClass = (colorClass: string) => cn(colorClass, className || "h-5 w-5");

    // Images
    if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
        return <FileImage className={iconClass("text-purple-500")} />;
    }

    // Videos
    if (mime.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext)) {
        return <FileVideo className={iconClass("text-red-500")} />;
    }

    // Audio
    if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
        return <FileAudio className={iconClass("text-yellow-500")} />;
    }

    // PDFs
    if (mime === 'application/pdf' || ext === 'pdf') {
        return <FileText className={iconClass("text-red-500")} />;
    }

    // Word / ODT
    if (
        mime.includes('wordprocessingml') ||
        mime.includes('msword') ||
        mime.includes('opendocument.text') ||
        ['doc', 'docx', 'odt', 'rtf', 'txt'].includes(ext)
    ) {
        return <FileType2 className={iconClass("text-blue-500")} />;
    }

    // Excel / Spreadsheet
    if (
        mime.includes('spreadsheet') ||
        mime.includes('excel') ||
        mime.includes('csv') ||
        ['xls', 'xlsx', 'ods', 'csv', 'tsv'].includes(ext)
    ) {
        return <FileSpreadsheet className={iconClass("text-green-500")} />;
    }

    // Archives
    if (
        mime.includes('zip') ||
        mime.includes('compressed') ||
        mime.includes('tar') ||
        ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)
    ) {
        return <FileArchive className={iconClass("text-orange-500")} />;
    }

    // Code
    if (
        mime.includes('javascript') ||
        mime.includes('json') ||
        mime.includes('html') ||
        mime.includes('css') ||
        ['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'py', 'java', 'c', 'cpp', 'rs', 'go'].includes(ext)
    ) {
        if (ext === 'json' || mime.includes('json')) return <FileJson className={iconClass("text-yellow-400")} />;
        return <FileCode className={iconClass("text-blue-400")} />;
    }

    // Database
    if (['sql', 'db', 'sqlite'].includes(ext)) {
        return <Database className={iconClass("text-pink-500")} />;
    }

    return <FileGeneric className={iconClass("text-gray-500")} />;
}
