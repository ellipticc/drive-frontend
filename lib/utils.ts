
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

// --------- time helpers ---------

/**
 * Format a timestamp according to the rules:
 * - <60s: "X seconds ago"
 * - <60m: "X minutes ago"
 * - <24h: "X hours ago"
 * - within current year: "19 February"
 * - different year: "22 December 2025"
 */
export function formatRelativeTime(dateInput: string | Date | number): string {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) {
        return `${sec} second${sec === 1 ? '' : 's'} ago`;
    }
    const min = Math.floor(sec / 60);
    if (min < 60) {
        return `${min} minute${min === 1 ? '' : 's'} ago`;
    }
    const hr = Math.floor(min / 60);
    if (hr < 24) {
        return `${hr} hour${hr === 1 ? '' : 's'} ago`;
    }
    const year = date.getFullYear();
    const monthNames = [
        'January','February','March','April','May','June','July','August','September','October','November','December'
    ];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    if (year === now.getFullYear()) {
        return `${day} ${month}`;
    }
    return `${day} ${month} ${year}`;
}

import { useState, useEffect } from 'react';

/**
 * React hook that returns a formatted relative time string and updates regularly.
 */
export function useRelativeTime(dateInput: string | Date | number): string {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);
    return formatRelativeTime(dateInput);
}
