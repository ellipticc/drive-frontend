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
 * @param maxLength - Maximum length of the truncated string (default: 50)
 * @returns The truncated filename with ellipsis
 */
export function truncateFilename(filename: string, maxLength: number = 50): string {
  if (!filename || filename.length <= maxLength) {
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
