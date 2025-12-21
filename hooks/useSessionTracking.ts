/**
 * useSessionTracking - React hook for UTM tracking and session management
 * 
 * This hook:
 * - Captures UTM parameters from URL query params
 * - Sends session start event to backend
 * - Stores session ID for later conversion tracking
 * - Only activates on auth pages (signup, login, recovery)
 * - Stops tracking after user logs in
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface SessionData {
  sessionId: string | null;
  sessionHash: string | null;
}

interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

interface TrackingData {
  first_landing_url: string;
  referrer: string | null;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

/**
 * Extract UTM parameters from URL search params
 */
function extractUTMParams(): UTMParams {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const utm: UTMParams = {};

  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

  utmKeys.forEach((key) => {
    const value = params.get(key);
    if (value) {
      utm[key as keyof UTMParams] = value;
    }
  });

  return utm;
}

/**
 * Get first landing URL - the current page
 */
function getFirstLandingUrl(): string {
  if (typeof window === 'undefined') return '/';
  
  // Include pathname and search params to capture full landing context
  return window.location.pathname + window.location.search;
}

/**
 * Get referrer from document
 */
function getReferrer(): string | null {
  if (typeof document === 'undefined') return null;
  return document.referrer || null;
}

/**
 * Determine if we should track this page
 * Only track on auth-related pages: /signup, /login, /recover, etc.
 */
function shouldTrack(): boolean {
  if (typeof window === 'undefined') return false;

  const path = window.location.pathname;
  const authPages = ['/signup', '/login', '/recover', '/recovery', '/otp', '/totp'];

  return authPages.some(page => path.includes(page));
}

/**
 * Check if user is already authenticated
 */
function isUserAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;

  const token = localStorage.getItem('auth_token');
  const masterKey = localStorage.getItem('master_key');

  return !!(token && masterKey);
}

export function useSessionTracking(enabled: boolean = true): SessionData {
  const [sessionData, setSessionData] = useState<SessionData>({
    sessionId: null,
    sessionHash: null
  });

  const hasStartedTracking = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const sessionHashRef = useRef<string | null>(null);

  /**
   * Start a tracking session on the backend
   */
  const startTracking = useCallback(async () => {
    // Don't track if disabled, not on auth page, or user already authenticated
    if (!enabled || !shouldTrack() || isUserAuthenticated()) {
      return;
    }

    // Prevent multiple tracking calls
    if (hasStartedTracking.current) {
      return;
    }

    try {
      const utm = extractUTMParams();
      const trackingData: TrackingData = {
        first_landing_url: getFirstLandingUrl(),
        referrer: getReferrer(),
        ...utm
      };

      // Call backend to start session
      const response = await fetch('https://ingest.ellipticc.com/api/v1/sessions/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(trackingData)
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(error);
        return;
      }

      const data = await response.json();
      
      if (data.success && data.session_id) {
        // Store session ID for conversion tracking
        sessionIdRef.current = data.session_id;
        sessionHashRef.current = data.session_hash;

        // Store in sessionStorage (cleared when tab closes)
        sessionStorage.setItem('session_id', data.session_id);
        sessionStorage.setItem('session_hash', data.session_hash);

        setSessionData({
          sessionId: data.session_id,
          sessionHash: data.session_hash
        });

        hasStartedTracking.current = true;
      }
    } catch (error) {
      console.error(error);
    }
  }, [enabled]);

  /**
   * Track a conversion event (e.g., signup)
   */
  const trackConversion = useCallback(async (
    conversionEvent: 'signup' | 'email_verification' | 'login',
    userId?: string
  ) => {
    let sessionId = sessionIdRef.current;

    // Try to get from sessionStorage if not in memory
    if (!sessionId) {
      sessionId = sessionStorage.getItem('session_id');
    }

    if (!sessionId) {
      console.warn('no session ID');
      return;
    }

    try {

      const response = await fetch('https://ingest.ellipticc.com/api/v1/sessions/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          session_id: sessionId,
          conversion_event: conversionEvent,
          user_id: userId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(error);
        return;
      }

      const data = await response.json();
      
      if (data.success) {
        // Conversion tracked successfully
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  /**
   * Stop tracking (called after login)
   */
  const stopTracking = useCallback(() => {
    hasStartedTracking.current = false;
    sessionIdRef.current = null;
    sessionHashRef.current = null;

    // Clear from sessionStorage
    sessionStorage.removeItem('session_id');
    sessionStorage.removeItem('session_hash');
  }, []);

  /**
   * Get current session ID (useful for manual tracking)
   */
  const getSessionId = useCallback(() => {
    return sessionIdRef.current || sessionStorage.getItem('session_id');
  }, []);

  // Start tracking on mount (if enabled)
  useEffect(() => {
    // Small delay to allow page context to settle
    const timeout = setTimeout(() => {
      startTracking();
    }, 100);

    return () => clearTimeout(timeout);
  }, [startTracking]);

  // Expose tracking functions via window object for global access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sessionObj: {
        trackConversion: typeof trackConversion;
        stopTracking: typeof stopTracking;
        getSessionId: typeof getSessionId;
        sessionData: SessionData;
      } = {
        trackConversion,
        stopTracking,
        getSessionId,
        sessionData
      };

      (window as unknown as { __sessionTracking?: typeof sessionObj }).__sessionTracking = sessionObj;
    }
  }, [trackConversion, stopTracking, getSessionId, sessionData]);

  return {
    ...sessionData,
    // These are internal functions but we can access them via window.__sessionTracking
  };
}

/**
 * Export helper functions for global access without hook
 */
export const sessionTrackingUtils = {
  trackConversion: (
    sessionId: string,
    conversionEvent: 'signup' | 'email_verification' | 'login',
    userId?: string
  ) => {
    return fetch('https://ingest.ellipticc.com/api/v1/sessions/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        session_id: sessionId,
        conversion_event: conversionEvent,
        user_id: userId
      })
    });
  },

  getSessionId: (): string | null => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('session_id');
  },

  clearSession: () => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem('session_id');
    sessionStorage.removeItem('session_hash');
  }
};
