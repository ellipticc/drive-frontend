/**
 * Global error handlers for common frontend issues
 */

import { toast } from 'sonner';

/**
 * Check if an error is Cloudflare-related
 */
export function isCloudflareError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return message.includes('captcha') ||
         message.includes('just a moment') ||
         message.includes('checking your browser') ||
         message.includes('cloudflare') ||
         message.includes('security verification required');
}

/**
 * Handle Cloudflare errors globally
 */
export function handleCloudflareError(error: unknown): boolean {
  if (isCloudflareError(error)) {
    toast.error('Security verification required. Please reload the page.', {
      duration: 8000,
      action: {
        label: 'Reload',
        onClick: () => window.location.reload()
      }
    });
    return true; // Handled
  }
  return false; // Not handled
}

/**
 * Check if an error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return message.includes('failed to fetch') ||
         message.includes('networkerror') ||
         message.includes('cors') ||
         message.includes('network request failed');
}

/**
 * Handle network errors globally
 */
export function handleNetworkError(error: unknown): boolean {
  if (isNetworkError(error)) {
    toast.error('Network connection error. Please check your connection and try again.', {
      duration: 6000,
      action: {
        label: 'Retry',
        onClick: () => window.location.reload()
      }
    });
    return true; // Handled
  }
  return false; // Not handled
}

/**
 * Global error handler that tries multiple error types
 */
export function handleGlobalError(error: unknown): boolean {
  return handleCloudflareError(error) ||
         handleNetworkError(error);
}

/**
 * Enhanced error handler with custom options
 */
export interface ErrorHandlerOptions {
  showToast?: boolean;
  customMessage?: string;
  onError?: (error: string) => void;
  allowReload?: boolean;
}

export function handleError(error: unknown, options: ErrorHandlerOptions = {}): boolean {
  const {
    showToast = true,
    customMessage,
    onError,
    allowReload = true
  } = options;

  if (isCloudflareError(error)) {
    const message = customMessage || 'Security verification required. Please reload the page.';

    if (showToast) {
      toast.error(message, {
        duration: 8000,
        action: allowReload ? {
          label: 'Reload',
          onClick: () => window.location.reload()
        } : undefined
      });
    }

    onError?.(message);
    return true;
  }

  if (isNetworkError(error)) {
    const message = customMessage || 'Network connection error. Please check your connection and try again.';

    if (showToast) {
      toast.error(message, {
        duration: 6000,
        action: allowReload ? {
          label: 'Retry',
          onClick: () => window.location.reload()
        } : undefined
      });
    }

    onError?.(message);
    return true;
  }

  return false; // Not handled
}