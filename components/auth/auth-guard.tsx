"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiClient } from "@/lib/api";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const hasCheckedAuthRef = useRef(false);

  useEffect(() => {
    // Skip if we've already checked auth to prevent infinite loops
    if (hasCheckedAuthRef.current) {
      return;
    }

    // Define public routes that don't require authentication
    const publicRoutes = ['/login', '/signup', '/otp', '/recover', '/backup', '/totp', '/totp/recovery'];

    // Check if current path is public (including share links)
    const isPublic = publicRoutes.includes(pathname) || pathname.startsWith('/s/');

    // Skip auth check for public routes
    if (isPublic) {
      setIsAuthenticated(true);
      hasCheckedAuthRef.current = true;
      return;
    }

    // For private routes, check if token exists
    const token = apiClient.getAuthToken();
    if (!token) {
      // No token found, redirect to login
      hasCheckedAuthRef.current = true;
      router.push("/login");
      setIsAuthenticated(false);
    } else {
      // Token exists, allow access
      hasCheckedAuthRef.current = true;
      setIsAuthenticated(true);
    }
  }, [pathname]); // Only depend on pathname, not router

  // Show loading state while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Only render children if authenticated (or if it's a public route)
  return isAuthenticated ? children : null;
}