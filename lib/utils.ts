
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Truncates a filename with ellipsis in the middle, keeping the start and end visible.
 * Useful for long encrypted filenames that need to fit in UI components.
 *
 * @param filename - The filename to truncate
 * @param maxLength - Maximum length of the truncated string (default: 30)
 * @returns The truncated filename with ellipsis
 */
export function truncateFilename(filename: string, maxLength: number = 30): string {
  // Handle null, undefined, or non-string inputs
  if (!filename || typeof filename !== 'string') {
    return '';
  }

  if (filename.length <= maxLength) {
    return filename;
  }

  const ellipsis = '...';
  const ellipsisLength = ellipsis.length;
  const availableLength = maxLength - ellipsisLength;

  // Ensure we have at least 4 characters on each side
  const minSideLength = Math.max(4, Math.floor(availableLength / 2));

  const startLength = Math.min(minSideLength, availableLength - minSideLength);
  const endLength = availableLength - startLength;

  const start = filename.substring(0, startLength);
  const end = filename.substring(filename.length - endLength);

  return start + ellipsis + end;
}

/**
 * Formats a file size in bytes to a human-readable string (e.g., "1.5 MB").
 *
 * @param bytes - The size in bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  // Check for NaN, null, undefined, infinite, or negative values
  if (!bytes || isNaN(bytes) || !isFinite(bytes) || bytes < 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // Safety check for index out of bounds (shouldn't happen with reasonable file sizes but good for robustness)
  if (i < 0) return '0 B';
  if (i >= sizes.length) return parseFloat((bytes / Math.pow(k, sizes.length - 1)).toFixed(dm)) + ' ' + sizes[sizes.length - 1];

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + (sizes[i] || 'B');
}
