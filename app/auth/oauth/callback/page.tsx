'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { OAuthPasswordModal } from '@/components/auth/oauth-password-modal';

/**
 * OAuth Callback page
 * Handles the redirect from Google OAuth and shows password setup modal
 * URL: /auth/oauth/callback?code=...&state=...
 */
export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [oauthData, setOauthData] = useState<{
    email: string;
    token: string;
  } | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!code || !state) {
          // Check if there's an error from Google
          const errorCode = searchParams.get('error');
          const errorDescription = searchParams.get('error_description') || 'Unknown error';
          
          if (errorCode) {
            throw new Error(`Google OAuth error: ${errorCode} - ${errorDescription}`);
          }
          
          throw new Error('Missing authorization code or state');
        }

        // Exchange code for tokens via backend
        const response = await apiClient.handleGoogleOAuthCallback(code, state);

        if (!response.success || !response.data) {
          throw new Error(response.error || 'OAuth authentication failed');
        }

        const data = response.data;
        
        // Check if user already has account_salt (password already set)
        if (data.user.has_account_salt) {
          // User already set password before, just redirect to dashboard
          // Token is already in cookie/localStorage
          router.push('/dashboard');
          return;
        }

        // Show password setup modal
        setOauthData({
          email: data.user.email,
          token: data.token
        });
        setLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'OAuth callback processing failed';
        setError(errorMessage);
        setLoading(false);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Authenticating with Google...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Authentication Failed</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (oauthData) {
    return (
      <OAuthPasswordModal
        email={oauthData.email}
        token={oauthData.token}
        onComplete={() => {
          router.push('/dashboard');
        }}
      />
    );
  }

  return null;
}
