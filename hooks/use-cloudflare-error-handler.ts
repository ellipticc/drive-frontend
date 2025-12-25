/**
 * Hook to handle Cloudflare bot protection errors gracefully
 * Detects "403 Just a moment..." and similar Cloudflare errors
 * and provides user-friendly messages instead of raw HTML
 */

import { useCallback } from 'react';
import { handleError, isCloudflareError } from '@/lib/error-handlers';

interface CloudflareErrorOptions {
  showToast?: boolean;
  customMessage?: string;
  onError?: (error: string) => void;
  allowReload?: boolean;
}

export function useCloudflareErrorHandler(options: CloudflareErrorOptions = {}) {
  const {
    showToast = true,
    customMessage,
    onError,
    allowReload = true
  } = options;

  const handleResponse = useCallback(async (response: Response): Promise<Response> => {
    // Check if response is likely a Cloudflare error page
    if (!response.ok) {
      try {
        // Try to read response as text to check for Cloudflare signatures
        const responseText = await response.clone().text();

        // Common Cloudflare error signatures
        const cloudflareSignatures = [
          'Just a moment...',
          'Checking your browser',
          'cf-browser-verification',
          'cf-challenge-running',
          'DDoS protection by Cloudflare',
          '__cf_chl_jschl_tk__',
          'cf-ray',
          'cf-cache-status'
        ];

        const isCloudflareError = cloudflareSignatures.some(signature =>
          responseText.toLowerCase().includes(signature.toLowerCase())
        );

        if (isCloudflareError) {
          const errorMessage = customMessage || 'Security verification required. Please reload the page.';

          if (showToast) {
            handleError(new Error(errorMessage), {
              showToast,
              customMessage: errorMessage,
              onError,
              allowReload
            });
          } else {
            onError?.(errorMessage);
          }

          // Throw a clean error instead of the HTML
          throw new Error(errorMessage);
        }
      } catch (textError) {
        // If we can't read the response text, continue with normal error handling
        console.warn('Could not read response text for Cloudflare detection:', textError);
      }
    }

    return response;
  }, [customMessage, showToast, onError, allowReload]);

  const wrapFetch = useCallback((
    fetchPromise: Promise<Response>
  ): Promise<Response> => {
    return fetchPromise
      .then(response => handleResponse(response))
      .catch(error => {
        // If it's already our custom error, re-throw it
        if (isCloudflareError(error)) {
          throw error;
        }

        // For other errors, check if they might be Cloudflare-related
        if (error.message?.includes('Failed to fetch') ||
            error.message?.includes('NetworkError') ||
            error.message?.includes('CORS')) {
          // These could be Cloudflare blocking requests
          const networkErrorMessage = 'Network error detected. This might be due to security measures. Please try again.';

          if (showToast) {
            handleError(new Error(networkErrorMessage), {
              showToast,
              customMessage: networkErrorMessage,
              onError,
              allowReload
            });
          } else {
            onError?.(networkErrorMessage);
          }

          throw new Error(networkErrorMessage);
        }

        // Re-throw original error for other cases
        throw error;
      });
  }, [handleResponse, showToast, onError, allowReload]);

  return {
    handleResponse,
    wrapFetch
  };
}

// Re-export for convenience
export { isCloudflareError, handleError } from '@/lib/error-handlers';