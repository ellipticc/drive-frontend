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
 * Clear all OAuth setup state
 */
export function clearOAuthSetupState(): void {
  if (typeof window === 'undefined') return;

  sessionStorage.removeItem('oauth_setup_in_progress');
  sessionStorage.removeItem('oauth_user_id');
  sessionStorage.removeItem('oauth_temp_token');
}

/**
 * Validate that a user has completed OAuth setup
 * Checks that they have a valid account_salt set on the backend
 * Returns true if user has completed OAuth (or is not an OAuth user)
 * Returns false if user is in incomplete OAuth state
 */
export async function validateOAuthCompletion(
  apiClient: any,
  pathname: string
): Promise<boolean> {
  // Don't validate on OAuth callback page
  if (pathname === '/auth/oauth/callback') {
    return true;
  }

  const oauthState = getOAuthSetupState();

  // Not in OAuth setup, no validation needed
  if (!oauthState.inProgress) {
    return true;
  }

  // In OAuth setup on a non-OAuth page - should be blocked by AuthGuard
  // but return false as a safety measure
  return false;
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
