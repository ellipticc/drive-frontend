"use client"

import { useEffect, useRef, useCallback } from 'react';
import { useUser } from '@/components/user-context';

export function useSessionPing() {
  const { user } = useUser();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string>('');

  // Generate or get session ID
  const getSessionId = useCallback(() => {
    if (!sessionIdRef.current) {
      const stored = localStorage.getItem('drive_session_id');
      if (stored) {
        sessionIdRef.current = stored;
      } else {
        // Generate cryptographically secure session ID using Web Crypto API
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        sessionIdRef.current = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('drive_session_id', sessionIdRef.current);
      }
    }
    return sessionIdRef.current;
  }, []);

  // Ping function
  const ping = useCallback(async () => {
    try {
      const sessionId = getSessionId();
      const params = new URLSearchParams({
        sessionId: sessionId,
      });

      const response = await fetch(`https://ingest.ellipticc.com/api/v1/ping?${params}`, {
        method: 'GET',
      });

      if (!response.ok) {
        console.warn('Ping failed:', response.status);
      }
      // No need to process response - it's minimal { ok: true }
    } catch (error) {
      // Silently fail - don't spam console with ping errors
      console.debug('Ping error (silent):', error);
    }
  }, [getSessionId]);

  // Start/stop ping interval
  const startPinging = useCallback(() => {
    if (intervalRef.current) return; // Already pinging
    intervalRef.current = setInterval(ping, 15000);
    ping(); // Ping immediately
  }, [ping]);

  const stopPinging = useCallback(() => {
    if (!intervalRef.current) return; // Already stopped
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  // Handle tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPinging();
      } else {
        // Only start if user is authenticated
        if (user?.id) {
          startPinging();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id, startPinging, stopPinging]);

  // Main effect for authentication and initial setup
  useEffect(() => {
    // Only ping if user is authenticated and tab is visible
    if (!user?.id) {
      stopPinging();
      return;
    }

    // Start pinging only if tab is currently visible
    if (!document.hidden) {
      startPinging();
    }

    // Cleanup on unmount
    return () => {
      stopPinging();
    };
  }, [user?.id, startPinging, stopPinging]);

  // Cleanup on user logout
  useEffect(() => {
    return () => {
      stopPinging();
    };
  }, [stopPinging]);
}