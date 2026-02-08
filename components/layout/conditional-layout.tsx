"use client";

import React, { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useUser } from "@/components/user-context";
import { useAIMode } from "@/components/ai-mode-context";
import { DeviceLimitOverlay } from "@/components/modals/device-limit-overlay";
import { useLanguage } from "@/lib/i18n/language-context";
import { toast } from 'sonner';

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { deviceLimitReached } = useUser();
  const { isAIMode, isHydrated } = useAIMode();
  const { dir } = useLanguage();

  // Normalize pathname to remove trailing slash for comparison
  const normalizedPathname = pathname === '/' ? '/' : pathname.replace(/\/$/, '');

  // Define public routes that don't need sidebar
  const publicRoutes = ['/login', '/signup', '/register', '/otp', '/recover', '/recover/otp', '/recover/reset', '/backup', '/backup/verify', '/totp', '/totp/recovery', '/terms-of-service', '/privacy-policy', '/s'];

  // Check if current path is public or paper (standalone)
  const isPublic = publicRoutes.includes(normalizedPathname) || pathname.startsWith('/s/');

  // Always use inset variant for consistent layout
  const sidebarVariant = 'inset';

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

  // Listen for frontend version check events and prompt/reload as needed
  const versionNotifiedRef = useRef<string | null>(null);

  // AI Mode routing: redirect home to assistant when AI mode is on
  useEffect(() => {
    if (!isHydrated) return;

    // If AI Mode is ON and user is on home, redirect to assistant
    if (isAIMode && pathname === '/') {
      router.push('/assistant');
    }

    // If AI Mode is OFF and user is on assistant, redirect to home
    if (!isAIMode && pathname === '/assistant') {
      router.push('/');
    }
  }, [isAIMode, pathname, router, isHydrated]);

  useEffect(() => {
    const handler = (ev: any) => {
      const detail = ev?.detail || {};
      const serverVersion = detail.serverVersion;
      const cacheAction = detail.cacheAction;
      if (!cacheAction || cacheAction === 'noop') return;

      if (cacheAction === 'clear-and-reload') {
        toast('A new version is available — reloading now');
        setTimeout(() => {
          // Force a reload
          window.location.reload();
        }, 700);
        return;
      }

      if (cacheAction === 'notify') {
        if (versionNotifiedRef.current === serverVersion) return;
        versionNotifiedRef.current = serverVersion;
        toast('A new version of the app is available. Reload to update.', {
          action: {
            label: 'Reload',
            onClick: () => window.location.reload(),
          }
        });
      }
    };

    window.addEventListener('ecc:version-check', handler);
    return () => window.removeEventListener('ecc:version-check', handler);
  }, []);

  // Log build version in console for users that open DevTools (prints short hash)
  useEffect(() => {
    try {
      const v = process.env.NEXT_PUBLIC_APP_VERSION || 'unknown';
      const short = typeof v === 'string' && v.length > 7 ? v.slice(0, 7) : v;
      // Show a styled message and a clickable GitHub commit URL in the console for easy debugging
      const repo = 'https://github.com/ellipticc/drive-frontend';
      const commitUrl = typeof v === 'string' && v !== 'unknown' ? `${repo}/commit/${v}` : repo;

      console.log('%cEllipticc Drive — Frontend Version: %c%s', 'font-weight:bold;color:#0b7285', 'color:#94a3b8;font-weight:600', short);
      console.log('%cCommit: %c%s', 'color:#6b7280', 'color:#2563eb;text-decoration:underline', commitUrl);
    } catch (e) {
      // ignore in non-browser envs
    }
  }, []);

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
      <AppSidebar variant={sidebarVariant} side={dir === 'rtl' ? 'right' : 'left'} />
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
