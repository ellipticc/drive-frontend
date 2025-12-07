/**
 * OAuth validation utilities
 * Ensures users complete OAuth password setup before accessing protected routes
 */

/**
 * Check if user is in a valid OAuth setup state
 * Returns null if not in OAuth setup, or oauth info if still setting up
 */
export function getOAuthSetupState(): {
  inProgress: boolean;
  userId?: string;
  tempToken?: string;
} {
  if (typeof window === 'undefined') {
    return { inProgress: false };
  }

  const inProgress = sessionStorage.getItem('oauth_setup_in_progress') === 'true';
  const userId = sessionStorage.getItem('oauth_user_id') || undefined;
  const tempToken = sessionStorage.getItem('oauth_temp_token') || undefined;

  return {
    inProgress,
    userId,
    tempToken,
  };
}

/**
 * Check if the current auth token is from an incomplete OAuth flow
 * This is a defensive check to prevent bypass if only auth_token exists
 */
export function isIncompleteOAuthToken(): boolean {
  if (typeof window === 'undefined') return false;

  // If oauth_setup_in_progress is true, ANY token is considered incomplete
  // This prevents old tokens from being accepted during OAuth password verification
  const inProgress = sessionStorage.getItem('oauth_setup_in_progress') === 'true';

  return inProgress;
}
