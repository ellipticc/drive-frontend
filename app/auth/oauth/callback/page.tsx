'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { IconCaretLeftRightFilled } from '@tabler/icons-react';
import { apiClient } from '@/lib/api';
import { OAuthPasswordModal } from '@/components/auth/oauth-password-modal';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { FieldDescription } from '@/components/ui/field';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [oauthData, setOauthData] = useState<{
    email: string;
    token: string;
    hasAccountSalt: boolean;
  } | null>(null);

  useEffect(() => {
    // Cleanup function to clear OAuth session token if user leaves without completing setup
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // If OAuth setup is in progress and user tries to leave, warn them
      if (oauthData && sessionStorage.getItem('oauth_setup_in_progress') === 'true') {
        // Show browser warning dialog
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
      
      // Clear the temporary OAuth token when user actually closes or leaves page
      if (!oauthData || !window.location.href.includes('/auth/oauth/callback')) {
        sessionStorage.removeItem('oauth_temp_token');
        sessionStorage.removeItem('oauth_setup_in_progress');
        apiClient.clearAuthToken();
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      // If user uses back button during OAuth setup, warn them
      if (sessionStorage.getItem('oauth_setup_in_progress') === 'true') {
        // Clear OAuth state when leaving
        sessionStorage.removeItem('oauth_temp_token');
        sessionStorage.removeItem('oauth_setup_in_progress');
        apiClient.clearAuthToken();
        
        // Redirect to login page
        router.push('/login');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [oauthData, router]);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const error_description = searchParams.get('error_description');

        // Handle Google OAuth errors
        if (error) {
          throw new Error(`Google error: ${error} - ${error_description || 'Unknown'}`);
        }

        if (!code || !state) {
          throw new Error('Missing authorization code or state');
        }

        // Exchange code for tokens via backend
        const response = await apiClient.handleGoogleOAuthCallback(code, state);

        if (!response.success || !response.data) {
          throw new Error(response.error || 'OAuth authentication failed');
        }

        const data = response.data;

        // IMPORTANT: Clear any existing auth tokens before starting OAuth flow
        // This prevents old tokens from bypassing the password verification
        localStorage.removeItem('auth');
        apiClient.clearAuthToken();

        // IMPORTANT: Use temporary sessionStorage token instead of localStorage
        // This token is only valid for the OAuth password setup flow
        // It will be cleared if user navigates away without completing setup
        sessionStorage.setItem('oauth_temp_token', data.token);
        sessionStorage.setItem('oauth_setup_in_progress', 'true');
        sessionStorage.setItem('oauth_user_id', data.user.id);
        // NOTE: Do NOT call apiClient.setAuthToken() during OAuth setup
        // This prevents the token from being stored in localStorage and bypassing password verification

        // Check if user already has password set up
        const hasAccountSalt = data.user.has_account_salt;

        if (hasAccountSalt) {
          // Existing user - show login modal to verify password
          setOauthData({
            email: data.user.email,
            token: data.token,
            hasAccountSalt: true
          });
        } else {
          // New user - show password setup modal
          setOauthData({
            email: data.user.email,
            token: data.token,
            hasAccountSalt: false
          });
        }

        setLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'OAuth callback processing failed';
        setError(errorMessage);
        setLoading(false);
      }
    };

    // Only call if we have searchParams ready
    if (searchParams.size > 0) {
      handleCallback();
    }
  }, [searchParams, router]);

  if (loading) {
    return (
      <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex flex-col gap-6">
            <a href="/" className="flex items-center gap-2 self-center font-medium">
              <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
                <IconCaretLeftRightFilled className="!size-5" />
              </div>
              <span className="text-base font-mono break-all">ellipticc</span>
            </a>
            <div className="flex flex-col gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-center text-sm text-muted-foreground">Authenticating with Google...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex flex-col gap-6">
            <a href="/" className="flex items-center gap-2 self-center font-medium">
              <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
                <IconCaretLeftRightFilled className="!size-5" />
              </div>
              <span className="text-base font-mono break-all">ellipticc</span>
            </a>
            <div className="flex flex-col gap-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex flex-col gap-2">
                  <h2 className="font-semibold text-destructive">Authentication Failed</h2>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              </div>
              <Button
                onClick={() => router.push('/login')}
                variant="outline"
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (oauthData) {
    return (
      <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="flex w-full max-w-sm flex-col gap-6">
          <a href="/" className="flex items-center gap-2 self-center font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <IconCaretLeftRightFilled className="!size-5" />
            </div>
            <span className="text-base font-mono break-all">ellipticc</span>
          </a>
          <OAuthPasswordModal email={oauthData.email} hasAccountSalt={oauthData.hasAccountSalt} />
          <FieldDescription className="text-center text-xs">
            By continuing, you agree to our{" "}
            <Link href="/terms-of-service" className="underline hover:text-primary">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy-policy" className="underline hover:text-primary">
              Privacy Policy
            </Link>
          </FieldDescription>
        </div>
      </div>
    );
  }

  return null;
}
