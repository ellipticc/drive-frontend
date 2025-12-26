/**
 * Session Management Service
 * Handles JWT token expiry, auto-renewal, and session configuration
 */

interface TokenPayload {
  userId: string;
  iat: number;
  exp: number;
  authMethod: string;
}

interface SessionConfig {
  sessionExpiry: number; // in seconds
  remindBeforeExpiry: number; // reminder before expiry in seconds
}

const DEFAULT_SESSION_EXPIRY = 3600; // 1 hour
const DEFAULT_REMIND_BEFORE_EXPIRY = 300; // 5 minutes before expiry

export class SessionManager {
  private static tokenRefreshCheckInterval: NodeJS.Timeout | null = null;
  private static tokenExpiryWarningShown = false;

  /**
   * Initialize session management with auto-renewal
   */
  static initializeSessionManagement() {
    if (typeof window === 'undefined') return;

    // Check token expiry every minute
    this.tokenRefreshCheckInterval = setInterval(() => {
      this.checkAndRenewToken();
    }, 60000); // 60 seconds

    // Also check on window focus
    window.addEventListener('focus', () => {
      this.checkAndRenewToken();
    });

    // Clear sessionStorage when tab is closed (sessionStorage is per-tab)
    window.addEventListener('beforeunload', () => {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear();
      }
    });
  }

  /**
   * Check if token is about to expire and renew if needed
   */
  static async checkAndRenewToken() {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const payload = this.decodeJWT(token);
      if (!payload) return;

      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = payload.exp - now;
      const sessionConfig = this.getSessionConfig();
      const remindTime = sessionConfig.remindBeforeExpiry;

      // If token expires in less than reminder time, show warning
      if (timeUntilExpiry > 0 && timeUntilExpiry <= remindTime && !this.tokenExpiryWarningShown) {
        this.tokenExpiryWarningShown = true;
        this.showExpiryWarning(timeUntilExpiry);
      }

      // If token is about to expire (less than 5 minutes), attempt auto-renewal
      // We must renew BEFORE expiry because the refresh endpoint requires a valid token
      if (timeUntilExpiry <= 300) {
        await this.renewTokenWithKeypairs(payload.userId);
      }
    } catch (error) {
      console.error('Error checking token expiry:', error);
    }
  }

  /**
   * Attempt to renew token using cached keypairs
   */
  static async renewTokenWithKeypairs(userId: string) {
    try {
      // Check if we have cached keypairs
      const cachedKeypairs = localStorage.getItem('crypto_keypairs');
      const accountSalt = localStorage.getItem('account_salt');

      if (!cachedKeypairs || !accountSalt) {
        // No cached keypairs, must login again
        this.clearSessionAndRedirect();
        return;
      }

      // Attempt silent token renewal with cached credentials
      const response = await fetch('/api/v1/auth/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
          this.tokenExpiryWarningShown = false;
          console.log('Token renewed successfully');
        }
      } else {
        // Token renewal failed, redirect to login
        this.clearSessionAndRedirect();
      }
    } catch (error) {
      console.error('Error renewing token:', error);
      this.clearSessionAndRedirect();
    }
  }

  /**
   * Show expiry warning to user
   */
  private static showExpiryWarning(secondsUntilExpiry: number) {
    const minutes = Math.ceil(secondsUntilExpiry / 60);

    // Dispatch custom event for UI components to handle
    const event = new CustomEvent('session-expiry-warning', {
      detail: { minutesRemaining: minutes }
    });
    window.dispatchEvent(event);
  }

  /**
   * Clear session and redirect to login
   */
  static async clearSessionAndRedirect() {
    const token = localStorage.getItem('auth_token');

    // If we have a token, call logout endpoint to track the logout
    if (token) {
      try {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        // Ignore logout API errors - we still want to clear local session
        console.warn('Failed to call logout API:', error);
      }
    }

    // Clear all localStorage but preserve TOTP device token
    if (typeof localStorage !== 'undefined') {
      const deviceToken = localStorage.getItem('totp_device_token');
      localStorage.clear();
      if (deviceToken) {
        localStorage.setItem('totp_device_token', deviceToken);
      }
    }

    // Clear all sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }

    // Clear all cookies
    if (typeof document !== 'undefined') {
      // Get all cookies
      const cookies = document.cookie.split(';');

      // Clear each cookie by setting expiry to past date
      for (const cookie of cookies) {
        const [name] = cookie.trim().split('=');
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=${window.location.hostname}`;
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=.${window.location.hostname}`;
        // Also try without domain for localhost/development
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      }
    }

    if (typeof window !== 'undefined') {
      window.location.href = '/login?expired=true';
    }
  }

  /**
   * Get session expiry configuration for current user
   */
  static getSessionConfig(): SessionConfig {
    if (typeof window === 'undefined') {
      return {
        sessionExpiry: DEFAULT_SESSION_EXPIRY,
        remindBeforeExpiry: DEFAULT_REMIND_BEFORE_EXPIRY
      };
    }

    const stored = localStorage.getItem('session_config');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Fall back to defaults if parsing fails
      }
    }

    return {
      sessionExpiry: DEFAULT_SESSION_EXPIRY,
      remindBeforeExpiry: DEFAULT_REMIND_BEFORE_EXPIRY
    };
  }

  /**
   * Store session expiry configuration
   */
  static setSessionConfig(config: SessionConfig) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('session_config', JSON.stringify(config));
  }

  /**
   * Decode JWT without verification (for client-side checking only)
   */
  static decodeJWT(token: string): TokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = parts[1];
      const decodedPayload = atob(payload);
      return JSON.parse(decodedPayload);
    } catch {
      return null;
    }
  }

  /**
   * Get time until token expiry in seconds
   */
  static getTimeUntilExpiry(): number | null {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return null;

      const payload = this.decodeJWT(token);
      if (!payload) return null;

      const now = Math.floor(Date.now() / 1000);
      return Math.max(0, payload.exp - now);
    } catch {
      return null;
    }
  }

  /**
   * Check if token is valid (not expired)
   */
  static isTokenValid(): boolean {
    const timeUntilExpiry = this.getTimeUntilExpiry();
    return timeUntilExpiry !== null && timeUntilExpiry > 0;
  }

  /**
   * Cleanup session management
   */
  static cleanup() {
    if (this.tokenRefreshCheckInterval) {
      clearInterval(this.tokenRefreshCheckInterval);
      this.tokenRefreshCheckInterval = null;
    }
  }
}

export const DEFAULT_SESSION_EXPIRY_OPTIONS = [
  { label: '30 minutes', value: 30 * 60 },
  { label: '1 hour', value: 60 * 60 },
  { label: '2 hours', value: 2 * 60 * 60 },
  { label: '6 hours', value: 6 * 60 * 60 },
  { label: '12 hours', value: 12 * 60 * 60 },
  { label: '24 hours', value: 24 * 60 * 60 },
  { label: '7 days', value: 7 * 24 * 60 * 60 }
];
