'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"
import { Loader2, AlertCircle } from "lucide-react"
import { apiClient } from '@/lib/api';

/**
 * Google OAuth Login Button
 * Initiates the Google OAuth flow
 */
export function GoogleOAuthButton({ context = 'login' }: { context?: 'login' | 'register' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset loading state when component mounts (handles case where user returns from cancelled OAuth)
  useEffect(() => {
    setLoading(false);
    setError('');
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      // Get referral code from sessionStorage if available
      const referralCode = sessionStorage.getItem('referral_code');
      
      // Get the Google OAuth authorization URL from backend via apiClient
      const response = await apiClient.getGoogleOAuthUrl(referralCode || undefined);

      if (!response.success || !response.data?.authUrl) {
        throw new Error(response.error || 'Failed to initiate Google OAuth');
      }

      // Redirect user to Google OAuth consent screen
      window.location.href = response.data.authUrl;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'OAuth initiation failed';
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-2">
      <Button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full"
        variant="outline"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="100" height="100" viewBox="0 0 48 48" className="mr-2 h-4 w-4">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
            </svg>
            {context === 'register' ? 'Register with Google' : 'Login with Google'}
          </>
        )}
      </Button>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 flex gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
