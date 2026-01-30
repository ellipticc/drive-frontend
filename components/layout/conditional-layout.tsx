"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useUser } from "@/components/user-context";
import { DeviceLimitOverlay } from "@/components/modals/device-limit-overlay";
import { useLanguage } from "@/lib/i18n/language-context";

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const { deviceLimitReached } = useUser();
  const { dir } = useLanguage();

  // Normalize pathname to remove trailing slash for comparison
  const normalizedPathname = pathname === '/' ? '/' : pathname.replace(/\/$/, '');

  // Define public routes that don't need sidebar
  const publicRoutes = ['/login', '/signup', '/register', '/otp', '/recover', '/recover/otp', '/recover/reset', '/backup', '/backup/verify', '/totp', '/totp/recovery', '/terms-of-service', '/privacy-policy', '/s'];

  // Check if current path is public or paper (standalone)
  const isPublic = publicRoutes.includes(normalizedPathname) || pathname.startsWith('/s/') || pathname.startsWith('/paper');

  // For public routes, render children without sidebar
  if (isPublic) {
    return <>{children}</>;
  }

  // If device limit reached, only show overlay (don't render dashboard at all)
  // Allow /pricing page to render normally when device limit reached
  const isLockedOnBilling = deviceLimitReached && pathname === '/pricing';

  if (deviceLimitReached && !isLockedOnBilling) {
    // Prevent body scroll when overlay is shown
    if (typeof document !== 'undefined') {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }
    return <DeviceLimitOverlay />;
  }

  // Re-enable scroll when not showing overlay
  if (typeof document !== 'undefined') {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
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
      <AppSidebar variant="floating" side={dir === 'rtl' ? 'right' : 'left'} />
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
