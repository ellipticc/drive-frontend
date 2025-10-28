"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiClient } from "@/lib/api";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = () => {
      // Define public routes that don't require authentication
      const publicRoutes = ['/login', '/signup', '/otp', '/recover'];

      // Check if current path is public (including share links)
      const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/s/');

      // Skip auth check for public routes
      if (isPublicRoute) {
        setIsAuthenticated(true);
        return;
      }

      // For private routes, check if token exists
      const token = apiClient.getAuthToken();
      if (!token) {
        // No token found, redirect to login
        router.push("/login");
        setIsAuthenticated(false);
      } else {
        // Token exists, allow access
        setIsAuthenticated(true);
      }
    };

    checkAuth();
  }, [router, pathname]);

  // Show loading state while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Only render children if authenticated (or if it's a public route)
  return isAuthenticated ? <>{children}</> : null;
}