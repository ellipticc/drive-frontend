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
    IconStackFilled as FilePaper,
    IconFolder as FolderIcon,
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

    // Folders
    if (mimeType === 'folder' || mime === 'folder') {
        return <FolderIcon className={iconClass("text-blue-500")} />;
    }

    // Images
    if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico', 'heic'].includes(ext)) {
        return <FileImage className={iconClass("text-purple-500")} />;
    }

    // Videos
    if (mime.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'm4v'].includes(ext)) {
        return <FileVideo className={iconClass("text-red-500")} />;
    }

    // Audio
    if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'aiff'].includes(ext)) {
        return <FileAudio className={iconClass("text-orange-500")} />;
    }

    // Paper
    if (mime === 'application/x-paper') {
        return <FilePaper className={iconClass("text-blue-500")} />;
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

    // PowerPoint / Presentations
    if (
        mime.includes('presentation') ||
        mime.includes('powerpoint') ||
        mime.includes('opendocument.presentation') ||
        ['ppt', 'pptx', 'odp', 'pps', 'ppsx'].includes(ext)
    ) {
        return <FileGeneric className={iconClass("text-orange-600")} />;
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
        ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'tbz2', 'txz'].includes(ext)
    ) {
        return <FileArchive className={iconClass("text-orange-500")} />;
    }

    // Code
    if (
        mime.includes('javascript') ||
        mime.includes('json') ||
        mime.includes('html') ||
        mime.includes('css') ||
        mime.includes('xml') ||
        ['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'py', 'java', 'c', 'cpp', 'rs', 'go', 'php', 'rb', 'swift', 'kt', 'scala', 'dart', 'lua', 'r', 'sh', 'bat', 'ps1', 'yml', 'yaml', 'toml', 'xml', 'md'].includes(ext)
    ) {
        if (ext === 'json' || mime.includes('json')) return <FileJson className={iconClass("text-yellow-600")} />;
        return <FileCode className={iconClass("text-blue-600")} />;
    }

    // Database
    if (['sql', 'db', 'sqlite'].includes(ext)) {
        return <Database className={iconClass("text-pink-600")} />;
    }

    return <FileGeneric className={iconClass("text-gray-600")} />;
}
