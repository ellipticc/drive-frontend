// Precompute expensive operations for files and folders
// Reduces computation on every render

import type { FileItem as ApiFileItem } from './api';

// Use the API FileItem as base
export type FileItem = ApiFileItem;

export interface ComputedFileItem extends FileItem {
  // Precomputed fields
  fileExtension: string;
  formattedSize: string;
  isImage: boolean;
  isVideo: boolean;
  isAudio: boolean;
  isDocument: boolean;
  isArchive: boolean;
  isCode: boolean;
  isPaper: boolean;
  sortKey: string;
  displayName: string;
  lastModified: number;
  fileSize: number;
}

// File type detection
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', 'wmv'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'];
const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx'];
const ARCHIVE_EXTENSIONS = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];
const CODE_EXTENSIONS = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt'];

const IMAGE_MIME_PREFIX = 'image/';
const VIDEO_MIME_PREFIX = 'video/';
const AUDIO_MIME_PREFIX = 'audio/';

// Size formatting
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Extension extraction
function getFileExtension(filename: string): string {
  if (!filename) return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

// Type detection
function detectFileType(mimeType: string, extension: string): {
  isImage: boolean;
  isVideo: boolean;
  isAudio: boolean;
  isDocument: boolean;
  isArchive: boolean;
  isCode: boolean;
  isPaper: boolean;
} {
  const lowerMime = mimeType?.toLowerCase() || '';
  const lowerExt = extension.toLowerCase();

  return {
    isImage: lowerMime.startsWith(IMAGE_MIME_PREFIX) || IMAGE_EXTENSIONS.includes(lowerExt),
    isVideo: lowerMime.startsWith(VIDEO_MIME_PREFIX) || VIDEO_EXTENSIONS.includes(lowerExt),
    isAudio: lowerMime.startsWith(AUDIO_MIME_PREFIX) || AUDIO_EXTENSIONS.includes(lowerExt),
    isDocument: DOCUMENT_EXTENSIONS.includes(lowerExt),
    isArchive: ARCHIVE_EXTENSIONS.includes(lowerExt),
    isCode: CODE_EXTENSIONS.includes(lowerExt),
    isPaper: mimeType === 'application/x-paper' || lowerExt === 'paper',
  };
}

// Generate sort key for consistent sorting
function generateSortKey(item: FileItem): string {
  const name = item.name || '';
  return name.toLowerCase();
}

// Precompute all expensive fields for a single item
export function precomputeFileFields(item: FileItem): ComputedFileItem {
  const displayName = item.name || 'Unnamed';
  const extension = getFileExtension(displayName);
  const fileSize = typeof item.size === 'string' ? parseInt(item.size) || 0 : item.size || 0;
  const lastModified = new Date(item.updatedAt || item.createdAt || 0).getTime();

  const fileTypes = detectFileType(item.mimeType || '', extension);

  return {
    ...item,
    // Precomputed fields
    fileExtension: extension,
    formattedSize: formatFileSize(fileSize),
    displayName,
    lastModified,
    fileSize,
    sortKey: generateSortKey(item),
    ...fileTypes,
  };
}

// Precompute fields for multiple items (batch operation)
export function precomputeFileFieldsBatch(items: FileItem[]): ComputedFileItem[] {
  return items.map(precomputeFileFields);
}

// Get file icon type based on computed fields
export function getFileIconType(item: ComputedFileItem): string {
  if (item.isPaper) return 'paper';
  if (item.isImage) return 'image';
  if (item.isVideo) return 'video';
  if (item.isAudio) return 'audio';
  if (item.isDocument) return 'document';
  if (item.isArchive) return 'archive';
  if (item.isCode) return 'code';
  return 'file';
}

// Get file category for grouping
export function getFileCategory(item: ComputedFileItem): string {
  if (item.isPaper) return 'Papers';
  if (item.isImage) return 'Images';
  if (item.isVideo) return 'Videos';
  if (item.isAudio) return 'Audio';
  if (item.isDocument) return 'Documents';
  if (item.isArchive) return 'Archives';
  if (item.isCode) return 'Code';
  return 'Files';
}