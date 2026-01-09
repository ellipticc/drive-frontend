"use client";

import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { IconLoader2 as Loader2 } from "@tabler/icons-react";
import { apiClient } from "@/lib/api";
import { masterKeyManager } from "@/lib/master-key";
import { SessionManager } from "@/lib/session-manager";


interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  // Used to mark whether a redirect is due to an expired session. We only need the setter here.
  const [, setIsExpired] = useState(false);
  const pathname = usePathname();
  const hasCheckedAuthRef = useRef(false);

  // Define public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/register', '/otp', '/recover', '/recover/otp', '/recover/reset', '/backup', '/totp', '/totp/recovery', '/terms-of-service', '/privacy-policy', '/pricing'];
  const isPublic = publicRoutes.includes(pathname) || pathname.startsWith('/s/');

  useLayoutEffect(() => {
    // Initialize session management (synchronous setup doesn't change React state)
    SessionManager.initializeSessionManagement();

    // Skip if we've already checked auth to prevent infinite loops
    if (hasCheckedAuthRef.current) {
      return;
    }

    // Check if current path is public (including share links)
    if (isPublic) {
      requestAnimationFrame(() => setIsAuthenticated(true));
      hasCheckedAuthRef.current = true;
      return;
    }

    // For private routes, check if token exists and is valid
    const token = apiClient.getAuthToken();
    const isTokenValid = SessionManager.isTokenValid();

    if (token && isTokenValid) {
      // Token exists and is valid
      // Initialize master key manager storage for all authenticated routes
      // This ensures correct storage type is used for decryption operations throughout the app
      const localToken = localStorage.getItem('auth_token');
      const sessionToken = sessionStorage.getItem('auth_token');
      const isSessionStorage = !!sessionToken && !localToken;
      const storage = isSessionStorage ? sessionStorage : localStorage;
      masterKeyManager.setStorage(storage);

      hasCheckedAuthRef.current = true;
      requestAnimationFrame(() => setIsAuthenticated(true));
      return;
    }

    if (!token || !isTokenValid) {
      // No token or token expired
      // Redirect immediately using window.location for instant navigation
      hasCheckedAuthRef.current = true;
      const expiredFlag = !token;
      requestAnimationFrame(() => setIsExpired(expiredFlag));
      const redirectUrl = expiredFlag ? "/login?expired=true" : "/login";
      window.location.href = redirectUrl;
      return;
    }
  }, [pathname, isPublic]); // Removed router from dependencies

  // Mark as hydrated after mount to avoid calling setState synchronously inside layout effect
  useEffect(() => {
    // Defer hydration flag to next frame to avoid synchronous setState inside effect
    requestAnimationFrame(() => setIsHydrated(true));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      SessionManager.cleanup();
    };
  }, []);

  // For public routes, render immediately (no loading state)
  if (isPublic && isHydrated) {
    return children;
  }

  // Show loading state only for private routes while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If not authenticated and we're on a private route, the useEffect will handle the redirect
  // This state should be very brief since window.location.href redirects immediately
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm text-muted-foreground">
            Redirecting...
          </p>
        </div>
      </div>
    );
  }

  // Only render children if authenticated
  return children;
}