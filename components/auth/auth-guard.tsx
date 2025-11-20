"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiClient } from "@/lib/api";
import { SessionManager } from "@/lib/session-manager";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const hasCheckedAuthRef = useRef(false);

  // Define public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/register', '/otp', '/recover', '/backup', '/totp', '/totp/recovery', '/auth/oauth/callback', '/terms-of-service', '/privacy-policy'];
  const isPublic = publicRoutes.includes(pathname) || pathname.startsWith('/s/');

  useEffect(() => {
    // Mark as hydrated immediately
    setIsHydrated(true);

    // Initialize session management
    SessionManager.initializeSessionManagement();

    // Check if this is a redirect from token expiry
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired') === 'true') {
      setIsExpired(true);
    }

    // Skip if we've already checked auth to prevent infinite loops
    if (hasCheckedAuthRef.current) {
      return;
    }

    // Check if current path is public (including share links)
    if (isPublic) {
      setIsAuthenticated(true);
      hasCheckedAuthRef.current = true;
      return;
    }

    // For private routes, check if token exists and is valid
    const token = apiClient.getAuthToken();
    const isTokenValid = SessionManager.isTokenValid();
    
    if (!token || !isTokenValid) {
      // No token or token expired, redirect immediately using window.location for instant navigation
      hasCheckedAuthRef.current = true;
      setIsExpired(!token);
      const redirectUrl = isExpired ? "/login?expired=true" : "/login";
      window.location.href = redirectUrl;
      return; // Don't continue with the rest of the effect
    } else {
      // Token exists and is valid, allow access
      hasCheckedAuthRef.current = true;
      setIsAuthenticated(true);
    }
  }, [pathname, isPublic]); // Removed router from dependencies

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If not authenticated and we're on a private route, the useEffect will handle the redirect
  // This state should be very brief since window.location.href redirects immediately
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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