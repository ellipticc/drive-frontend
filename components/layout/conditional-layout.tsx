"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();

  // Define public routes that don't need sidebar
  const publicRoutes = ['/login', '/signup', '/register', '/otp', '/recover', '/backup', '/totp', '/totp/recovery', '/auth/oauth/callback', '/terms-of-service', '/privacy-policy'];
  
  // Check if current path is public
  const isPublic = publicRoutes.includes(pathname) || pathname.startsWith('/s/');

  // For public routes, render children without sidebar
  if (isPublic) {
    return <>{children}</>;
  }

  // For authenticated routes, render with sidebar
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
