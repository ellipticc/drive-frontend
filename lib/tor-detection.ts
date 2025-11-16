/**
 * TOR Hidden Service Detection and Configuration
 * 
 * This utility detects if the application is being accessed through a TOR hidden service
 * and automatically routes API requests through the corresponding TOR backend.
 */

/**
 * Detects if the current page is being accessed via a TOR hidden service (onion domain)
 * @returns {boolean} True if accessing via TOR, false otherwise
 */
export function isTorAccess(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // Check if the current hostname is a .onion domain
  const hostname = window.location.hostname;
  return hostname.endsWith('.onion');
}

/**
 * Gets the appropriate API base URL based on access method (clearnet vs TOR)
 * 
 * For TOR: Uses Next.js proxy route to avoid CORS issues (same-origin requests)
 * For clearnet: Makes direct calls to backend
 * 
 * Why the proxy for TOR?
 * - TOR Browser strips Origin headers for privacy
 * - CORS with `*` and credentials is not allowed
 * - A proxy on the same TOR network can reach the TOR backend directly
 * - By routing through the frontend's Next.js server, requests become same-origin
 * 
 * @returns {string} The API base URL to use
 */
export function getApiBaseUrl(): string {
  // If already set via environment variable, use that
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // If accessing via TOR, use Next.js proxy to avoid CORS issues
  if (isTorAccess()) {
    return '/api/proxy';
  }

  // Default to clearnet backend
  return 'https://drive.ellipticc.com/api/v1';
}

/**
 * Gets the appropriate frontend base URL based on access method
 * @returns {string} The frontend base URL (without /api/v1)
 */
export function getFrontendBaseUrl(): string {
  if (typeof window === 'undefined') {
    // Server-side fallback
    return process.env.NEXT_PUBLIC_BASE_URL || 'https://ellipticc.com';
  }

  // Return the origin the user is currently accessing
  return window.location.origin;
}

/**
 * Gets the appropriate backend base URL (without /api/v1)
 * @returns {string} The backend base URL
 */
export function getBackendBaseUrl(): string {
  if (isTorAccess()) {
    return 'http://tob47vnuzbhpu66uwikzfj6lyuldyol3n6tibkg6k3mo2phiwngntxyd.onion';
  }

  return 'https://drive.ellipticc.com';
}

/**
 * Checks if a URL string represents a TOR hidden service
 * @param {string} url - The URL to check
 * @returns {boolean} True if the URL is a TOR onion address
 */
export function isTorUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.endsWith('.onion');
  } catch {
    return false;
  }
}

/**
 * React hook to detect TOR access on mount
 * @returns {boolean} True if accessing via TOR
 */
export function useTorDetection(): boolean {
  const [isTor, setIsTor] = React.useState(false);

  React.useEffect(() => {
    setIsTor(isTorAccess());
  }, []);

  return isTor;
}

// Import React for the hook
import React from 'react';
